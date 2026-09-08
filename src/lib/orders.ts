import "server-only";

import { and, asc, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  ORDER_SOURCES,
  PAYMENT_METHODS,
  modifierGroups,
  modifiers,
  orderItemModifiers,
  orderItems,
  orders,
  productModifierGroups,
  products,
  type Order,
  type OrderItem,
  type OrderItemModifier,
  type OrderSource,
  type OrderStatus,
  type PaymentMethod,
} from "@/lib/db/schema";

/** Statuses the kitchen monitor shows: released, not yet marked done. */
export const KITCHEN_STATUSES = ["in_kitchen"] as const;

/** Statuses the public pickup monitor shows: in preparation + ready (green). */
export const PICKUP_STATUSES = ["in_kitchen", "ready"] as const;

/** Statuses the Kasse cash queue shows: cash orders awaiting collection. */
export const CASH_QUEUE_STATUSES = ["awaiting_cash"] as const;

/** Statuses the Kasse "ready for pickup" list shows (mirrors the Abholmonitor). */
export const READY_STATUSES = ["ready"] as const;

/** Statuses the Kasse "recently collected" list shows (the undo target). */
export const COLLECTED_STATUSES = ["collected"] as const;

/** Statuses the kitchen history shows: done (ready/collected) + deleted (cancelled). */
export const HISTORY_STATUSES = ["ready", "collected", "cancelled"] as const;

/** Input schema for creating an order. The client sends only ids + quantities. */
export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(99),
        /** Ids of the chosen modifier options (validated server-side). */
        modifierIds: z.array(z.number().int().positive()).default([]),
      }),
    )
    .min(1),
  guestName: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((value) => (value ? value : null)),
  paymentMethod: z.enum(PAYMENT_METHODS),
  source: z.enum(ORDER_SOURCES),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export type CreateOrderResult = {
  id: number;
  orderNumber: number;
  totalCents: number;
  /** True when the order skips the kitchen entirely — the Kasse hands it over directly. */
  directSale: boolean;
};

/** Thrown when requested quantities exceed available stock. Maps to HTTP 409. */
export class OrderStockError extends Error {
  constructor(
    public readonly productName: string,
    /** Units still available — lets the client trim the cart line to what is left. */
    public readonly available: number,
    /** The product that ran out, so the client knows which cart line to trim. */
    public readonly productId: number,
  ) {
    super(`Nicht genug Bestand für "${productName}".`);
    this.name = "OrderStockError";
  }
}

/** Thrown when an item references a missing/inactive product. Maps to HTTP 400. */
export class OrderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderValidationError";
  }
}

/** Thrown when an order id doesn't exist. Maps to HTTP 404. */
export class OrderNotFoundError extends Error {
  constructor() {
    super("Bestellung nicht gefunden.");
    this.name = "OrderNotFoundError";
  }
}

/** Thrown when a mutation isn't allowed for the order's current status. Maps to HTTP 409. */
export class OrderTransitionError extends Error {
  constructor() {
    super("Diese Bestellung kann nicht mehr geändert werden.");
    this.name = "OrderTransitionError";
  }
}

/**
 * A Kasse order made up entirely of no-prep products (a chocolate bar, a can of
 * cola) is handed over across the counter the moment it is paid: it never reaches
 * the kitchen or the pickup board. Terminal orders are never direct sales — the
 * guest is not standing behind the counter, so somebody still has to hand the
 * items out, which is exactly what the kitchen and the pickup board are for.
 */
function isDirectSale(
  source: OrderSource,
  items: { needsPreparation: boolean }[],
): boolean {
  return source === "kasse" && items.every((item) => !item.needsPreparation);
}

/**
 * The initial status is a function of the payment method and whether the order
 * is a direct sale:
 * - paypal → in_kitchen    (only ever persisted AFTER "Ich habe bezahlt"), or
 *                          collected right away for a direct sale
 * - cash   → awaiting_cash (the money still has to be collected — at the terminal
 *                           the guest walks to the Kasse queue, at the Kasse the
 *                           register dialog opens right away; `confirmCashPayment`
 *                           then releases the order into the kitchen, or settles a
 *                           direct sale as collected)
 */
function initialStatus(method: PaymentMethod, directSale: boolean): OrderStatus {
  if (method !== "paypal") return "awaiting_cash";
  return directSale ? "collected" : "in_kitchen";
}

