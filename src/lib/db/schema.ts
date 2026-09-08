import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Database schema — SQLite via Drizzle. Source of truth for the DB structure.
 *
 * Conventions:
 * - Money is always stored as integer CENTS, never floats. Format to euros in the UI only.
 * - Timestamps are Unix epoch milliseconds (integer), created via `unixepoch() * 1000`.
 * - Booleans are stored as integers with `{ mode: "boolean" }`.
 */

const now = sql`(unixepoch() * 1000)`;

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull().default(now),
});

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** Price in integer cents. */
  priceCents: integer("price_cents").notNull(),
  /** Optional image/icon path (bundled locally — no external URLs at runtime). */
  imageUrl: text("image_url"),
  /** Remaining stock. NULL = unlimited. 0 = greyed-out / unavailable on the terminal. */
  stockCount: integer("stock_count"),
  /**
   * Manual "sold out today" flag, independent of stockCount. When true the
   * product greys out on the terminal until staff toggles it back — no
   * counting, no auto-reset.
   */
  soldOut: integer("sold_out", { mode: "boolean" }).notNull().default(false),
  /**
   * Whether the kitchen has to prepare this product. False = direct sale (a
   * chocolate bar, a can of cola): an order made up entirely of such items and
   * placed at the Kasse is handed over across the counter and never reaches the
   * kitchen or the pickup board.
   */
  needsPreparation: integer("needs_preparation", { mode: "boolean" })
    .notNull()
    .default(true),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at").notNull().default(now),
});

/** Payment method chosen by the guest. */
export const PAYMENT_METHODS = ["paypal", "cash"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Where the order was placed. */
export const ORDER_SOURCES = ["terminal", "kasse"] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

/**
 * Order lifecycle — single source of truth. Reuse everywhere; never hardcode strings.
 * - awaiting_payment: PayPal chosen, guest hasn't tapped "Ich habe bezahlt" (kitchen can't see it).
 * - awaiting_cash:    cash chosen, waiting in the Kasse queue (kitchen can't see it).
 * - in_kitchen:       released to the kitchen (PayPal confirmed or cash collected).
 * - ready:            kitchen marked done → green on the Abholmonitor.
 * - collected:        picked up (archived).
 * - cancelled:        removed.
 */
export const ORDER_STATUSES = [
  "awaiting_payment",
  "awaiting_cash",
  "in_kitchen",
  "ready",
  "collected",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Short human-facing number shown on monitors (assigned at creation). */
  orderNumber: integer("order_number").notNull(),
  guestName: text("guest_name"),
  paymentMethod: text("payment_method").$type<PaymentMethod>().notNull(),
  status: text("status").$type<OrderStatus>().notNull(),
  source: text("source").$type<OrderSource>().notNull(),
  /**
   * Decided once at creation and never recomputed: a Kasse order whose items all
   * skip preparation. Such an order goes straight to `collected` when it is paid.
   */
  directSale: integer("direct_sale", { mode: "boolean" }).notNull().default(false),
  /** Order total in integer cents (sum of item snapshots). */
  totalCents: integer("total_cents").notNull(),
  createdAt: integer("created_at").notNull().default(now),
  paidConfirmedAt: integer("paid_confirmed_at"),
  readyAt: integer("ready_at"),
  /** When the order was cancelled (soft delete). NULL unless status is `cancelled`. */
  cancelledAt: integer("cancelled_at"),
});

export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  /** Nullable so history survives product deletion. */
  productId: integer("product_id").references(() => products.id, {
    onDelete: "set null",
  }),
  /** Snapshot of product name at order time — history must not change when products are edited. */
  nameSnapshot: text("name_snapshot").notNull(),
  /** Snapshot of unit price in cents at order time. */
  unitPriceCents: integer("unit_price_cents").notNull(),
  /** Snapshot of the product's `needsPreparation` at order time — history must stay stable. */
  needsPreparation: integer("needs_preparation", { mode: "boolean" })
    .notNull()
    .default(true),
  quantity: integer("quantity").notNull(),
});

/**
 * How many options a guest may pick from a modifier group.
 * - single: exactly one (radio) — e.g. milk type.
 * - multi:  any number (checkboxes) — e.g. extra shots, syrups.
 */
export const MODIFIER_SELECTION_TYPES = ["single", "multi"] as const;
export type ModifierSelectionType = (typeof MODIFIER_SELECTION_TYPES)[number];

/** A reusable option group ("Extras", "Milch") assignable to many products. */
export const modifierGroups = sqliteTable("modifier_groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  selectionType: text("selection_type").$type<ModifierSelectionType>().notNull(),
  /** When true, the guest must pick at least one option before adding to cart. */
  required: integer("required", { mode: "boolean" }).notNull().default(false),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at").notNull().default(now),
});

/** A single choice within a group ("Schuss Karamell"). No stock — only active/inactive. */
export const modifiers = sqliteTable("modifiers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: integer("group_id")
    .notNull()
    .references(() => modifierGroups.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** Surcharge in integer cents added to the product price. May be 0. */
  priceDeltaCents: integer("price_delta_cents").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at").notNull().default(now),
});

/** Many-to-many: which groups apply to which product. */
export const productModifierGroups = sqliteTable(
  "product_modifier_groups",
  {
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    groupId: integer("group_id")
      .notNull()
      .references(() => modifierGroups.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.productId, table.groupId] })],
);

/** Snapshot of the modifiers chosen for one order item — history must stay stable. */
export const orderItemModifiers = sqliteTable("order_item_modifiers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderItemId: integer("order_item_id")
    .notNull()
    .references(() => orderItems.id, { onDelete: "cascade" }),
  /** Nullable so history survives modifier deletion. */
  modifierId: integer("modifier_id").references(() => modifiers.id, {
    onDelete: "set null",
  }),
  nameSnapshot: text("name_snapshot").notNull(),
  groupNameSnapshot: text("group_name_snapshot").notNull(),
  priceDeltaCents: integer("price_delta_cents").notNull(),
});

/** Café-wide key/value settings (e.g. PayPal handle for the QR, café name). */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type ModifierGroup = typeof modifierGroups.$inferSelect;
export type NewModifierGroup = typeof modifierGroups.$inferInsert;
export type Modifier = typeof modifiers.$inferSelect;
export type NewModifier = typeof modifiers.$inferInsert;
export type ProductModifierGroup = typeof productModifierGroups.$inferSelect;
export type NewProductModifierGroup = typeof productModifierGroups.$inferInsert;
export type OrderItemModifier = typeof orderItemModifiers.$inferSelect;
export type NewOrderItemModifier = typeof orderItemModifiers.$inferInsert;
export type Setting = typeof settings.$inferSelect;
