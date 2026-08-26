"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { CheckIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWaitTimer } from "@/hooks/use-wait-timer";
import { kasseMessages as t } from "@/lib/messages";
import { orderDisplayLabel } from "@/lib/order-label";
import type { OrderWithItems } from "@/lib/orders";
import { cn } from "@/lib/utils";
import type { WaitLevel } from "@/lib/wait";

/** Timer read-out styling by how long the order has already been ready. */
const TIMER_STYLES: Record<WaitLevel, string> = {
  calm: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  critical: "text-red-600 dark:text-red-400",
};

/** One order ready for pickup. Shows how long it has waited; "Abgeholt" archives it. */
export function ReadyOrderCard({
  order,
  onCollect,
}: {
  order: OrderWithItems;
  onCollect: (id: number) => Promise<boolean>;
}) {
  // readyAt is stamped when the kitchen marks the order done; fall back defensively.
  const { label, level } = useWaitTimer(order.readyAt ?? order.createdAt);
  const [pending, setPending] = useState(false);

  async function handleCollect() {
    setPending(true);
    const ok = await onCollect(order.id);
    if (!ok) setPending(false); // on success the card animates out
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
      className="flex flex-col rounded-2xl border-2 border-emerald-500/60 bg-emerald-50/60 p-4 text-card-foreground shadow-sm dark:bg-emerald-950/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-2xl font-semibold tracking-tight">
            {orderDisplayLabel(order)}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{t.paymentBadge[order.paymentMethod]}</Badge>
            <Badge variant="ghost">{t.sourceBadge[order.source]}</Badge>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span className={cn("font-mono text-2xl font-semibold tabular-nums", TIMER_STYLES[level])}>
            {label}
          </span>
          <p className="text-xs text-muted-foreground">{t.ready.readyLabel}</p>
        </div>
      </div>

      <Button
        size="lg"
        onClick={handleCollect}
        disabled={pending}
        className="mt-4 h-14 bg-emerald-600 text-base text-white hover:bg-emerald-700"
      >
        <CheckIcon className="size-5" />
        {t.ready.action}
      </Button>
    </motion.li>
  );
}
