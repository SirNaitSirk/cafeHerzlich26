import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  categories,
  modifierGroups,
  modifiers,
  productModifierGroups,
  products,
  type ModifierSelectionType,
} from "@/lib/db/schema";

/** A single selectable option within a group, as shown on the terminal. */
export type CatalogModifier = {
  id: number;
  name: string;
  priceDeltaCents: number;
};

/** A group of options attached to a product (e.g. "Extras", "Milch"). */
export type CatalogModifierGroup = {
  id: number;
  name: string;
  selectionType: ModifierSelectionType;
  required: boolean;
  modifiers: CatalogModifier[];
};

export type CatalogProduct = {
  id: number;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  /** NULL = unlimited. 0 = sold out (greyed / unselectable on the terminal). */
  stockCount: number | null;
  /** Manual "sold out today" flag — greyed / unselectable regardless of stock. */
  soldOut: boolean;
  /** Assigned option groups (active groups/options only). Empty = no options. */
  modifierGroups: CatalogModifierGroup[];
};

export type CatalogCategory = {
  id: number;
  name: string;
  products: CatalogProduct[];
};

/**
 * Loads the active catalog (active categories, each with their active products),
 * ordered by sort order then name. Each product carries its assigned active
 * modifier groups (with active options). Shared by the terminal server component
 * and the GET /api/catalog route so both see exactly the same data.
 */
export function getCatalog(): CatalogCategory[] {
  const activeCategories = db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.active, true))
    .orderBy(asc(categories.sortOrder), asc(categories.name))
    .all();

  const activeProducts = db
    .select({
      id: products.id,
      categoryId: products.categoryId,
      name: products.name,
      priceCents: products.priceCents,
      imageUrl: products.imageUrl,
      stockCount: products.stockCount,
      soldOut: products.soldOut,
    })
    .from(products)
    .where(eq(products.active, true))
    .orderBy(asc(products.sortOrder), asc(products.name))
    .all();

  const groupsByProduct = loadModifierGroups(activeProducts.map((product) => product.id));

  return activeCategories.map((category) => ({
    id: category.id,
    name: category.name,
    products: activeProducts
      .filter((product) => product.categoryId === category.id)
      .map((product) => ({
        id: product.id,
        name: product.name,
        priceCents: product.priceCents,
        imageUrl: product.imageUrl,
        stockCount: product.stockCount,
        soldOut: product.soldOut,
        modifierGroups: groupsByProduct.get(product.id) ?? [],
      })),
  }));
}

/**
 * Loads the active modifier groups (with active options) for the given products
 * in a few queries — no N+1. Returns a map productId → ordered groups.
 */
function loadModifierGroups(
  productIds: number[],
): Map<number, CatalogModifierGroup[]> {
  const byProduct = new Map<number, CatalogModifierGroup[]>();
  if (productIds.length === 0) return byProduct;

  const assignments = db
    .select({
      productId: productModifierGroups.productId,
      groupId: modifierGroups.id,
      groupName: modifierGroups.name,
      selectionType: modifierGroups.selectionType,
      required: modifierGroups.required,
      sortOrder: productModifierGroups.sortOrder,
    })
    .from(productModifierGroups)
    .innerJoin(modifierGroups, eq(productModifierGroups.groupId, modifierGroups.id))
    .where(
      and(
        inArray(productModifierGroups.productId, productIds),
        eq(modifierGroups.active, true),
      ),
    )
    .orderBy(asc(productModifierGroups.sortOrder), asc(modifierGroups.name))
    .all();

  if (assignments.length === 0) return byProduct;

  const groupIds = [...new Set(assignments.map((row) => row.groupId))];
  const optionRows = db
    .select({
      groupId: modifiers.groupId,
      id: modifiers.id,
      name: modifiers.name,
      priceDeltaCents: modifiers.priceDeltaCents,
    })
    .from(modifiers)
    .where(and(inArray(modifiers.groupId, groupIds), eq(modifiers.active, true)))
    .orderBy(asc(modifiers.sortOrder), asc(modifiers.name))
    .all();

  const optionsByGroup = new Map<number, CatalogModifier[]>();
  for (const option of optionRows) {
    const list = optionsByGroup.get(option.groupId) ?? [];
    list.push({
      id: option.id,
      name: option.name,
      priceDeltaCents: option.priceDeltaCents,
    });
    optionsByGroup.set(option.groupId, list);
  }

  for (const row of assignments) {
    const options = optionsByGroup.get(row.groupId) ?? [];
    // Skip groups with no selectable options — nothing to show.
    if (options.length === 0) continue;
    const list = byProduct.get(row.productId) ?? [];
    list.push({
      id: row.groupId,
      name: row.groupName,
      selectionType: row.selectionType,
      required: row.required,
      modifiers: options,
    });
    byProduct.set(row.productId, list);
  }

  return byProduct;
}
