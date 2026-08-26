import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Applies pending Drizzle migrations to the local SQLite file.
 * Run via `npm run db:migrate`. Standalone (does not import the server-only client).
 */
const DB_FILE = process.env.DB_FILE ?? "data/cafe.db";

const dir = dirname(DB_FILE);
if (dir && dir !== "." && !existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

const sqlite = new Database(DB_FILE);
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite);

migrate(db, { migrationsFolder: "drizzle" });
sqlite.close();

console.log(`Migrations applied to ${DB_FILE}`);
