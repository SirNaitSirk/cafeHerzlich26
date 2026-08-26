import { PickupBoard } from "@/components/abholung/pickup-board";
import { listOrders, PICKUP_STATUSES } from "@/lib/orders";
import { getSettings } from "@/lib/settings";

// Always render fresh — the board reflects live order status.
export const dynamic = "force-dynamic";

export default function AbholungPage() {
  const orders = listOrders({ statuses: PICKUP_STATUSES });
  const settings = getSettings();

  return (
    <PickupBoard
      cafeName={settings.cafe_name ?? "Cafe Herzlich"}
      initialOrders={orders}
    />
  );
}
