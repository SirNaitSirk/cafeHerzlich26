"use client";

import { useEffect, useRef } from "react";

import type { AppEventType } from "@/lib/events";

/**
 * Subscribes to the server's SSE stream and invokes `onEvent` whenever one of
 * the given event types fires. The browser's EventSource reconnects on its own.
 *
 * `onEvent` also fires on every `open` — the initial connect and every
 * reconnect. Without that, changes broadcast while the connection was down
 * would be lost forever, because SSE does not replay them. Callers are
 * therefore expected to refetch (not patch) their state.
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

    // Bridges the gap of a dropped connection: whatever changed while the
    // stream was down is picked up by this refetch.
    source.addEventListener("open", handler);

    const eventTypes = key ? key.split(",") : [];
    for (const type of eventTypes) {
      source.addEventListener(type, handler);
    }

    return () => {
      source.removeEventListener("open", handler);
      for (const type of eventTypes) {
        source.removeEventListener(type, handler);
      }
      source.close();
    };
  }, [key]);
}
