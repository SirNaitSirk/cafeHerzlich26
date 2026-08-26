"use client";

import { useCallback } from "react";
import { AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { HistoryIcon, WifiOffIcon } from "lucide-react";

import { HistoryOrderCard } from "@/components/kueche/history-order-card";
import { useOrders } from "@/hooks/use-orders";
import { kitchenMessages as t } from "@/lib/messages";

/**
 * Kitchen history: today's done + deleted orders, newest first, live via SSE.
 * Only deleted (cancelled) orders can be restored back into the kitchen. Mounts
 * on demand (when the history dialog opens) so nothing loads until needed.
 */
export function OrderHistory() {
  const { orders, hasError } = useOrders("history", []);

  const restore = useCallback(async (id: number): Promise<boolean> => {
    try {
      const response = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      });
      if (response.ok) {
        toast.success(t.history.toasts.restoreSuccess);
        return true;
      }
      toast.error(response.status === 409 ? t.history.toasts.gone : t.history.toasts.generic);
      return false;
    } catch {
      toast.error(t.history.toasts.generic);
      return false;
    }
  }, []);

  if (orders.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
        <HistoryIcon className="size-10 text-muted-foreground/50" />
        <p className="text-muted-foreground">{t.history.empty}</p>
        {hasError && (
          <span className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
            <WifiOffIcon className="size-4" />
            {t.history.connectionLost}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {hasError && (
        <span className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
          <WifiOffIcon className="size-4" />
          {t.history.connectionLost}
        </span>
      )}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {orders.map((order) => (
            <HistoryOrderCard key={order.id} order={order} onRestore={restore} />
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
