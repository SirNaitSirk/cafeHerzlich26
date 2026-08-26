/**
 * Uniform order label used by every surface (terminal, Kasse, Küche, Abholung):
 * the guest name, or "Bestellung #<n>" when none was given. Client-safe (no
 * server-only imports) so both server and browser share one implementation.
 */
export function orderDisplayLabel(order: {
  guestName: string | null;
  orderNumber: number;
}): string {
  const name = order.guestName?.trim();
  return name && name.length > 0 ? name : `Bestellung #${order.orderNumber}`;
}
