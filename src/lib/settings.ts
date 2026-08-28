import "server-only";

import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";

/** Café-wide setting keys the admin may edit. Central whitelist. */
export const SETTING_KEYS = ["cafe_name", "paypal_handle", "pickup_theme"] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

export function isSettingKey(value: string): value is SettingKey {
  return (SETTING_KEYS as readonly string[]).includes(value);
}

/** Reads all café settings as a key/value map. */
export function getSettings(): Record<string, string> {
  const rows = db.select().from(settings).all();
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

/** Upserts one or more settings (only whitelisted keys). */
export function setSettings(values: Partial<Record<SettingKey, string>>): void {
  const entries = Object.entries(values).filter(
    (entry): entry is [SettingKey, string] =>
      isSettingKey(entry[0]) && typeof entry[1] === "string",
  );
  if (entries.length === 0) return;

  db.transaction((tx) => {
    for (const [key, value] of entries) {
      tx.insert(settings)
        .values({ key, value })
        .onConflictDoUpdate({ target: settings.key, set: { value } })
        .run();
    }
  });
}
