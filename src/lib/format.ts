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