function startOfTodayMs(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

/** A validated, priced modifier ready to be snapshotted onto an order item. */
type ResolvedModifier = {
  modifierId: number;
  nameSnapshot: string;
  groupNameSnapshot: string;
  priceDeltaCents: number;
};

/**
 * Validates the modifier ids chosen for a product and returns the priced
 * snapshots. Enforces: every option belongs to an active group assigned to the
 * product and is itself active; `single` groups get at most one option; `required`
 * groups get at least one. Never trusts client-sent prices — deltas come from the DB.
 */
function resolveItemModifiers(
  tx: Tx,
  productId: number,
  modifierIds: number[],
): ResolvedModifier[] {
  // The product's assigned active groups with their active options.
  const rows = tx
    .select({
      groupId: modifierGroups.id,
      groupName: modifierGroups.name,
      selectionType: modifierGroups.selectionType,
      required: modifierGroups.required,
      modifierId: modifiers.id,
      modifierName: modifiers.name,
      priceDeltaCents: modifiers.priceDeltaCents,
    })
    .from(productModifierGroups)
    .innerJoin(modifierGroups, eq(productModifierGroups.groupId, modifierGroups.id))
    .innerJoin(modifiers, eq(modifiers.groupId, modifierGroups.id))
    .where(
      and(
        eq(productModifierGroups.productId, productId),
        eq(modifierGroups.active, true),
        eq(modifiers.active, true),
      ),
    )
    .all();

  const optionById = new Map(rows.map((row) => [row.modifierId, row]));
  const chosen = new Set(modifierIds);

  // Every chosen id must be a valid, active option assigned to this product.
  for (const id of chosen) {
    if (!optionById.has(id)) {
      throw new OrderValidationError("Eine gewählte Option ist nicht verfügbar.");
    }
  }

  // Group-level rules: single = max 1 chosen, required = min 1 chosen.
  const groups = new Map<
    number,
    { selectionType: string; required: boolean; chosenCount: number }
  >();
  for (const row of rows) {
    if (!groups.has(row.groupId)) {
      groups.set(row.groupId, {
        selectionType: row.selectionType,
        required: row.required,
        chosenCount: 0,
      });
    }
    if (chosen.has(row.modifierId)) {
      groups.get(row.groupId)!.chosenCount += 1;
    }
  }
  for (const group of groups.values()) {
    if (group.selectionType === "single" && group.chosenCount > 1) {
      throw new OrderValidationError("Für eine Auswahl ist nur eine Option erlaubt.");
    }
    if (group.required && group.chosenCount === 0) {
      throw new OrderValidationError("Bitte eine Pflichtoption auswählen.");
    }
  }

  return modifierIds.map((id) => {
    const option = optionById.get(id)!;
    return {
      modifierId: option.modifierId,
      nameSnapshot: option.modifierName,
      groupNameSnapshot: option.groupName,
      priceDeltaCents: option.priceDeltaCents,
    };
  });
}

/**
 * Creates an order atomically: re-validates products, computes the total from
 * DB prices (never trusts the client), checks and decrements stock, assigns a
 * daily-resetting order number, and writes the order + item + modifier snapshots.
 *
 * ATOMICITY: `better-sqlite3` is fully synchronous and this function contains no
 * `await`, so the whole transaction runs in a single, uninterrupted tick of the
 * event loop. That is what makes check-then-decrement safe when two terminals
 * order the last unit at the same time — the second request cannot slip in
 * between the check and the decrement. Introducing an `await` anywhere inside
 * this transaction would silently break that guarantee and allow overselling.
 */
export function createOrder(input: CreateOrderInput): CreateOrderResult {
  const now = Date.now();

  return db.transaction((tx) => {
    const ids = input.items.map((item) => item.productId);
    const rows = tx
      .select()
      .from(products)
      .where(and(inArray(products.id, ids), eq(products.active, true)))
      .all();
    const byId = new Map(rows.map((row) => [row.id, row]));

    // Stock is tracked per PRODUCT, but the same product may appear in several
    // order lines (one per modifier combination). Sum the requested quantities
    // per product first, so checking and decrementing both work on that total —
    // checking line by line would let 2 lines of 2 pass against a stock of 2.
    const requestedByProduct = new Map<number, number>();
    for (const item of input.items) {
      requestedByProduct.set(
        item.productId,
        (requestedByProduct.get(item.productId) ?? 0) + item.quantity,
      );
    }

    // Validate + price every line up front: effective unit price is the product
    // price plus the chosen modifier deltas. `totalCents` is derived here, never
    // taken from the client.
    let totalCents = 0;
    const priced = input.items.map((item) => {
      const product = byId.get(item.productId);
      if (!product) {
        throw new OrderValidationError("Ein Produkt ist nicht mehr verfügbar.");
      }
      if (product.soldOut) {
        throw new OrderValidationError("Ein Produkt ist nicht mehr verfügbar.");
      }
      const requested = requestedByProduct.get(product.id) ?? item.quantity;
      if (product.stockCount !== null && product.stockCount < requested) {
        throw new OrderStockError(product.name, product.stockCount, product.id);
      }
      const chosenModifiers = resolveItemModifiers(tx, product.id, item.modifierIds);
      const deltaSum = chosenModifiers.reduce((sum, mod) => sum + mod.priceDeltaCents, 0);
      const unitPriceCents = product.priceCents + deltaSum;
      totalCents += unitPriceCents * item.quantity;
      return { item, product, chosenModifiers, unitPriceCents };
    });

    // A direct sale skips the kitchen: decided here, once, and persisted — later
    // catalog edits must not rewrite what already happened to this order.
    const directSale = isDirectSale(
      input.source,
      priced.map(({ product }) => product),
    );
    const status = initialStatus(input.paymentMethod, directSale);
    // Paid the moment it leaves the payment step — for cash that is the Kasse
    // confirmation, which stamps `paidConfirmedAt` itself.
    const paidConfirmedAt = status === "awaiting_cash" ? null : now;
    // A direct sale is prepared and handed over in the same instant, so it also
    // carries a readyAt — history and the "recently collected" list sort by it.
    const readyAt = status === "collected" ? now : null;

    // Daily-resetting running number.
    const todaysCount = tx
      .select({ value: sql<number>`count(*)` })
      .from(orders)
      .where(gte(orders.createdAt, startOfTodayMs()))
      .get();
    const orderNumber = (todaysCount?.value ?? 0) + 1;

    const [order] = tx
      .insert(orders)
      .values({
        orderNumber,
        guestName: input.guestName,
        paymentMethod: input.paymentMethod,
        status,
        source: input.source,
        directSale,
        totalCents,
        createdAt: now,
        paidConfirmedAt,
        readyAt,
      })
      .returning({ id: orders.id })
      .all();

    // Insert each item, then snapshot its chosen modifiers keyed by the new id.
    for (const { item, product, chosenModifiers, unitPriceCents } of priced) {
      const [orderItem] = tx
        .insert(orderItems)
        .values({
          orderId: order.id,
          productId: product.id,
          nameSnapshot: product.name,
          unitPriceCents,
          quantity: item.quantity,
          needsPreparation: product.needsPreparation,
        })
        .returning({ id: orderItems.id })
        .all();

      if (chosenModifiers.length > 0) {
        tx.insert(orderItemModifiers)
          .values(
            chosenModifiers.map((mod) => ({
              orderItemId: orderItem.id,
              modifierId: mod.modifierId,
              nameSnapshot: mod.nameSnapshot,
              groupNameSnapshot: mod.groupNameSnapshot,
              priceDeltaCents: mod.priceDeltaCents,
            })),
          )
          .run();
      }
    }

    // Decrement stock once per product (the summed quantity), only for products
    // that track it. Decrementing per line would double-count a product that
    // appears in more than one line.
    for (const [productId, quantity] of requestedByProduct) {
      const product = byId.get(productId)!;
      if (product.stockCount !== null) {
        tx.update(products)
          .set({ stockCount: sql`${products.stockCount} - ${quantity}` })
          .where(eq(products.id, productId))
          .run();
      }
    }

    return { id: order.id, orderNumber, totalCents, directSale };
  });
}

export { orderDisplayLabel } from "@/lib/order-label";

/** An order item together with its chosen modifier snapshots. */
export type OrderItemWithModifiers = OrderItem & { modifiers: OrderItemModifier[] };

/** An order together with its item snapshots — the shape every staff surface reads. */
export type OrderWithItems = Order & { items: OrderItemWithModifiers[] };

/** Attaches each order's item snapshots (and their modifiers). Shared by every list query. */
function hydrateOrders(orderRows: Order[]): OrderWithItems[] {
  if (orderRows.length === 0) return [];

  const items = db
    .select()
    .from(orderItems)
    .where(
      inArray(
        orderItems.orderId,
        orderRows.map((order) => order.id),
      ),
    )
    .all();

  const modifierRows =
    items.length === 0
      ? []
      : db
          .select()
          .from(orderItemModifiers)
          .where(
            inArray(
              orderItemModifiers.orderItemId,
              items.map((item) => item.id),
            ),
          )
          .all();

  const modifiersByItem = new Map<number, OrderItemModifier[]>();
  for (const mod of modifierRows) {
    const list = modifiersByItem.get(mod.orderItemId) ?? [];
    list.push(mod);
    modifiersByItem.set(mod.orderItemId, list);
  }

  const itemsByOrder = new Map<number, OrderItemWithModifiers[]>();
  for (const item of items) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push({ ...item, modifiers: modifiersByItem.get(item.id) ?? [] });
    itemsByOrder.set(item.orderId, list);
  }

  return orderRows.map((order) => ({
    ...order,
    items: itemsByOrder.get(order.id) ?? [],
  }));
}

