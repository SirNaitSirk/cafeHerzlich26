import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

/**
 * Seeds the local DB with sample categories/products and default settings,
 * so every surface has something to render during development.
 * Run via `npm run db:seed`. Idempotent-ish: clears product/category/settings first.
 */
const DB_FILE = process.env.DB_FILE ?? "data/cafe.db";
const sqlite = new Database(DB_FILE);
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });

// Reset the catalog (orders are left untouched).
db.delete(schema.products).run();
db.delete(schema.categories).run();
db.delete(schema.modifierGroups).run();
db.delete(schema.settings).run();

const [kaffee, kuchen, kalt] = db
  .insert(schema.categories)
  .values([
    { name: "Kaffee", sortOrder: 1 },
    { name: "Kuchen", sortOrder: 2 },
    { name: "Kalte Getränke", sortOrder: 3 },
  ])
  .returning()
  .all();

const coffees = db
  .insert(schema.products)
  .values([
    { categoryId: kaffee.id, name: "Espresso", priceCents: 220, sortOrder: 1 },
    { categoryId: kaffee.id, name: "Cappuccino", priceCents: 320, sortOrder: 2 },
    { categoryId: kaffee.id, name: "Latte Macchiato", priceCents: 360, sortOrder: 3 },
    { categoryId: kaffee.id, name: "Filterkaffee", priceCents: 250, sortOrder: 4 },
    { categoryId: kuchen.id, name: "Käsekuchen", priceCents: 390, stockCount: 8, sortOrder: 1 },
    { categoryId: kuchen.id, name: "Apfelstrudel", priceCents: 420, stockCount: 5, sortOrder: 2 },
    { categoryId: kuchen.id, name: "Schokoladenkuchen", priceCents: 400, stockCount: 0, sortOrder: 3 },
    { categoryId: kalt.id, name: "Mineralwasser", priceCents: 250, sortOrder: 1 },
    { categoryId: kalt.id, name: "Apfelschorle", priceCents: 290, sortOrder: 2 },
  ])
  .returning()
  .all();

// Sample modifier groups: "Extras" (multi) and "Milch" (single, required),
// assigned to the espresso-based coffees.
const [extras, milch] = db
  .insert(schema.modifierGroups)
  .values([
    { name: "Extras", selectionType: "multi", required: false, sortOrder: 1 },
    { name: "Milch", selectionType: "single", required: true, sortOrder: 2 },
  ])
  .returning()
  .all();

db.insert(schema.modifiers)
  .values([
    { groupId: extras.id, name: "Schuss Karamell", priceDeltaCents: 50, sortOrder: 1 },
    { groupId: extras.id, name: "Extra Espresso-Shot", priceDeltaCents: 80, sortOrder: 2 },
    { groupId: extras.id, name: "Vanillesirup", priceDeltaCents: 50, sortOrder: 3 },
    { groupId: milch.id, name: "Vollmilch", priceDeltaCents: 0, sortOrder: 1 },
    { groupId: milch.id, name: "Hafermilch", priceDeltaCents: 30, sortOrder: 2 },
    { groupId: milch.id, name: "Sojamilch", priceDeltaCents: 30, sortOrder: 3 },
  ])
  .run();

const milkCoffees = coffees.filter((product) =>
  ["Cappuccino", "Latte Macchiato"].includes(product.name),
);
db.insert(schema.productModifierGroups)
  .values(
    milkCoffees.flatMap((product) => [
      { productId: product.id, groupId: extras.id, sortOrder: 0 },
      { productId: product.id, groupId: milch.id, sortOrder: 1 },
    ]),
  )
  .run();

db.insert(schema.settings)
  .values([
    { key: "cafe_name", value: "Cafe Herzlich" },
    { key: "paypal_handle", value: "cafeherzlich" },
  ])
  .run();

sqlite.close();
console.log(`Seeded ${DB_FILE}`);
