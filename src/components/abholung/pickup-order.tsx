"use client";

import { motion } from "motion/react";
import { CheckIcon } from "lucide-react";

import { orderDisplayLabel } from "@/lib/order-label";
import type { OrderWithItems } from "@/lib/orders";
import { cn } from "@/lib/utils";

/**
 * One order tile on the public pickup board. A shared `layoutId` lets Framer
 * Motion animate the tile from the "in progress" column into the green "ready"
 * column the moment the kitchen marks it done.
 */
export function PickupOrder({
  order,
  variant,
}: {
  order: OrderWithItems;
  variant: "progress" | "ready";
}) {
  const isReady = variant === "ready";

  return (
    <motion.li
      layout
      layoutId={`pickup-order-${order.id}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className={cn(
        "flex items-center justify-between gap-4 rounded-2xl px-6 py-5 text-[clamp(1.75rem,3.2vw,3rem)] font-semibold leading-none tracking-tight",
        isReady
          ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 dark:bg-emerald-600"
          : "bg-card text-card-foreground ring-1 ring-border",
      )}
    >
      <span className="min-w-0 truncate">{orderDisplayLabel(order)}</span>
      {isReady && <CheckIcon className="size-[clamp(1.75rem,3vw,2.75rem)] shrink-0" />}
    </motion.li>
  );
}
