"use client";

import { useMemo } from "react";
import { AnimatePresence, LayoutGroup, MotionConfig } from "motion/react";
import { CoffeeIcon, WifiOffIcon } from "lucide-react";

import { PickupOrder } from "@/components/abholung/pickup-order";
import { useOrders } from "@/hooks/use-orders";
import { pickupMessages as t } from "@/lib/messages";
import type { OrderWithItems } from "@/lib/orders";

/** A single glanceable column (in-progress or ready). */
function Column({
  heading,
  count,
  accent,
  children,
}: {
  heading: string;
  count: string;
  accent: "neutral" | "ready";
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-h-0 flex-col">
      <header className="mb-5 flex items-baseline justify-between gap-4">
        <h2
          className={
            accent === "ready"
              ? "text-[clamp(1.75rem,3vw,2.75rem)] font-bold tracking-tight text-emerald-600 dark:text-emerald-400"
              : "text-[clamp(1.75rem,3vw,2.75rem)] font-bold tracking-tight text-foreground"
          }
        >
          {heading}
        </h2>
        <span className="text-[clamp(1rem,1.6vw,1.5rem)] font-medium tabular-nums text-muted-foreground">
          {count}
        </span>
      </header>
      <ul className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        <AnimatePresence mode="popLayout">{children}</AnimatePresence>
      </ul>
    </section>
  );
}

export function PickupBoard({
  cafeName,
  initialOrders,
}: {
  cafeName: string;
  initialOrders: OrderWithItems[];
}) {
  const { orders, hasError } = useOrders("pickup", initialOrders);

  // In progress: oldest first. Ready: newest-ready on top, so a fresh "ready"
  // pops to the top with its animation where a waiting guest will notice it.
  const { inProgress, ready } = useMemo(() => {
    const inProgress = orders
      .filter((order) => order.status === "in_kitchen")
      .sort((a, b) => a.createdAt - b.createdAt);
    const ready = orders
      .filter((order) => order.status === "ready")
      .sort((a, b) => (b.readyAt ?? 0) - (a.readyAt ?? 0));
    return { inProgress, ready };
  }, [orders]);

  const isEmpty = inProgress.length === 0 && ready.length === 0;

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex h-dvh flex-col bg-muted/30 p-8 lg:p-10">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CoffeeIcon className="size-8 text-primary" />
            <h1 className="text-[clamp(1.5rem,2.6vw,2.5rem)] font-bold tracking-tight">
              {cafeName}
            </h1>
          </div>
          {hasError && (
            <span className="flex items-center gap-2 text-[clamp(0.9rem,1.4vw,1.25rem)] text-amber-600 dark:text-amber-400">
              <WifiOffIcon className="size-5" />
              {t.connectionLost}
            </span>
          )}
        </header>

        {isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <CoffeeIcon className="size-20 text-muted-foreground/40" />
            <p className="text-[clamp(1.75rem,3.5vw,3.5rem)] font-bold tracking-tight">
              {t.empty.title}
            </p>
            <p className="max-w-2xl text-[clamp(1rem,1.8vw,1.75rem)] text-muted-foreground">
              {t.empty.hint}
            </p>
          </div>
        ) : (
          <LayoutGroup>
            <div className="grid min-h-0 flex-1 grid-cols-2 gap-8 lg:gap-10">
              <Column
                heading={t.inProgress.heading}
                count={t.inProgress.count(inProgress.length)}
                accent="neutral"
              >
                {inProgress.map((order) => (
                  <PickupOrder key={order.id} order={order} variant="progress" />
                ))}
              </Column>
              <Column
                heading={t.ready.heading}
                count={t.ready.count(ready.length)}
                accent="ready"
              >
                {ready.map((order) => (
                  <PickupOrder key={order.id} order={order} variant="ready" />
                ))}
              </Column>
            </div>
          </LayoutGroup>
        )}
      </div>
    </MotionConfig>
  );
}
