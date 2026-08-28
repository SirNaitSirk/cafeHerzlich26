/**
 * Client-safe stock helpers shared by the terminal surfaces. Kept out of
 * `catalog.ts` (which is `server-only`) so client components can import it.
 */

/** At or below this remaining count, the terminal surfaces the number to the guest. */
export const LOW_STOCK_THRESHOLD = 10;

/**
 * Units of a product a guest may still add, given its tracked stock and the
 * quantity already sitting in the cart. `null` stock = unlimited (Infinity).
 */
export function availableToAdd(stockCount: number | null, inCart: number): number {
  if (stockCount === null) return Infinity;
  return Math.max(0, stockCount - inCart);
}

/** Whether a tracked, low-enough stock should show a "Nur noch X" hint. */
export function isLowStock(stockCount: number | null): boolean {
  return stockCount !== null && stockCount <= LOW_STOCK_THRESHOLD;
}
