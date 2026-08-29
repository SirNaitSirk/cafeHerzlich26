"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "motion/react";
import { PlusIcon, SlidersHorizontalIcon, WifiOffIcon } from "lucide-react";

import { CashOrderCard } from "@/components/kasse/cash-order-card";
import { ReadyOrderCard } from "@/components/kasse/ready-order-card";
import { OrderFlow } from "@/components/terminal/order-flow";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { useOrders } from "@/hooks/use-orders";
import type { CatalogCategory } from "@/lib/catalog";
import { kasseMessages as t } from "@/lib/messages";
import type { OrderWithItems } from "@/lib/orders";

/** Sends a single-action PATCH and reports whether it succeeded (with a toast). */
async function patchOrder(id: number, action: "cash" | "collect", successMessage: string) {
  try {
    const response = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (response.ok) {
      toast.success(successMessage);
      return true;
    }
    toast.error(response.status === 409 ? t.toasts.gone : t.toasts.generic);
    return false;
  } catch {
    toast.error(t.toasts.generic);
    return false;
  }
}

export function KasseDashboard({
  initialCashOrders,
  initialReadyOrders,
  catalog,
  paypalHandle,
  cafeName,
}: {
  initialCashOrders: OrderWithItems[];
  initialReadyOrders: OrderWithItems[];
  catalog: CatalogCategory[];
  paypalHandle: string | null;
  cafeName: string;
}) {
  const { orders: cashOrders, hasError: cashError } = useOrders("cash", initialCashOrders);
  const { orders: readyOrders, hasError: readyError } = useOrders("ready", initialReadyOrders);
  const [ordering, setOrdering] = useState(false);

  const confirmCash = useCallback(
    (id: number) => patchOrder(id, "cash", t.toasts.cashSuccess),
    [],
  );
  const collect = useCallback(
    (id: number) => patchOrder(id, "collect", t.toasts.collectSuccess),
    [],
  );

  // The on-behalf ordering flow takes over the whole screen when active.
  if (ordering) {
    return (
      <>
        <OrderFlow
          paypalHandle={paypalHandle}
          cafeName={cafeName}
          initialCatalog={catalog}
          source="kasse"
          onExit={() => setOrdering(false)}
          onComplete={() => setOrdering(false)}
        />
        <Toaster position="top-center" richColors />
      </>
    );
  }

  const hasError = cashError || readyError;

  return (
    <div className="flex h-dvh flex-col bg-muted/30">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-background/90 px-6 py-4 backdrop-blur">
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <div className="flex items-center gap-3">
          {hasError && (
            <span className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
              <WifiOffIcon className="size-4" />
              {t.connectionLost}
            </span>
          )}
          <Button asChild size="lg" variant="outline" className="h-12 text-base">
            <Link href="/admin">
              <SlidersHorizontalIcon className="size-5" />
              {t.admin}
            </Link>
          </Button>
          <Button size="lg" className="h-12 text-base" onClick={() => setOrdering(true)}>
            <PlusIcon className="size-5" />
            {t.newOrder}
          </Button>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-8 overflow-hidden p-6 lg:grid-cols-2">
        <section className="flex min-h-0 flex-col">
          <header className="mb-4 flex items-baseline justify-between gap-4">
            <h2 className="text-xl font-semibold tracking-tight">{t.cash.heading}</h2>
            <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium tabular-nums text-secondary-foreground">
              {t.cash.count(cashOrders.length)}
            </span>
          </header>
          <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
            {cashOrders.length === 0 ? (
              <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
                {t.cash.empty}
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <AnimatePresence mode="popLayout">
                  {cashOrders.map((order) => (
                    <CashOrderCard key={order.id} order={order} onConfirm={confirmCash} />
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col">
          <header className="mb-4 flex items-baseline justify-between gap-4">
            <h2 className="text-xl font-semibold tracking-tight text-emerald-700 dark:text-emerald-400">
              {t.ready.heading}
            </h2>
            <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium tabular-nums text-secondary-foreground">
              {t.ready.count(readyOrders.length)}
            </span>
          </header>
          <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
            {readyOrders.length === 0 ? (
              <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
                {t.ready.empty}
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <AnimatePresence mode="popLayout">
                  {readyOrders.map((order) => (
                    <ReadyOrderCard key={order.id} order={order} onCollect={collect} />
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </section>
      </main>

      <Toaster position="top-center" richColors />
    </div>
  );
}
