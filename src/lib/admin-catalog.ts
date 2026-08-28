import "server-only";

import { asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  MODIFIER_SELECTION_TYPES,
  categories,
  modifierGroups,
  modifiers,
  productModifierGroups,
  products,
  type ModifierSelectionType,
} from "@/lib/db/schema";

/**
 * Admin catalog service. Unlike `src/lib/catalog.ts` (terminal — active only),
 * this exposes ALL categories/products including deactivated ones, and owns
 * every catalog mutation (create/edit/deactivate/reactivate/reorder/stock).
 *
 * Deletion is SOFT: `active = false`. History (order_items snapshots) stays
 * intact and entries can be reactivated.
 */

export type AdminProduct = {
  id: number;
  categoryId: number;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  stockCount: number | null;
  active: boolean;
  sortOrder: number;
  /** Ids of the modifier groups assigned to this product. */
  modifierGroupIds: number[];
};

/** A single option within a group, as managed in the admin (incl. inactive). */
export type AdminModifier = {
  id: number;
  groupId: number;
  name: string;
  priceDeltaCents: number;
  active: boolean;
  sortOrder: number;
};

/** A modifier group with its options — the shape the admin manager reads. */
export type AdminModifierGroup = {
  id: number;
  name: string;
  selectionType: ModifierSelectionType;
  required: boolean;
  active: boolean;
  sortOrder: number;
  modifiers: AdminModifier[];
};

export type AdminCategory = {
  id: number;
  name: string;
  active: boolean;
  sortOrder: number;
  products: AdminProduct[];
};

/** Thrown when a category/product id doesn't exist. Maps to HTTP 404. */
export class AdminNotFoundError extends Error {
  constructor() {
    super("Eintrag nicht gefunden.");
    this.name = "AdminNotFoundError";
  }
}

/** Thrown when input is semantically invalid. Maps to HTTP 400. */
export class AdminValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminValidationError";
  }
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const nameSchema = z.string().trim().min(1).max(60);
const priceSchema = z.number().int().min(0).max(1_000_000);
const stockSchema = z.number().int().min(0).max(100_000).nullable();
const imageUrlSchema = z
  .string()
  .trim()
  .max(200)
  .nullable()
  .transform((value) => (value ? value : null));

export const createCategorySchema = z.object({ name: nameSchema });
export const updateCategorySchema = z.object({
  name: nameSchema.optional(),
  active: z.boolean().optional(),
});

const groupIdsSchema = z.array(z.number().int().positive()).max(50);

export const createProductSchema = z.object({
  categoryId: z.number().int().positive(),
  name: nameSchema,
  priceCents: priceSchema,
  imageUrl: imageUrlSchema.optional(),
  stockCount: stockSchema.optional(),
  modifierGroupIds: groupIdsSchema.optional(),
});
export const updateProductSchema = z.object({
  categoryId: z.number().int().positive().optional(),
  name: nameSchema.optional(),
  priceCents: priceSchema.optional(),
  imageUrl: imageUrlSchema.optional(),
  stockCount: stockSchema.optional(),
  active: z.boolean().optional(),
  modifierGroupIds: groupIdsSchema.optional(),
});

export const moveSchema = z.object({ direction: z.enum(["up", "down"]) });
export const setStockSchema = z.object({ stockCount: stockSchema });

export type Direction = z.infer<typeof moveSchema>["direction"];

const modifierNameSchema = z.string().trim().min(1).max(60);
const priceDeltaSchema = z.number().int().min(0).max(1_000_000);

export const createModifierGroupSchema = z.object({
  name: modifierNameSchema,
  selectionType: z.enum(MODIFIER_SELECTION_TYPES),
  required: z.boolean().default(false),
});
export const updateModifierGroupSchema = z.object({
  name: modifierNameSchema.optional(),
  selectionType: z.enum(MODIFIER_SELECTION_TYPES).optional(),
  required: z.boolean().optional(),
  active: z.boolean().optional(),
});

export const createModifierSchema = z.object({
  groupId: z.number().int().positive(),
  name: modifierNameSchema,
  priceDeltaCents: priceDeltaSchema,
});
export const updateModifierSchema = z.object({
  name: modifierNameSchema.optional(),
  priceDeltaCents: priceDeltaSchema.optional(),
  active: z.boolean().optional(),
});

