"use client";

import { motion } from "motion/react";

import { Badge } from "@/components/ui/badge";
import { formatEuros, formatTime } from "@/lib/format";
import { adminMessages as t } from "@/lib/messages";
import { orderDisplayLabel } from "@/lib/order-label";
import type { OrderWithItems } from "@/lib/orders";
import { cn } from "@/lib/utils";

const paymentBadge: Record<OrderWithItems["paymentMethod"], string> = {
  paypal: "PayPal",
  cash: "Bar",
};

const sourceBadge: Record<OrderWithItems["source"], string> = {
  terminal: "Terminal",
  kasse: "Kasse",
};

/** Status badge label + the moment the order reached its final state. */
function statusMeta(order: OrderWithItems): { label: string; when: string | null } {
  if (order.status === "cancelled") {
    return {
      label: t.archive.badge.cancelled,
      when: order.cancelledAt !== null ? t.archive.cancelledAt(formatTime(order.cancelledAt)) : null,
    };
  }
  if (order.status === "collected") {
    return {
      label: t.archive.badge.collected,
      when: order.readyAt !== null ? t.archive.collectedAt(formatTime(order.readyAt)) : null,
    };
  }
  if (order.status === "ready") {
    return {
      label: t.archive.badge.done,
      when: order.readyAt !== null ? t.archive.doneAt(formatTime(order.readyAt)) : null,
    };
  }
  // Still in the kitchen (paid, not yet done) — show when it was paid.
  return {
    label: t.archive.badge.done,
    when: order.paidConfirmedAt !== null ? t.archive.paidAt(formatTime(order.paidConfirmedAt)) : null,
  };
}

/**
 * A single read-only archive entry. Derived from the kitchen HistoryOrderCard but
 * carries no actions — the archive never changes an order's state — and it renders
 * the chosen modifier snapshots so the record is complete.
 */
export function ArchiveOrderCard({ order }: { order: OrderWithItems }) {
  const cancelled = order.status === "cancelled";
  const meta = statusMeta(order);

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
            <Badge variant="outline">{paymentBadge[order.paymentMethod]}</Badge>
            <Badge variant="ghost">{sourceBadge[order.source]}</Badge>
          </div>
        </div>
        {meta.when && (
          <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
            {meta.when}
          </span>
        )}
      </div>

      <ul className="mt-3 space-y-1.5 border-t pt-3 text-sm">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0">
              <span className="font-semibold tabular-nums">{item.quantity}×</span>{" "}
              <span className="text-foreground/90">{item.nameSnapshot}</span>
              {item.modifiers.length > 0 && (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {item.modifiers.map((mod) => mod.nameSnapshot).join(", ")}
                </span>
              )}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {formatEuros(item.unitPriceCents * item.quantity)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between border-t pt-3">
        <span className="text-sm text-muted-foreground">{t.archive.total}</span>
        <span className="font-semibold tabular-nums">{formatEuros(order.totalCents)}</span>
      </div>
    </motion.li>
  );
}
