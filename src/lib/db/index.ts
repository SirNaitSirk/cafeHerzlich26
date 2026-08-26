import "server-only";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import * as schema from "./schema";

/**
 * Local SQLite database client (server-only).
 *
 * The DB is a single file on the Pi. Path is configurable via DB_FILE
 * (defaults to ./data/cafe.db). The connection is cached across hot reloads
 * in dev via a global so we don't open many handles.
 */
const DB_FILE = process.env.DB_FILE ?? "data/cafe.db";

function createDb() {
  const dir = dirname(DB_FILE);
  if (dir && dir !== "." && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(DB_FILE);
  // WAL improves concurrent read performance while a single writer runs — ideal for one Pi process.
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  return drizzle(sqlite, { schema });
}

const globalForDb = globalThis as unknown as {
  db?: ReturnType<typeof createDb>;
};

export const db = globalForDb.db ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}

export { schema };
