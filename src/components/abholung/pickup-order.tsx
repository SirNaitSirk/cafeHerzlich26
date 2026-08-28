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
        "flex items-center justify-between gap-[2vmin] rounded-2xl px-[3vmin] py-[2.2vmin] text-[clamp(2rem,5vmin,4.5rem)] font-semibold leading-none tracking-tight",
        isReady
          ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
          : "bg-white/[0.06] text-white ring-1 ring-white/15",
      )}
    >
      <span className="min-w-0 truncate">{orderDisplayLabel(order)}</span>
      {isReady && <CheckIcon className="size-[clamp(1.75rem,4.5vmin,4rem)] shrink-0" />}
    </motion.li>
  );
}
