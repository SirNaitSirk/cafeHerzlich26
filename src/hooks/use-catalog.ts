"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useEventStream } from "@/hooks/use-event-stream";
import type { CatalogCategory } from "@/lib/catalog";

type UseCatalogResult = {
  categories: CatalogCategory[];
  hasError: boolean;
  /**
   * Force an immediate refetch (used right after a mutation for snappy feedback,
   * and before entering an order flow). Resolves once the state is updated.
   */
  refetch: () => Promise<void>;
};

/**
 * Live active catalog (terminal shape). Seeds from server-rendered `initial`,
 * refetches on mount, on every SSE (re)connect and on every `catalog:changed`
 * signal — so the terminal and the Kasse availability panel always show what
 * the admin last set, without anyone reloading a tab.
 *
 * Must be used by a component that stays mounted for the life of the surface;
 * a hook that unmounts (e.g. inside a screen that is only rendered while
 * ordering) would stop listening and fall back to a stale snapshot.
 */
export function useCatalog(initial: CatalogCategory[]): UseCatalogResult {
  const [categories, setCategories] = useState<CatalogCategory[]>(initial);
  const [hasError, setHasError] = useState(false);
  // Drop responses from a request that was superseded by a newer one.
  const requestId = useRef(0);

  const refetch = useCallback(async () => {
    const current = ++requestId.current;
    try {
      const response = await fetch("/api/catalog", { cache: "no-store" });
      if (!response.ok) throw new Error(`Unexpected status ${response.status}`);
      const data: { categories: CatalogCategory[] } = await response.json();
      if (current !== requestId.current) return;
      setCategories(data.categories);
      setHasError(false);
    } catch {
      if (current !== requestId.current) return;
      setHasError(true);
    }
  }, []);

  // The server snapshot can already be stale by the time the client hydrates.
  useEffect(() => {
    const timer = setTimeout(refetch, 0);
    return () => clearTimeout(timer);
  }, [refetch]);

  useEventStream(["catalog:changed"], refetch);

  return { categories, hasError, refetch };
}
