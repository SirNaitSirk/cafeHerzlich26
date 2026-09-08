"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  ChevronDownIcon,
  EyeOffIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  WifiOffIcon,
} from "lucide-react";

import { AvailabilityPanel } from "@/components/kasse/availability-panel";
import { CashOrderCard } from "@/components/kasse/cash-order-card";
import { CashRegisterDialog } from "@/components/kasse/cash-register-dialog";
import { CollectedOrderCard } from "@/components/kasse/collected-order-card";
import { ReadyOrderCard } from "@/components/kasse/ready-order-card";
import { OrderFlow, type CreatedOrder } from "@/components/terminal/order-flow";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { useCatalog } from "@/hooks/use-catalog";
import { useOrders } from "@/hooks/use-orders";
import type { CatalogCategory } from "@/lib/catalog";
import { kasseMessages as t } from "@/lib/messages";
import type { OrderWithItems } from "@/lib/orders";
import { cn } from "@/lib/utils";

/** Sends a single-action PATCH and reports whether it succeeded (with a toast). */
async function patchOrder(
  id: number,
  action: "cash" | "collect" | "uncollect",
  successMessage: string,
  options?: {
    /** 409 copy, when "no longer open" is the wrong wording for this action. */
    goneMessage?: string;
    /** Extra button on the success toast — used for the "Abgeholt" undo. */
    successAction?: { label: string; onClick: () => void };
  },
) {
  try {
    const response = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (response.ok) {
      toast.success(successMessage, { action: options?.successAction });
      return true;
    }
    toast.error(
      response.status === 409 ? (options?.goneMessage ?? t.toasts.gone) : t.toasts.generic,
    );
    return false;
  } catch {
    toast.error(t.toasts.generic);
    return false;
  }
}

/** Cancels an order (DELETE) and reports whether it succeeded (with a toast). */
async function cancelOrder(id: number): Promise<boolean> {
  try {
    const response = await fetch(`/api/orders/${id}`, { method: "DELETE" });
    if (response.ok) {
      toast.success(t.toasts.cancelSuccess);
      return true;
    }
    toast.error(response.status === 409 ? t.toasts.cancelGone : t.toasts.generic);
    return false;
  } catch {
    toast.error(t.toasts.generic);
    return false;
  }
}

