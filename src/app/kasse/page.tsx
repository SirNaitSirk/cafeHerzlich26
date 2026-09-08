import { KasseDashboard } from "@/components/kasse/kasse-dashboard";
import { getCatalog } from "@/lib/catalog";
import {
  CASH_QUEUE_STATUSES,
  READY_STATUSES,
  listCollectedToday,
  listOrders,
} from "@/lib/orders";
import { getSettings } from "@/lib/settings";

// Always render fresh — the queues and catalog/stock change constantly at runtime.
export const dynamic = "force-dynamic";

export default function KassePage() {
  const cashOrders = listOrders({ statuses: CASH_QUEUE_STATUSES });
  const readyOrders = listOrders({ statuses: READY_STATUSES });
  const collectedOrders = listCollectedToday();
  const catalog = getCatalog();
  const settings = getSettings();

  return (
    <KasseDashboard
      initialCashOrders={cashOrders}
      initialReadyOrders={readyOrders}
      initialCollectedOrders={collectedOrders}
      catalog={catalog}
      paypalHandle={settings.paypal_handle ?? null}
      cafeName={settings.cafe_name ?? "Cafe Herzlich"}
    />
  );
}