/**
 * Loads orders in the given statuses, each with its item snapshots, sorted by
 * arrival (createdAt asc — oldest first). Shared read layer for Küche/Kasse/Abholung.
 */
export function listOrders(opts: { statuses: readonly OrderStatus[] }): OrderWithItems[] {
  if (opts.statuses.length === 0) return [];

  const orderRows = db
    .select()
    .from(orders)
    .where(inArray(orders.status, [...opts.statuses]))
    .orderBy(asc(orders.createdAt), asc(orders.id))
    .all();

  return hydrateOrders(orderRows);
}

/**
 * Loads today's past orders — done (ready/collected) and deleted (cancelled) —
 * for the kitchen history, newest first. Sort key is the moment the order left
 * the kitchen: cancelledAt for deletions, readyAt for done, createdAt as fallback.
 * Bounded to today (matches the daily-resetting order number).
 */
export function listOrderHistory(): OrderWithItems[] {
  const resolvedAt = sql`coalesce(${orders.cancelledAt}, ${orders.readyAt}, ${orders.createdAt})`;
  const orderRows = db
    .select()
    .from(orders)
    .where(
      and(
        inArray(orders.status, [...HISTORY_STATUSES]),
        gte(orders.createdAt, startOfTodayMs()),
        // Direct sales never reached the kitchen, so they are not part of its
        // history — they stay in the Kasse list and the admin archive.
        eq(orders.directSale, false),
      ),
    )
    .orderBy(desc(resolvedAt), desc(orders.id))
    .all();

  return hydrateOrders(orderRows);
}