export const setProductGroupsSchema = z.object({
  groupIds: z.array(z.number().int().positive()).max(50),
});

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Full catalog for the admin: every category with its products (incl. inactive). */
export function getAdminCatalog(): AdminCategory[] {
  const categoryRows = db
    .select()
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name))
    .all();

  const productRows = db
    .select()
    .from(products)
    .orderBy(asc(products.sortOrder), asc(products.name))
    .all();

  const assignmentRows = db
    .select({
      productId: productModifierGroups.productId,
      groupId: productModifierGroups.groupId,
    })
    .from(productModifierGroups)
    .orderBy(asc(productModifierGroups.sortOrder))
    .all();

  const groupsByProduct = new Map<number, number[]>();
  for (const row of assignmentRows) {
    const list = groupsByProduct.get(row.productId) ?? [];
    list.push(row.groupId);
    groupsByProduct.set(row.productId, list);
  }

  return categoryRows.map((category) => ({
    id: category.id,
    name: category.name,
    active: category.active,
    sortOrder: category.sortOrder,
    products: productRows
      .filter((product) => product.categoryId === category.id)
      .map((product) => ({
        id: product.id,
        categoryId: product.categoryId,
        name: product.name,
        priceCents: product.priceCents,
        imageUrl: product.imageUrl,
        stockCount: product.stockCount,
        active: product.active,
        sortOrder: product.sortOrder,
        modifierGroupIds: groupsByProduct.get(product.id) ?? [],
      })),
  }));
}

/** All modifier groups with their options (incl. inactive), for the admin manager. */
export function getAdminModifierGroups(): AdminModifierGroup[] {
  const groupRows = db
    .select()
    .from(modifierGroups)
    .orderBy(asc(modifierGroups.sortOrder), asc(modifierGroups.name))
    .all();

  const modifierRows = db
    .select()
    .from(modifiers)
    .orderBy(asc(modifiers.sortOrder), asc(modifiers.name))
    .all();

  return groupRows.map((group) => ({
    id: group.id,
    name: group.name,
    selectionType: group.selectionType,
    required: group.required,
    active: group.active,
    sortOrder: group.sortOrder,
    modifiers: modifierRows
      .filter((modifier) => modifier.groupId === group.id)
      .map((modifier) => ({
        id: modifier.id,
        groupId: modifier.groupId,
        name: modifier.name,
        priceDeltaCents: modifier.priceDeltaCents,
        active: modifier.active,
        sortOrder: modifier.sortOrder,
      })),
  }));
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export function createCategory(input: z.infer<typeof createCategorySchema>): { id: number } {
  const next = db
    .select({ value: sql<number>`coalesce(max(${categories.sortOrder}), 0)` })
    .from(categories)
    .get();
  const [row] = db
    .insert(categories)
    .values({ name: input.name, sortOrder: (next?.value ?? 0) + 1 })
    .returning({ id: categories.id })
    .all();
  return { id: row.id };
}

export function updateCategory(id: number, input: z.infer<typeof updateCategorySchema>): void {
  const changes: Partial<{ name: string; active: boolean }> = {};
  if (input.name !== undefined) changes.name = input.name;
  if (input.active !== undefined) changes.active = input.active;
  if (Object.keys(changes).length === 0) return;

  const result = db.update(categories).set(changes).where(eq(categories.id, id)).run();
  if (result.changes === 0) throw new AdminNotFoundError();
}

/**
 * Permanently deletes a category — HARD delete, unlike the soft
 * `updateCategory({ active: false })`. Only allowed when no product row
 * references the category (active or inactive), so the `products.category_id`
 * FK stays intact.
 */
export function deleteCategory(id: number): void {
  db.transaction((tx) => {
    const exists = tx
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, id))
      .get();
    if (!exists) throw new AdminNotFoundError();

    const product = tx
      .select({ id: products.id })
      .from(products)
      .where(eq(products.categoryId, id))
      .get();
    if (product) throw new AdminValidationError("Kategorie enthält noch Produkte.");

    tx.delete(categories).where(eq(categories.id, id)).run();
  });
}

export function moveCategory(id: number, direction: Direction): void {
  db.transaction((tx) => {
    const ordered = tx
      .select({ id: categories.id })
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.name))
      .all();
    reorder(
      ordered.map((row) => row.id),
      id,
      direction,
      (rowId, sortOrder) =>
        tx.update(categories).set({ sortOrder }).where(eq(categories.id, rowId)).run(),
    );
  });
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

