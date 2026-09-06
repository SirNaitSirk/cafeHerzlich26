"use client";

import { useEffect, useRef } from "react";

import { playNewOrderChime } from "@/lib/sound";
import type { OrderWithItems } from "@/lib/orders";

/**
 * Plays a chime whenever a new order enters the given list. Detection is purely
 * client-side: it diffs order `id`s against the previously seen set, so it reuses
 * the live list already fetched by `useOrders` (no extra fetch, no own SSE).
 *
 * The first run seeds the known ids without sounding, so pre-existing orders on
 * load/refresh — and re-known ids after an SSE reconnect — never trigger a chime.
 * Multiple new orders in one update ring only once.
 */
export function useOrderChime(orders: OrderWithItems[], enabled: boolean): void {
  const knownIds = useRef<Set<number> | null>(null);

  useEffect(() => {
    const previous = knownIds.current;
    const currentIds = new Set(orders.map((order) => order.id));

    // First run: seed silently, no chime for already-open orders.
    if (previous === null) {
      knownIds.current = currentIds;
      return;
    }

    const hasNewOrder = orders.some((order) => !previous.has(order.id));
    knownIds.current = currentIds;

    if (hasNewOrder && enabled) {
      playNewOrderChime();
    }
  }, [orders, enabled]);
}
