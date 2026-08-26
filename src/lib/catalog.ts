import "server-only";

import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { categories, products } from "@/lib/db/schema";

export type CatalogProduct = {
  id: number;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  /** NULL = unlimited. 0 = sold out (greyed / unselectable on the terminal). */
  stockCount: number | null;
};

export type CatalogCategory = {
  id: number;
  name: string;
  products: CatalogProduct[];
};

/**
 * Loads the active catalog (active categories, each with their active products),
 * ordered by sort order then name. Shared by the terminal server component and
 * the GET /api/catalog route so both see exactly the same data.
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
    })
    .from(products)
    .where(eq(products.active, true))
    .orderBy(asc(products.sortOrder), asc(products.name))
    .all();

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
      })),
  }));
}
