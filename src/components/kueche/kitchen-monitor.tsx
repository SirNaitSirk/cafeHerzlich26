"use client";

import { useCallback, useState } from "react";
import { AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { ChefHatIcon, HistoryIcon, WifiOffIcon } from "lucide-react";

import { OrderCard } from "@/components/kueche/order-card";
import { OrderHistory } from "@/components/kueche/order-history";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { useOrders } from "@/hooks/use-orders";
import { kitchenMessages as t } from "@/lib/messages";
import type { OrderWithItems, UpdateOrderInput } from "@/lib/orders";

/** Parses a JSON error body without throwing on empty/invalid responses. */
async function readError(response: Response): Promise<string | null> {
  try {
    const data = await response.json();
    return typeof data?.error === "string" ? data.error : null;
  } catch {
    return null;
  }
}

export function KitchenMonitor({ initialOrders }: { initialOrders: OrderWithItems[] }) {
  const { orders, hasError } = useOrders("kitchen", initialOrders);
  const [historyOpen, setHistoryOpen] = useState(false);

  const markDone = useCallback(async (id: number): Promise<boolean> => {
    try {
      const response = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ready" }),
      });
      if (response.ok) {
        toast.success(t.toasts.doneSuccess);
        return true;
      }
      toast.error(response.status === 409 ? t.toasts.gone : t.toasts.generic);
      return false;
    } catch {
      toast.error(t.toasts.generic);
      return false;
    }
  }, []);

  const deleteOrder = useCallback(async (id: number): Promise<boolean> => {
    try {
      const response = await fetch(`/api/orders/${id}`, { method: "DELETE" });
      if (response.ok) {
        toast.success(t.toasts.deleteSuccess);
        return true;
      }
      toast.error(response.status === 409 ? t.toasts.gone : t.toasts.generic);
      return false;
    } catch {
      toast.error(t.toasts.generic);
      return false;
    }
  }, []);

  const updateOrder = useCallback(
    async (id: number, input: UpdateOrderInput): Promise<boolean> => {
      try {
        const response = await fetch(`/api/orders/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update", ...input }),
        });
        if (response.ok) {
          toast.success(t.toasts.saveSuccess);
          return true;
        }
        if (response.status === 409) {
          const message = await readError(response);
          toast.error(message ?? t.toasts.stock);
          return false;
        }
        toast.error(t.toasts.generic);
        return false;
      } catch {
        toast.error(t.toasts.generic);
        return false;
      }
    },
    [],
  );

  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-background/90 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <ChefHatIcon className="size-7 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          {hasError && (
            <span className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
              <WifiOffIcon className="size-4" />
              {t.connectionLost}
            </span>
          )}
          <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium tabular-nums text-secondary-foreground">
            {t.openCount(orders.length)}
          </span>
          <Button variant="outline" size="lg" onClick={() => setHistoryOpen(true)}>
            <HistoryIcon className="size-5" />
            {t.history.open}
          </Button>
        </div>
      </header>

      <main className="p-6">
        {orders.length === 0 ? (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-center">
            <ChefHatIcon className="size-12 text-muted-foreground/50" />
            <p className="text-xl font-medium">{t.empty.title}</p>
            <p className="text-muted-foreground">{t.empty.hint}</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onDone={markDone}
                  onDelete={deleteOrder}
                  onUpdate={updateOrder}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </main>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t.history.title}</DialogTitle>
            <DialogDescription>{t.history.description}</DialogDescription>
          </DialogHeader>
          {historyOpen && <OrderHistory />}
        </DialogContent>
      </Dialog>

      <Toaster position="top-center" richColors />
    </div>
  );
}
