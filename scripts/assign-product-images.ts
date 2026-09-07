import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { and, eq, isNull } from "drizzle-orm";

import * as schema from "../src/lib/db/schema";

/**
 * Backfills product images with the bundled SVG illustrations in
 * `public/products/`. Run via `npm run db:product-images`.
 *
 * Idempotent and non-destructive: a product is only touched when its
 * `image_url` is still NULL, so photos uploaded through the admin surface are
 * never overwritten. Products are matched by name (not id) because ids differ
 * between the dev machine and the Pi.
 *
 * This opens its own SQLite handle instead of importing `src/lib/db` — that
 * module is `server-only` and cannot be loaded outside the Next.js runtime
 * (same reason `src/lib/db/seed.ts` does it this way).
 */
const IMAGES: Record<string, string> = {
  Kakao: "/products/kakao.svg",
  Milchkaffee: "/products/milchkaffee.svg",
  Tee: "/products/tee.svg",
  Tiramisu: "/products/tiramisu.svg",
  "Pflaumen-Streuselkuchen": "/products/pflaumen-streuselkuchen.svg",
  "Stilles Wasser": "/products/stilles-wasser.svg",
  Cola: "/products/cola.svg",
  "Cola-Zero": "/products/cola-zero.svg",
  Fanta: "/products/fanta.svg",
  Sprite: "/products/sprite.svg",
  "Capri-Sun": "/products/capri-sun.svg",
  "Pizza-Baguette": "/products/pizza-baguette.svg",
};

const DB_FILE = process.env.DB_FILE ?? "data/cafe.db";
const sqlite = new Database(DB_FILE);
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });

let assigned = 0;
let skipped = 0;
let missing = 0;

for (const [name, imageUrl] of Object.entries(IMAGES)) {
  const rows = db
    .select({ id: schema.products.id, imageUrl: schema.products.imageUrl })
    .from(schema.products)
    .where(eq(schema.products.name, name))
    .all();

  if (rows.length === 0) {
    missing += 1;
    console.log(`- ${name}: nicht gefunden`);
    continue;
  }

  for (const row of rows) {
    if (row.imageUrl) {
      skipped += 1;
      console.log(`- ${name} (#${row.id}): übersprungen, hat bereits ein Bild`);
      continue;
    }

    db.update(schema.products)
      .set({ imageUrl })
      .where(and(eq(schema.products.id, row.id), isNull(schema.products.imageUrl)))
      .run();
    assigned += 1;
    console.log(`- ${name} (#${row.id}): ${imageUrl}`);
  }
}

console.log(`\n${assigned} gesetzt, ${skipped} übersprungen, ${missing} nicht gefunden.`);
sqlite.close();