/** The transaction handle passed to `db.transaction(...)`. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function requireCategory(tx: Tx, categoryId: number): void {
  const exists = tx
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, categoryId))
    .get();
  if (!exists) throw new AdminValidationError("Kategorie existiert nicht.");
}

export function createProduct(input: z.infer<typeof createProductSchema>): { id: number } {
  return db.transaction((tx) => {
    requireCategory(tx, input.categoryId);
    const next = tx
      .select({ value: sql<number>`coalesce(max(${products.sortOrder}), 0)` })
      .from(products)
      .where(eq(products.categoryId, input.categoryId))
      .get();
    const [row] = tx
      .insert(products)
      .values({
        categoryId: input.categoryId,
        name: input.name,
        priceCents: input.priceCents,
        imageUrl: input.imageUrl ?? null,
        stockCount: input.stockCount ?? null,
        sortOrder: (next?.value ?? 0) + 1,
      })
      .returning({ id: products.id })
      .all();
    if (input.modifierGroupIds !== undefined) {
      assignProductGroups(tx, row.id, input.modifierGroupIds);
    }
    return { id: row.id };
  });
}

export function updateProduct(id: number, input: z.infer<typeof updateProductSchema>): void {
  db.transaction((tx) => {
    const current = tx.select().from(products).where(eq(products.id, id)).get();
    if (!current) throw new AdminNotFoundError();

    const changes: Partial<{
      categoryId: number;
      name: string;
      priceCents: number;
      imageUrl: string | null;
      stockCount: number | null;
      active: boolean;
      sortOrder: number;
    }> = {};

    if (input.name !== undefined) changes.name = input.name;
    if (input.priceCents !== undefined) changes.priceCents = input.priceCents;
    if (input.imageUrl !== undefined) changes.imageUrl = input.imageUrl;
    if (input.stockCount !== undefined) changes.stockCount = input.stockCount;
    if (input.active !== undefined) changes.active = input.active;

    if (input.categoryId !== undefined && input.categoryId !== current.categoryId) {
      requireCategory(tx, input.categoryId);
      changes.categoryId = input.categoryId;
      // Moving to a new category: append at its end so ordering stays sane.
      const next = tx
        .select({ value: sql<number>`coalesce(max(${products.sortOrder}), 0)` })
        .from(products)
        .where(eq(products.categoryId, input.categoryId))
        .get();
      changes.sortOrder = (next?.value ?? 0) + 1;
    }

    if (input.modifierGroupIds !== undefined) {
      assignProductGroups(tx, id, input.modifierGroupIds);
    }

    if (Object.keys(changes).length === 0) return;
    tx.update(products).set(changes).where(eq(products.id, id)).run();
  });
}

export function setProductStock(id: number, stockCount: number | null): void {
  const result = db.update(products).set({ stockCount }).where(eq(products.id, id)).run();
  if (result.changes === 0) throw new AdminNotFoundError();
}

export function moveProduct(id: number, direction: Direction): void {
  db.transaction((tx) => {
    const product = tx
      .select({ categoryId: products.categoryId })
      .from(products)
      .where(eq(products.id, id))
      .get();
    if (!product) throw new AdminNotFoundError();

    const ordered = tx
      .select({ id: products.id })
      .from(products)
      .where(eq(products.categoryId, product.categoryId))
      .orderBy(asc(products.sortOrder), asc(products.name))
      .all();
    reorder(
      ordered.map((row) => row.id),
      id,
      direction,
      (rowId, sortOrder) =>
        tx.update(products).set({ sortOrder }).where(eq(products.id, rowId)).run(),
    );
  });
}

// ---------------------------------------------------------------------------
// Modifier groups
// ---------------------------------------------------------------------------

export function createModifierGroup(
  input: z.infer<typeof createModifierGroupSchema>,
): { id: number } {
  const next = db
    .select({ value: sql<number>`coalesce(max(${modifierGroups.sortOrder}), 0)` })
    .from(modifierGroups)
    .get();
  const [row] = db
    .insert(modifierGroups)
    .values({
      name: input.name,
      selectionType: input.selectionType,
      required: input.required,
      sortOrder: (next?.value ?? 0) + 1,
    })
    .returning({ id: modifierGroups.id })
    .all();
  return { id: row.id };
}

export function updateModifierGroup(
  id: number,
  input: z.infer<typeof updateModifierGroupSchema>,
): void {
  const changes: Partial<{
    name: string;
    selectionType: ModifierSelectionType;
    required: boolean;
    active: boolean;
  }> = {};
  if (input.name !== undefined) changes.name = input.name;
  if (input.selectionType !== undefined) changes.selectionType = input.selectionType;
  if (input.required !== undefined) changes.required = input.required;
  if (input.active !== undefined) changes.active = input.active;
  if (Object.keys(changes).length === 0) return;

  const result = db
    .update(modifierGroups)
    .set(changes)
    .where(eq(modifierGroups.id, id))
    .run();
  if (result.changes === 0) throw new AdminNotFoundError();
}

export function moveModifierGroup(id: number, direction: Direction): void {
  db.transaction((tx) => {
    const ordered = tx
      .select({ id: modifierGroups.id })
      .from(modifierGroups)
      .orderBy(asc(modifierGroups.sortOrder), asc(modifierGroups.name))
      .all();
    reorder(
      ordered.map((row) => row.id),
      id,
      direction,
      (rowId, sortOrder) =>
        tx.update(modifierGroups).set({ sortOrder }).where(eq(modifierGroups.id, rowId)).run(),
    );
  });
}

// ---------------------------------------------------------------------------
// Modifiers (options within a group)
// ---------------------------------------------------------------------------

function requireModifierGroup(tx: Tx, groupId: number): void {
  const exists = tx
    .select({ id: modifierGroups.id })
    .from(modifierGroups)
    .where(eq(modifierGroups.id, groupId))
    .get();
  if (!exists) throw new AdminValidationError("Optionsgruppe existiert nicht.");
}

export function createModifier(input: z.infer<typeof createModifierSchema>): { id: number } {
  return db.transaction((tx) => {
    requireModifierGroup(tx, input.groupId);
    const next = tx
      .select({ value: sql<number>`coalesce(max(${modifiers.sortOrder}), 0)` })
      .from(modifiers)
      .where(eq(modifiers.groupId, input.groupId))
      .get();
    const [row] = tx
      .insert(modifiers)
      .values({
        groupId: input.groupId,
        name: input.name,
        priceDeltaCents: input.priceDeltaCents,
        sortOrder: (next?.value ?? 0) + 1,
      })
      .returning({ id: modifiers.id })
      .all();
    return { id: row.id };
  });
}

export function updateModifier(id: number, input: z.infer<typeof updateModifierSchema>): void {
  const changes: Partial<{ name: string; priceDeltaCents: number; active: boolean }> = {};
  if (input.name !== undefined) changes.name = input.name;
  if (input.priceDeltaCents !== undefined) changes.priceDeltaCents = input.priceDeltaCents;
  if (input.active !== undefined) changes.active = input.active;
  if (Object.keys(changes).length === 0) return;

  const result = db.update(modifiers).set(changes).where(eq(modifiers.id, id)).run();
  if (result.changes === 0) throw new AdminNotFoundError();
}

export function moveModifier(id: number, direction: Direction): void {
  db.transaction((tx) => {
    const modifier = tx
      .select({ groupId: modifiers.groupId })
      .from(modifiers)
      .where(eq(modifiers.id, id))
      .get();
    if (!modifier) throw new AdminNotFoundError();

    const ordered = tx
      .select({ id: modifiers.id })
      .from(modifiers)
      .where(eq(modifiers.groupId, modifier.groupId))
      .orderBy(asc(modifiers.sortOrder), asc(modifiers.name))
      .all();
    reorder(
      ordered.map((row) => row.id),
      id,
      direction,
      (rowId, sortOrder) =>
        tx.update(modifiers).set({ sortOrder }).where(eq(modifiers.id, rowId)).run(),
    );
  });
}

// ---------------------------------------------------------------------------
// Product ↔ group assignment
// ---------------------------------------------------------------------------

/**
 * Replaces the set of groups assigned to a product (within an existing tx),
 * preserving pick order. Validates that every group exists.
 */
