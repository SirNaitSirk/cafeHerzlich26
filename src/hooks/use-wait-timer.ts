"use client";

import { useEffect, useState } from "react";

import { formatElapsed, waitLevel, type WaitLevel } from "@/lib/wait";

/**
 * Live waiting timer that ticks once per second on the client only (no server
 * polling). Given the order's start time (epoch ms), returns the elapsed mm:ss
 * string and an urgency level for color escalation.
 */
export function useWaitTimer(startMs: number): { label: string; level: WaitLevel } {
  // Start deterministic (elapsed 0) so SSR and the first client render match;
  // the effect below only runs on the client and switches to real elapsed time.
  const [now, setNow] = useState(startMs);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick(); // jump to the real elapsed time immediately after mount
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsed = Math.max(0, now - startMs);
  return { label: formatElapsed(elapsed), level: waitLevel(elapsed) };
}