/**
 * Loads today's collected orders — the Kasse undo list for pickups that were
 * marked "Abgeholt" by mistake, newest first. There is no collected_at column,
 * so the sort key is readyAt (≈ the pickup order) with createdAt as fallback.
 * Bounded to today (matches the daily-resetting order number).
 */
export function listCollectedToday(): OrderWithItems[] {
  const resolvedAt = sql`coalesce(${orders.readyAt}, ${orders.createdAt})`;
  const orderRows = db
    .select()
    .from(orders)
    .where(
      and(
        inArray(orders.status, [...COLLECTED_STATUSES]),
        gte(orders.createdAt, startOfTodayMs()),
      ),
    )
    .orderBy(desc(resolvedAt), desc(orders.id))
    .all();

  return hydrateOrders(orderRows);
}

/**
 * Loads the permanent order archive: every order that ever reached the kitchen —
 * i.e. was paid/collected (`paidConfirmedAt` is set) — across all days, newest
 * first. Includes done, collected and deleted (cancelled) orders; never-paid,
 * abandoned orders (awaiting_payment/awaiting_cash) are excluded. Read-only source
 * of record for the admin dashboard; unlike `listOrderHistory` it is not bounded
 * to today. Sort key is the moment the order reached its final state.
 */
export function listOrderArchive(): OrderWithItems[] {
  const resolvedAt = sql`coalesce(${orders.cancelledAt}, ${orders.readyAt}, ${orders.paidConfirmedAt}, ${orders.createdAt})`;
  const orderRows = db
    .select()
    .from(orders)
    .where(isNotNull(orders.paidConfirmedAt))
    .orderBy(desc(resolvedAt), desc(orders.id))
    .all();

  return hydrateOrders(orderRows);
}

