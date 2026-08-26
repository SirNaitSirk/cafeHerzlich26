"use client";

import { useEffect, useRef } from "react";

import type { AppEventType } from "@/lib/events";

/**
 * Subscribes to the server's SSE stream and invokes `onEvent` whenever one of
 * the given event types fires. The browser's EventSource reconnects on its own.
 *
 * Usage (signal-based): on an event, refetch the data you care about.
 *
 *   useEventStream(["orders:changed"], () => refetchOrders());
 */
export function useEventStream(
  types: AppEventType[],
  onEvent: () => void,
): void {
  // Keep the latest callback without re-opening the connection each render.
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const key = types.join(",");

  useEffect(() => {
    const source = new EventSource("/api/events");
    const handler = () => onEventRef.current();

    const eventTypes = key ? key.split(",") : [];
    for (const type of eventTypes) {
      source.addEventListener(type, handler);
    }

    return () => {
      for (const type of eventTypes) {
        source.removeEventListener(type, handler);
      }
      source.close();
    };
  }, [key]);
}