export function KasseDashboard({
  initialCashOrders,
  initialReadyOrders,
  initialCollectedOrders,
  catalog,
  paypalHandle,
  cafeName,
}: {
  initialCashOrders: OrderWithItems[];
  initialReadyOrders: OrderWithItems[];
  initialCollectedOrders: OrderWithItems[];
  catalog: CatalogCategory[];
  paypalHandle: string | null;
  cafeName: string;
}) {
  const { orders: cashOrders, hasError: cashError } = useOrders("cash", initialCashOrders);
  const { orders: readyOrders, hasError: readyError } = useOrders("ready", initialReadyOrders);
  const { orders: collectedOrders, hasError: collectedError } = useOrders(
    "collected",
    initialCollectedOrders,
  );
  // Owned here so it keeps listening while the dashboard is showing the queues:
  // the ordering flow and the availability panel both unmount, and would
  // otherwise fall back to the server snapshot from the last page load.
  const {
    categories,
    hasError: catalogError,
    refetch: refetchCatalog,
  } = useCatalog(catalog);
  const [ordering, setOrdering] = useState(false);
  const [managingAvailability, setManagingAvailability] = useState(false);
  // A cash order just taken on behalf of a guest: settled right away in the
  // register dialog instead of being hunted down in the queue afterwards.
  const [pendingCashOrder, setPendingCashOrder] = useState<CreatedOrder | null>(null);
  const [settling, setSettling] = useState(false);
  // Today's pickups stay one tap away, but folded — the open queues come first.
  const [showCollected, setShowCollected] = useState(false);

  // A direct sale is settled and handed over in the same moment, so it gets its
  // own wording — "an die Küche übergeben" would be a lie at the counter.
  const confirmCash = useCallback(
    (id: number, directSale: boolean) =>
      patchOrder(
        id,
        "cash",
        directSale ? t.toasts.directSaleSuccess : t.toasts.cashSuccess,
      ),
    [],
  );
  // Taking a pickup back is its own status change (collected → ready), so it also
  // works long after the toast is gone — from the "Zuletzt abgeholt" list.
  const uncollect = useCallback(
    (id: number) =>
      patchOrder(id, "uncollect", t.toasts.uncollectSuccess, {
        goneMessage: t.toasts.uncollectGone,
      }),
    [],
  );
  const collect = useCallback(
    (id: number) =>
      patchOrder(id, "collect", t.toasts.collectSuccess, {
        successAction: { label: t.ready.undo, onClick: () => void uncollect(id) },
      }),
    [uncollect],
  );

  // A cash order placed at the till goes straight into the register dialog and
  // closes the ordering flow at once: the guest-facing success screen ("please
  // pay at the till") is meaningless here, so the queues stay behind the dialog.
  // A PayPal one keeps the plain flow unless it is a direct sale. Cancelling the
  // register dialog leaves the order in the cash queue.
  const handleOrderCreated = useCallback((order: CreatedOrder) => {
    if (order.method === "cash") {
      setPendingCashOrder(order);
      setOrdering(false);
      return;
    }
    // A paid PayPal direct sale is already done — it is handed over across the
    // counter, so the guest-facing "please wait at the counter" success screen
    // would be wrong. Close the flow and say what has to happen instead.
    if (order.directSale) {
      setOrdering(false);
      toast.success(t.toasts.directSaleSuccess);
    }
  }, []);

  const settlePendingCashOrder = useCallback(async () => {
    if (!pendingCashOrder) return;
    setSettling(true);
    const ok = await confirmCash(pendingCashOrder.id, pendingCashOrder.directSale);
    setSettling(false);
    if (ok) {
      setPendingCashOrder(null);
      setOrdering(false);
    }
  }, [confirmCash, pendingCashOrder]);

  // Rendered above whichever screen is active, so it survives the order flow
  // unmounting itself (the success screen auto-returns after a few seconds).
  const cashRegister = pendingCashOrder ? (
    <CashRegisterDialog
      order={pendingCashOrder}
      open
      onOpenChange={(open) => {
        if (!open && !settling) setPendingCashOrder(null);
      }}
      onConfirm={() => void settlePendingCashOrder()}
      pending={settling}
    />
  ) : null;

  // The on-behalf ordering flow takes over the whole screen when active.
  if (ordering) {
    return (
      <>
        <OrderFlow
          paypalHandle={paypalHandle}
          cafeName={cafeName}
          categories={categories}
          refetchCatalog={refetchCatalog}
          source="kasse"
          onExit={() => setOrdering(false)}
          onComplete={() => setOrdering(false)}
          onOrderCreated={handleOrderCreated}
        />
        {cashRegister}
        <Toaster position="top-center" richColors />
      </>
    );
  }

  // The availability panel takes over the whole screen when active.
  if (managingAvailability) {
    return (
      <>
        <AvailabilityPanel
          categories={categories}
          hasError={catalogError}
          refetchCatalog={refetchCatalog}
          onExit={() => setManagingAvailability(false)}
        />
        <Toaster position="top-center" richColors />
      </>
    );
  }

  const hasError = cashError || readyError || collectedError;

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
          <Button
            size="lg"
            variant="outline"
            className="h-12 text-base"
            onClick={() => setManagingAvailability(true)}
          >
            <EyeOffIcon className="size-5" />
            {t.availability.open}
          </Button>
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

          {collectedOrders.length > 0 && (
            <div className="mt-4 shrink-0 border-t pt-3">
              <button
                type="button"
                onClick={() => setShowCollected((open) => !open)}
                className="flex h-12 w-full items-center justify-between gap-3 rounded-xl px-2 text-left text-muted-foreground transition-colors hover:bg-muted/60"
              >
                <span className="flex items-baseline gap-2">
                  <span className="text-base font-medium">{t.collected.heading}</span>
                  <span className="text-sm tabular-nums">
                    {t.collected.count(collectedOrders.length)}
                  </span>
                </span>
                <span className="flex items-center gap-2 text-sm">
                  {showCollected ? t.collected.collapse : t.collected.expand}
                  <ChevronDownIcon
                    className={cn(
                      "size-5 transition-transform",
                      showCollected && "rotate-180",
                    )}
                  />
                </span>
              </button>

              <AnimatePresence initial={false}>
                {showCollected && (
                  <motion.div
                    key="collected"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <p className="px-2 pt-1 text-sm text-muted-foreground">
                      {t.collected.hint}
                    </p>
                    <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
                      <AnimatePresence mode="popLayout">
                        {collectedOrders.map((order) => (
                          <CollectedOrderCard
                            key={order.id}
                            order={order}
                            onUncollect={uncollect}
                            onCancel={cancelOrder}
                          />
                        ))}
                      </AnimatePresence>
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </section>
      </main>

      {cashRegister}
      <Toaster position="top-center" richColors />
    </div>
  );
}