/** The transaction handle passed to `db.transaction(...)`. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Loads an order or throws OrderNotFoundError. */
function requireOrder(tx: Tx, id: number): Order {
  const order = tx.select().from(orders).where(eq(orders.id, id)).get();
  if (!order) throw new OrderNotFoundError();
  return order;
}

/**
 * Returns tracked stock to the shelf for every item on an order (untracked
 * products are skipped). Used by cancel and by quantity reductions.
 */
function restockItems(tx: Tx, items: Pick<OrderItem, "productId" | "quantity">[]): void {
  for (const item of items) {
    if (item.productId === null || item.quantity <= 0) continue;
    tx.update(products)
      .set({ stockCount: sql`${products.stockCount} + ${item.quantity}` })
      .where(and(eq(products.id, item.productId), sql`${products.stockCount} is not null`))
      .run();
  }
}

/**
 * Kasse confirms the cash was collected: awaiting_cash → in_kitchen, stamping
 * paidConfirmedAt. Releases the order into the kitchen — unless it is a direct
 * sale, which is handed over across the counter right away and therefore goes
 * straight to collected (readyAt stamped too, so it sorts like every other
 * finished order).
 */
export function confirmCashPayment(id: number): void {
  db.transaction((tx) => {
    const order = requireOrder(tx, id);
    if (order.status !== "awaiting_cash") throw new OrderTransitionError();
    const now = Date.now();
    tx.update(orders)
      .set(
        order.directSale
          ? { status: "collected", paidConfirmedAt: now, readyAt: now }
          : { status: "in_kitchen", paidConfirmedAt: now },
      )
      .where(eq(orders.id, id))
      .run();
  });
}

/**
 * Kasse marks a ready order as picked up: ready → collected (archived). No
 * restock — the guest received the items.
 */
export function collectOrder(id: number): void {
  db.transaction((tx) => {
    const order = requireOrder(tx, id);
    if (order.status !== "ready") throw new OrderTransitionError();
    tx.update(orders).set({ status: "collected" }).where(eq(orders.id, id)).run();
  });
}

/**
 * Kasse takes back an accidental pickup: collected → ready. No restock (the goods
 * were never returned to the shelf) and readyAt stays untouched, so the "fertig
 * seit" timer keeps telling the truth.
 */
export function uncollectOrder(id: number): void {
  db.transaction((tx) => {
    const order = requireOrder(tx, id);
    if (order.status !== "collected") throw new OrderTransitionError();
    // A direct sale was never "ready" — putting it back would make it appear on
    // the pickup board it deliberately skipped. Such orders are cancelled instead.
    if (order.directSale) throw new OrderTransitionError();
    tx.update(orders).set({ status: "ready" }).where(eq(orders.id, id)).run();
  });
}

/** Kitchen marks an order done: in_kitchen → ready, stamping readyAt. */
export function markOrderReady(id: number): void {
  db.transaction((tx) => {
    const order = requireOrder(tx, id);
    if (order.status !== "in_kitchen") throw new OrderTransitionError();
    tx.update(orders)
      .set({ status: "ready", readyAt: Date.now() })
      .where(eq(orders.id, id))
      .run();
  });
}

/**
 * Cancels an order (soft): status → cancelled and every tracked item is
 * restocked. History and daily order numbers are preserved. Allowed for open
 * kitchen orders and for a settled direct sale — the latter never passes through
 * the kitchen, so cancelling it out of the Kasse list is its only correction.
 */
export function cancelOrder(id: number): void {
  db.transaction((tx) => {
    const order = requireOrder(tx, id);
    const cancellable =
      order.status === "in_kitchen" || (order.status === "collected" && order.directSale);
    if (!cancellable) throw new OrderTransitionError();
    const items = tx.select().from(orderItems).where(eq(orderItems.orderId, id)).all();
    restockItems(tx, items);
    tx.update(orders)
      .set({ status: "cancelled", cancelledAt: Date.now() })
      .where(eq(orders.id, id))
      .run();
  });
}

/**
 * Restores an accidentally deleted order: cancelled → in_kitchen. Re-decrements
 * tracked stock (staff correction — allowed to hit 0/negative; the goods were
 * already being prepared). createdAt is untouched so the wait timer stays true.
 */
