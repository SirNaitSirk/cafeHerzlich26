"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useEventStream } from "@/hooks/use-event-stream";
import type { OrderWithItems } from "@/lib/orders";

/** A surface scope understood by `GET /api/orders?scope=…`. */
export type OrdersScope = "kitchen" | "pickup" | "cash" | "ready" | "history" | "archive";

type UseOrdersResult = {
  orders: OrderWithItems[];
  /** True after a failed (re)fetch; the SSE stream keeps retrying in the background. */
  hasError: boolean;
};

/**
 * Live order list for a staff surface. Seeds from server-rendered `initial` data,
 * then refetches on every `orders:changed` SSE signal so all screens stay in sync
 * without a manual refresh. Reusable across Küche/Kasse/Abholung.
 */
export function useOrders(
  scope: OrdersScope,
  initial: OrderWithItems[],
): UseOrdersResult {
  const [orders, setOrders] = useState<OrderWithItems[]>(initial);
  const [hasError, setHasError] = useState(false);
  // Drop responses from a request that was superseded by a newer one.
  const requestId = useRef(0);

  const refetch = useCallback(async () => {
    // No synchronous setState here: state only changes after the fetch resolves.
    const current = ++requestId.current;
    try {
      const response = await fetch(`/api/orders?scope=${scope}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Unexpected status ${response.status}`);
      const data: { orders: OrderWithItems[] } = await response.json();
      if (current !== requestId.current) return;
      setOrders(data.orders);
      setHasError(false);
    } catch {
      if (current !== requestId.current) return;
      setHasError(true);
    }
  }, [scope]);

  // Refetch on (re)connect too: bridges any change missed before the stream opened.
  useEffect(() => {
    const timer = setTimeout(refetch, 0);
    return () => clearTimeout(timer);
  }, [refetch]);

  useEventStream(["orders:changed"], refetch);

  return { orders, hasError };
}
