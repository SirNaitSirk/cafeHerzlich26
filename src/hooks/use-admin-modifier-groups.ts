"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useEventStream } from "@/hooks/use-event-stream";
import type { AdminModifierGroup } from "@/lib/admin-catalog";

type UseAdminModifierGroupsResult = {
  groups: AdminModifierGroup[];
  hasError: boolean;
  refetch: () => void;
};

/**
 * Live admin modifier groups. Seeds from server-rendered `initial`, refetches on
 * every `catalog:changed` SSE signal, and exposes a manual `refetch` for instant
 * feedback after a mutation. Mirrors `useAdminCatalog`.
 */
export function useAdminModifierGroups(
  initial: AdminModifierGroup[],
): UseAdminModifierGroupsResult {
  const [groups, setGroups] = useState<AdminModifierGroup[]>(initial);
  const [hasError, setHasError] = useState(false);
  const requestId = useRef(0);

  const refetch = useCallback(async () => {
    const current = ++requestId.current;
    try {
      const response = await fetch("/api/admin/modifier-groups", { cache: "no-store" });
      if (!response.ok) throw new Error(`Unexpected status ${response.status}`);
      const data: { groups: AdminModifierGroup[] } = await response.json();
      if (current !== requestId.current) return;
      setGroups(data.groups);
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

  return { groups, hasError, refetch };
}
