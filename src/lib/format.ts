/** Formatting helpers. UI is German — always format money/dates in de-DE. */

const euroFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

/** Format integer cents as a German euro string, e.g. 320 → "3,20 €". */
export function formatEuros(cents: number): string {
  return euroFormatter.format(cents / 100);
}

/**
 * Parse a German euro input (e.g. "3,90" or "3.90") into integer cents.
 * Returns null for empty/invalid input. Rounds to the nearest cent.
 */
export function parseEurosToCents(input: string): number | null {
  const normalized = input.trim().replace(/\s|€/g, "").replace(",", ".");
  if (normalized === "" || !/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

const timeFormatter = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
});

/** Format an epoch-ms timestamp as a German clock time, e.g. "14:07". */
export function formatTime(ms: number): string {
  return timeFormatter.format(ms);
}

const dayFormatter = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Format an epoch-ms timestamp as a full German date, e.g. "Donnerstag, 28. August 2026". */
export function formatDay(ms: number): string {
  return dayFormatter.format(ms);
}

/**
 * A stable per-calendar-day key (local time) for grouping timestamps, e.g.
 * "2026-08-28". Uses the Swedish locale which renders ISO-style YYYY-MM-DD.
 */
const dayKeyFormatter = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Returns a "YYYY-MM-DD" local-day key for an epoch-ms timestamp. */
export function dayKey(ms: number): string {
  return dayKeyFormatter.format(ms);
}
