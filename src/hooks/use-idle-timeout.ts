"use client";

import { useEffect, useRef } from "react";

/** Idle timeout for the terminal: after this long with no interaction, reset to welcome. */
export const IDLE_TIMEOUT_MS = 90_000;

/**
 * Calls `onIdle` after `timeoutMs` of no user interaction. Any pointer/key/touch
 * activity resets the timer. Pass `enabled: false` on the welcome screen (nothing
 * to time out from there).
 */
export function useIdleTimeout(
  onIdle: () => void,
  { enabled = true, timeoutMs = IDLE_TIMEOUT_MS }: { enabled?: boolean; timeoutMs?: number } = {},
): void {
  const onIdleRef = useRef(onIdle);
  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => onIdleRef.current(), timeoutMs);
    };

    const events: (keyof WindowEventMap)[] = [
      "pointerdown",
      "pointermove",
      "keydown",
      "touchstart",
      "wheel",
    ];
    for (const event of events) {
      window.addEventListener(event, reset, { passive: true });
    }
    reset();

    return () => {
      clearTimeout(timer);
      for (const event of events) {
        window.removeEventListener(event, reset);
      }
    };
  }, [enabled, timeoutMs]);
}
