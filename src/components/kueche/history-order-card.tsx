"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { RotateCcwIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatEuros, formatTime } from "@/lib/format";
import { kitchenMessages as t } from "@/lib/messages";
import { orderDisplayLabel } from "@/lib/order-label";
import type { OrderWithItems } from "@/lib/orders";
import { cn } from "@/lib/utils";

/** True for orders that were deleted (soft-cancelled) — the only restorable ones. */
function isCancelled(order: OrderWithItems): boolean {
  return order.status === "cancelled";
}

/** Status badge label + the moment the order left the kitchen. */
function statusMeta(order: OrderWithItems): { label: string; when: string | null } {
  if (order.status === "cancelled") {
    return {
      label: t.history.badge.cancelled,
      when: order.cancelledAt !== null ? t.history.cancelledAt(formatTime(order.cancelledAt)) : null,
    };
  }
  const label = order.status === "collected" ? t.history.badge.collected : t.history.badge.done;
  return {
    label,
    when: order.readyAt !== null ? t.history.doneAt(formatTime(order.readyAt)) : null,
  };
}

export function HistoryOrderCard({
  order,
  onRestore,
}: {
  order: OrderWithItems;
  onRestore: (id: number) => Promise<boolean>;
}) {
  const cancelled = isCancelled(order);
  const meta = statusMeta(order);
  const [pending, setPending] = useState(false);

  async function handleRestore() {
    setPending(true);
    const ok = await onRestore(order.id);
    if (!ok) setPending(false); // on success the card animates out of the history
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 400, damping: 34 }}
      className={cn(
        "flex flex-col rounded-2xl border-2 p-4",
        cancelled
          ? "border-red-500/50 bg-red-50/50 dark:bg-red-950/15"
          : "border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/15",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            className={cn(
              "truncate text-xl font-semibold tracking-tight",
              cancelled && "text-muted-foreground line-through decoration-red-500/60",
            )}
          >
            {orderDisplayLabel(order)}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge
              className={cn(
                "border-transparent text-white",
                cancelled ? "bg-red-600" : "bg-emerald-600",
              )}
            >
              {meta.label}
            </Badge>
            <Badge variant="outline">{t.paymentBadge[order.paymentMethod]}</Badge>
            <Badge variant="ghost">{t.sourceBadge[order.source]}</Badge>
          </div>
        </div>
        {meta.when && (
          <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
            {meta.when}
          </span>
        )}
      </div>

      <ul className="mt-3 space-y-1 border-t pt-3 text-sm">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0">
              <span className="font-semibold tabular-nums">{item.quantity}×</span>{" "}
              <span className="text-foreground/90">{item.nameSnapshot}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {formatEuros(item.unitPriceCents * item.quantity)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between border-t pt-3">
        <span className="text-sm text-muted-foreground">{t.edit.total}</span>
        <span className="font-semibold tabular-nums">{formatEuros(order.totalCents)}</span>
      </div>

      {cancelled && (
        <Button
          variant="outline"
          className="mt-4 h-12 text-base"
          onClick={handleRestore}
          disabled={pending}
        >
          <RotateCcwIcon className="size-5" />
          {t.history.restore}
        </Button>
      )}
    </motion.li>
  );
}