export function restoreOrder(id: number): void {
  db.transaction((tx) => {
    const order = requireOrder(tx, id);
    if (order.status !== "cancelled") throw new OrderTransitionError();
    // Restoring means "back into the kitchen", which a direct sale never entered.
    if (order.directSale) throw new OrderTransitionError();
    const items = tx.select().from(orderItems).where(eq(orderItems.orderId, id)).all();
    for (const item of items) {
      if (item.productId === null) continue;
      tx.update(products)
        .set({ stockCount: sql`${products.stockCount} - ${item.quantity}` })
        .where(and(eq(products.id, item.productId), sql`${products.stockCount} is not null`))
        .run();
    }
    tx.update(orders)
      .set({ status: "in_kitchen", cancelledAt: null })
      .where(eq(orders.id, id))
      .run();
  });
}

/** Input for editing an open order: a target quantity per existing item (0 removes it). */
export const updateOrderSchema = z.object({
  items: z
    .array(
      z.object({
        orderItemId: z.number().int().positive(),
        quantity: z.number().int().min(0).max(99),
      }),
    )
    .min(1),
  guestName: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((value) => (value ? value : null)),
});

export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;

/** Whether editing changed stock — lets the route decide to broadcast catalog:changed. */
export type UpdateOrderResult = { stockChanged: boolean };

/**
 * Edits an open order: adjusts item quantities (0 removes), edits the guest name,
 * restocks reductions / re-validates increases against DB stock, and recomputes
 * the total from the existing price snapshots (never re-priced from the catalog).
 * If every item is removed the order is cancelled instead.
 */
export function updateOrder(id: number, input: UpdateOrderInput): UpdateOrderResult {
  return db.transaction((tx) => {
    const order = requireOrder(tx, id);
    if (order.status !== "in_kitchen") throw new OrderTransitionError();

    const existing = tx.select().from(orderItems).where(eq(orderItems.orderId, id)).all();
    const byId = new Map(existing.map((item) => [item.id, item]));

    // Every requested id must belong to this order (no duplicates, no strangers).
    const requestedIds = new Set<number>();
    for (const change of input.items) {
      if (!byId.has(change.orderItemId) || requestedIds.has(change.orderItemId)) {
        throw new OrderValidationError("Ungültige Bestellposition.");
      }
      requestedIds.add(change.orderItemId);
    }

    // All items removed → treat as a cancel.
    const anyRemaining = input.items.some((change) => change.quantity > 0);
    if (!anyRemaining) {
      restockItems(tx, existing);
      tx.update(orders)
        .set({ status: "cancelled", cancelledAt: Date.now() })
        .where(eq(orders.id, id))
        .run();
      return { stockChanged: existing.some((item) => item.productId !== null) };
    }

    let stockChanged = false;
    let totalCents = 0;

    for (const change of input.items) {
      const item = byId.get(change.orderItemId)!;
      const delta = change.quantity - item.quantity;

      if (delta > 0 && item.productId !== null) {
        // Increasing quantity — the product must still track enough stock.
        const product = tx
          .select({ stockCount: products.stockCount, name: products.name })
          .from(products)
          .where(eq(products.id, item.productId))
          .get();
        if (product && product.stockCount !== null && product.stockCount < delta) {
          throw new OrderStockError(
            item.nameSnapshot,
            item.quantity + product.stockCount,
            item.productId,
          );
        }
        tx.update(products)
          .set({ stockCount: sql`${products.stockCount} - ${delta}` })
          .where(and(eq(products.id, item.productId), sql`${products.stockCount} is not null`))
          .run();
        stockChanged = true;
      } else if (delta < 0 && item.productId !== null) {
        restockItems(tx, [{ productId: item.productId, quantity: -delta }]);
        stockChanged = true;
      }

      if (change.quantity === 0) {
        tx.delete(orderItems).where(eq(orderItems.id, item.id)).run();
      } else if (delta !== 0) {
        tx.update(orderItems)
          .set({ quantity: change.quantity })
          .where(eq(orderItems.id, item.id))
          .run();
        totalCents += item.unitPriceCents * change.quantity;
      } else {
        totalCents += item.unitPriceCents * item.quantity;
      }
    }

    tx.update(orders)
      .set({ guestName: input.guestName, totalCents })
      .where(eq(orders.id, id))
      .run();

    return { stockChanged };
  });
}
