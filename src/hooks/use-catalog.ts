"use client";

import { useCallback, useRef, useState } from "react";

import { useEventStream } from "@/hooks/use-event-stream";
import type { CatalogCategory } from "@/lib/catalog";

type UseCatalogResult = {
  categories: CatalogCategory[];
  hasError: boolean;
  /** Force an immediate refetch (used right after a mutation for snappy feedback). */
  refetch: () => void;
};

/**
 * Live active catalog (terminal shape). Seeds from server-rendered `initial`,
 * refetches on every `catalog:changed` SSE signal so the Kasse availability
 * panel stays in sync with the admin and the terminal.
 */
export function useCatalog(initial: CatalogCategory[]): UseCatalogResult {
  const [categories, setCategories] = useState<CatalogCategory[]>(initial);
  const [hasError, setHasError] = useState(false);
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

  useEventStream(["catalog:changed"], refetch);

  return { categories, hasError, refetch };
}
