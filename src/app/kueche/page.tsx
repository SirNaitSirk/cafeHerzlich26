import { KitchenMonitor } from "@/components/kueche/kitchen-monitor";
import { KITCHEN_STATUSES, listOrders } from "@/lib/orders";

// Always render fresh — open orders change constantly at runtime.
export const dynamic = "force-dynamic";

export default function KuechePage() {
  const orders = listOrders({ statuses: KITCHEN_STATUSES });
  return <KitchenMonitor initialOrders={orders} />;
}
