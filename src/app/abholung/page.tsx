import { PickupBoard } from "@/components/abholung/pickup-board";
import { listOrders, PICKUP_STATUSES } from "@/lib/orders";
import { resolvePickupThemeKey } from "@/lib/pickup-themes";
import { getSettings } from "@/lib/settings";

// Always render fresh — the board reflects live order status.
export const dynamic = "force-dynamic";

export default function AbholungPage() {
  const orders = listOrders({ statuses: PICKUP_STATUSES });
  const settings = getSettings();

  return (
    // Public TV surface on a matte Samsung Frame panel: force a fixed dark,
    // high-contrast presentation regardless of the ambient theme. The color
    // theme is switched live from the admin dashboard (never from the TV).
    <div className="dark">
      <PickupBoard
        cafeName={settings.cafe_name ?? "Cafe Herzlich"}
        initialOrders={orders}
        initialThemeKey={resolvePickupThemeKey(settings.pickup_theme)}
      />
    </div>
  );
}
