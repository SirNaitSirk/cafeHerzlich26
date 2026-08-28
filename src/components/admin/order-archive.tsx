"use client";

import { useMemo } from "react";
import { AnimatePresence } from "motion/react";
import { HistoryIcon, WifiOffIcon } from "lucide-react";

import { ArchiveOrderCard } from "@/components/admin/archive-order-card";
import { dayKey, formatDay } from "@/lib/format";
import { adminMessages as t } from "@/lib/messages";
import type { OrderWithItems } from "@/lib/orders";
import { useOrders } from "@/hooks/use-orders";

/** The moment an order reached its final state — same key order as the server sort. */
function resolvedAt(order: OrderWithItems): number {
  return order.cancelledAt ?? order.readyAt ?? order.paidConfirmedAt ?? order.createdAt;
}

type DayGroup = { key: string; label: string; orders: OrderWithItems[] };

/** Groups the already-sorted orders by calendar day, preserving newest-first order. */
function groupByDay(orders: OrderWithItems[]): DayGroup[] {
  const groups: DayGroup[] = [];
  let current: DayGroup | null = null;
  for (const order of orders) {
    const resolved = resolvedAt(order);
    const key = dayKey(resolved);
    if (!current || current.key !== key) {
      current = { key, label: formatDay(resolved), orders: [] };
      groups.push(current);
    }
    current.orders.push(order);
  }
  return groups;
}

/**
 * Permanent, read-only order archive for the admin dashboard: every order that
 * reached the kitchen, all days, grouped by date (newest first), live via SSE.
 * Carries no actions — nothing here can change or delete an order.
 */
export function OrderArchive({ initial }: { initial: OrderWithItems[] }) {
  const { orders, hasError } = useOrders("archive", initial);
  const groups = useMemo(() => groupByDay(orders), [orders]);

  if (orders.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
        <HistoryIcon className="size-10 text-muted-foreground/50" />
        <p className="text-muted-foreground">{t.archive.empty}</p>
        {hasError && (
          <span className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
            <WifiOffIcon className="size-4" />
            {t.archive.connectionLost}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{t.archive.title}</h2>
        <p className="text-sm text-muted-foreground">{t.archive.description}</p>
      </div>

      {hasError && (
        <span className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
          <WifiOffIcon className="size-4" />
          {t.archive.connectionLost}
        </span>
      )}

      {groups.map((group) => (
        <section key={group.key} className="space-y-3">
          <h3 className="sticky top-0 z-10 bg-background/80 py-1 text-sm font-medium capitalize text-muted-foreground backdrop-blur">
            {group.label}
          </h3>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {group.orders.map((order) => (
                <ArchiveOrderCard key={order.id} order={order} />
              ))}
            </AnimatePresence>
          </ul>
        </section>
      ))}
    </div>
  );
}
