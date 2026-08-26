"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useEventStream } from "@/hooks/use-event-stream";
import type { AdminCategory } from "@/lib/admin-catalog";

type UseAdminCatalogResult = {
  categories: AdminCategory[];
  hasError: boolean;
  /** Force an immediate refetch (used right after a mutation for snappy feedback). */
  refetch: () => void;
};

/**
 * Live admin catalog. Seeds from server-rendered `initial`, refetches on every
 * `catalog:changed` SSE signal so two admin devices (and the terminal) stay in
 * sync, and exposes a manual `refetch` for instant feedback after a mutation.
 */
export function useAdminCatalog(initial: AdminCategory[]): UseAdminCatalogResult {
  const [categories, setCategories] = useState<AdminCategory[]>(initial);
  const [hasError, setHasError] = useState(false);
  const requestId = useRef(0);

  const refetch = useCallback(async () => {
    const current = ++requestId.current;
    try {
      const response = await fetch("/api/admin/catalog", { cache: "no-store" });
      if (!response.ok) throw new Error(`Unexpected status ${response.status}`);
      const data: { categories: AdminCategory[] } = await response.json();
      if (current !== requestId.current) return;
      setCategories(data.categories);
      setHasError(false);
    } catch {
      if (current !== requestId.current) return;
      setHasError(true);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(refetch, 0);
    return () => clearTimeout(timer);
  }, [refetch]);

  useEventStream(["catalog:changed"], refetch);

  return { categories, hasError, refetch };
}
