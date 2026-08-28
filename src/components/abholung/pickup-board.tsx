"use client";

import { useMemo } from "react";
import { AnimatePresence, LayoutGroup, MotionConfig } from "motion/react";
import { CoffeeIcon, WifiOffIcon } from "lucide-react";

import { PickupOrder } from "@/components/abholung/pickup-order";
import { useOrders } from "@/hooks/use-orders";
import { pickupMessages as t } from "@/lib/messages";
import type { OrderWithItems } from "@/lib/orders";
import { cn } from "@/lib/utils";

/** A single glanceable section (in-progress or ready). */
function Section({
  heading,
  count,
  accent,
  className,
  children,
}: {
  heading: string;
  count: string;
  accent: "neutral" | "ready";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("flex min-h-0 flex-col", className)}>
      <header className="mb-[1.2vmin] flex items-baseline justify-between gap-[2vmin]">
        <h2
          className={cn(
            "text-[clamp(2rem,5vmin,4.5rem)] font-bold tracking-tight",
            accent === "ready" ? "text-emerald-400" : "text-white/85",
          )}
        >
          {heading}
        </h2>
        <span className="text-[clamp(1.1rem,2.4vmin,2.25rem)] font-medium tabular-nums text-white/45">
          {count}
        </span>
      </header>
      <ul className="flex min-h-0 flex-1 flex-col gap-[1.4vmin] overflow-y-auto pr-1">
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
      {/* Solid dark fill + generous safe-margins so nothing hugs the TV overscan edge. */}
      <div className="flex h-dvh flex-col bg-neutral-950 p-[4vmin] text-white portrait:py-[5vmin]">
        <header className="mb-[3vmin] flex items-center justify-between gap-[2vmin]">
          <div className="flex items-center gap-[1.5vmin]">
            <CoffeeIcon className="size-[clamp(2rem,4.5vmin,4rem)] text-primary" />
            <h1 className="text-[clamp(1.75rem,4vmin,3.75rem)] font-bold tracking-tight">
              {cafeName}
            </h1>
          </div>
          {hasError && (
            <span className="flex items-center gap-2 text-[clamp(1rem,2vmin,1.75rem)] text-amber-400">
              <WifiOffIcon className="size-[clamp(1.25rem,2.4vmin,2rem)]" />
              {t.connectionLost}
            </span>
          )}
        </header>

        {isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-[2.5vmin] text-center">
            <CoffeeIcon className="size-[clamp(5rem,14vmin,12rem)] text-white/15" />
            <p className="text-[clamp(2rem,6vmin,5rem)] font-bold tracking-tight">
              {t.empty.title}
            </p>
            <p className="max-w-[40ch] text-[clamp(1.1rem,2.8vmin,2.5rem)] text-white/45">
              {t.empty.hint}
            </p>
          </div>
        ) : (
          <LayoutGroup>
            {/*
             * One markup for both orientations so `layoutId` tiles animate across
             * sections. Landscape → two side-by-side columns (in progress left,
             * ready right). Portrait → stacked with "Abholbereit" pulled on top.
             */}
            <div className="grid min-h-0 flex-1 gap-[3vmin] portrait:grid-cols-1 portrait:grid-rows-[3fr_2fr] landscape:grid-cols-2 landscape:grid-rows-1">
              <Section
                heading={t.ready.heading}
                count={t.ready.count(ready.length)}
                accent="ready"
                // Ready first (top) in portrait; right column in landscape.
                className="portrait:order-1 landscape:order-2"
              >
                {ready.map((order) => (
                  <PickupOrder key={order.id} order={order} variant="ready" />
                ))}
              </Section>
              <Section
                heading={t.inProgress.heading}
                count={t.inProgress.count(inProgress.length)}
                accent="neutral"
                className="portrait:order-2 landscape:order-1"
              >
                {inProgress.map((order) => (
                  <PickupOrder key={order.id} order={order} variant="progress" />
                ))}
              </Section>
            </div>
          </LayoutGroup>
        )}
      </div>
    </MotionConfig>
  );
}
