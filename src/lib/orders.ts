import "server-only";

import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  ORDER_SOURCES,
  PAYMENT_METHODS,
  orderItems,
  orders,
  products,
  type Order,
  type OrderItem,
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

/** Statuses the kitchen history shows: done (ready/collected) + deleted (cancelled). */
export const HISTORY_STATUSES = ["ready", "collected", "cancelled"] as const;

/** Input schema for creating an order. The client sends only ids + quantities. */
export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(99),
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
};

/** Thrown when requested quantities exceed available stock. Maps to HTTP 409. */
export class OrderStockError extends Error {
  constructor(public readonly productName: string) {
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
 * The initial status is a pure function of payment method and source:
 * - paypal            → in_kitchen    (only ever persisted AFTER "Ich habe bezahlt")
 * - cash, terminal    → awaiting_cash (waits in the Kasse queue; not yet in the kitchen)
 * - cash, kasse       → in_kitchen    (staff collect the cash at the counter in that
 *                                      moment, so it goes straight to the kitchen)
 */
function initialStatus(method: PaymentMethod, source: OrderSource): OrderStatus {
  if (method === "paypal") return "in_kitchen";
  return source === "kasse" ? "in_kitchen" : "awaiting_cash";
}

function startOfTodayMs(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

/**
 * Creates an order atomically: re-validates products, computes the total from
 * DB prices (never trusts the client), checks and decrements stock, assigns a
 * daily-resetting order number, and writes the order + item snapshots.
 */
export function createOrder(input: CreateOrderInput): CreateOrderResult {
  const status = initialStatus(input.paymentMethod, input.source);
  const now = Date.now();
  // Paid the moment it enters the kitchen: PayPal (confirmed) or cash at the Kasse.
  const paidConfirmedAt = status === "in_kitchen" ? now : null;

  return db.transaction((tx) => {
    const ids = input.items.map((item) => item.productId);
    const rows = tx
      .select()
      .from(products)
      .where(and(inArray(products.id, ids), eq(products.active, true)))
      .all();
    const byId = new Map(rows.map((row) => [row.id, row]));

    let totalCents = 0;
    for (const item of input.items) {
      const product = byId.get(item.productId);
      if (!product) {
        throw new OrderValidationError("Ein Produkt ist nicht mehr verfügbar.");
      }
      if (product.stockCount !== null && product.stockCount < item.quantity) {
        throw new OrderStockError(product.name);
      }
      totalCents += product.priceCents * item.quantity;
    }

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
        totalCents,
        createdAt: now,
        paidConfirmedAt,
      })
      .returning({ id: orders.id })
      .all();

    tx.insert(orderItems)
      .values(
        input.items.map((item) => {
          const product = byId.get(item.productId)!;
          return {
            orderId: order.id,
            productId: product.id,
            nameSnapshot: product.name,
            unitPriceCents: product.priceCents,
            quantity: item.quantity,
          };
        }),
      )
      .run();

    // Decrement stock only for products that track it.
    for (const item of input.items) {
      const product = byId.get(item.productId)!;
      if (product.stockCount !== null) {
        tx.update(products)
          .set({ stockCount: sql`${products.stockCount} - ${item.quantity}` })
          .where(eq(products.id, product.id))
          .run();
      }
    }

    return { id: order.id, orderNumber, totalCents };
  });
}

export { orderDisplayLabel } from "@/lib/order-label";

/** An order together with its item snapshots — the shape every staff surface reads. */
export type OrderWithItems = Order & { items: OrderItem[] };

/** Attaches each order's item snapshots. Shared by every list query. */
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

  const itemsByOrder = new Map<number, OrderItem[]>();
  for (const item of items) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push(item);
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
      ),
    )
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
 * paidConfirmedAt. Releases the order into the kitchen.
 */
export function confirmCashPayment(id: number): void {
  db.transaction((tx) => {
    const order = requireOrder(tx, id);
    if (order.status !== "awaiting_cash") throw new OrderTransitionError();
    tx.update(orders)
      .set({ status: "in_kitchen", paidConfirmedAt: Date.now() })
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
 * Cancels an open order (soft): status → cancelled and every tracked item is
 * restocked. History and daily order numbers are preserved.
 */
export function cancelOrder(id: number): void {
  db.transaction((tx) => {
    const order = requireOrder(tx, id);
    if (order.status !== "in_kitchen") throw new OrderTransitionError();
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
          throw new OrderStockError(item.nameSnapshot);
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
