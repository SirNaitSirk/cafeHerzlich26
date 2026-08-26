"use client";

import { useEffect, useState } from "react";

import { formatElapsed, waitLevel, type WaitLevel } from "@/lib/wait";

/**
 * Live waiting timer that ticks once per second on the client only (no server
 * polling). Given the order's start time (epoch ms), returns the elapsed mm:ss
 * string and an urgency level for color escalation.
 */
export function useWaitTimer(startMs: number): { label: string; level: WaitLevel } {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsed = Math.max(0, now - startMs);
  return { label: formatElapsed(elapsed), level: waitLevel(elapsed) };
}