function assignProductGroups(tx: Tx, productId: number, groupIds: number[]): void {
  const uniqueIds = [...new Set(groupIds)];
  if (uniqueIds.length > 0) {
    const existing = tx
      .select({ id: modifierGroups.id })
      .from(modifierGroups)
      .where(inArray(modifierGroups.id, uniqueIds))
      .all();
    if (existing.length !== uniqueIds.length) {
      throw new AdminValidationError("Eine Optionsgruppe existiert nicht.");
    }
  }

  tx.delete(productModifierGroups)
    .where(eq(productModifierGroups.productId, productId))
    .run();
  if (uniqueIds.length > 0) {
    tx.insert(productModifierGroups)
      .values(uniqueIds.map((groupId, index) => ({ productId, groupId, sortOrder: index })))
      .run();
  }
}

/** Replaces the set of groups assigned to a product, preserving pick order. */
export function setProductModifierGroups(productId: number, groupIds: number[]): void {
  db.transaction((tx) => {
    const product = tx
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId))
      .get();
    if (!product) throw new AdminNotFoundError();
    assignProductGroups(tx, productId, groupIds);
  });
}

// ---------------------------------------------------------------------------
// Shared reorder helper
// ---------------------------------------------------------------------------

/**
 * Swaps `id` with its neighbour in `direction`, then rewrites the whole scope's
 * `sortOrder` to its array position (1-based). Reindexing keeps values distinct
 * and gap-free regardless of the previous state. No-op at the list boundary.
 */
function reorder(
  orderedIds: number[],
  id: number,
  direction: Direction,
  persist: (rowId: number, sortOrder: number) => void,
): void {
  const index = orderedIds.indexOf(id);
  if (index === -1) throw new AdminNotFoundError();

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= orderedIds.length) return; // already at the edge

  [orderedIds[index], orderedIds[target]] = [orderedIds[target], orderedIds[index]];
  orderedIds.forEach((rowId, position) => persist(rowId, position + 1));
}
