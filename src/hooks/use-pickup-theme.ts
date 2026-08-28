"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useEventStream } from "@/hooks/use-event-stream";
import {
  PICKUP_THEMES,
  resolvePickupThemeKey,
  type PickupTheme,
  type PickupThemeKey,
} from "@/lib/pickup-themes";

/**
 * Live pickup-monitor theme. Seeds from the server-rendered `initial` key, then
 * refetches on every `catalog:changed` SSE signal so switching the design in the
 * admin dashboard repaints the TV instantly — no reload, no switch UI on the TV.
 */
export function usePickupTheme(initial: PickupThemeKey): PickupTheme {
  const [key, setKey] = useState<PickupThemeKey>(initial);
  // Drop responses from a request superseded by a newer one.
  const requestId = useRef(0);

  const refetch = useCallback(async () => {
    const current = ++requestId.current;
    try {
      const response = await fetch("/api/admin/settings", { cache: "no-store" });
      if (!response.ok) return;
      const data: { settings: Record<string, string> } = await response.json();
      if (current !== requestId.current) return;
      setKey(resolvePickupThemeKey(data.settings.pickup_theme));
    } catch {
      // Keep the current theme; the SSE stream keeps retrying in the background.
    }
  }, []);

  useEventStream(["catalog:changed"], refetch);

  // Bridge any change missed before the stream opened (e.g. after a reconnect).
  useEffect(() => {
    const timer = setTimeout(refetch, 0);
    return () => clearTimeout(timer);
  }, [refetch]);

  return PICKUP_THEMES[key];
}
