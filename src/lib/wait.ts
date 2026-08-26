/**
 * Waiting-time urgency for the kitchen monitor. Pure, client-safe (no server-only
 * imports) so both the timer hook and the order card share one source of truth.
 */

/** How long a guest has waited before the order is flagged more urgent (ms). */
export const WAIT_URGENCY_THRESHOLDS_MS = {
  /** From here the card turns amber. */
  warning: 5 * 60 * 1000,
  /** From here the card turns red. */
  critical: 10 * 60 * 1000,
} as const;

export type WaitLevel = "calm" | "warning" | "critical";

/** Maps an elapsed duration (ms) to an urgency level. */
export function waitLevel(elapsedMs: number): WaitLevel {
  if (elapsedMs >= WAIT_URGENCY_THRESHOLDS_MS.critical) return "critical";
  if (elapsedMs >= WAIT_URGENCY_THRESHOLDS_MS.warning) return "warning";
  return "calm";
}

/** Formats an elapsed duration (ms) as mm:ss (minutes uncapped, e.g. "72:04"). */
export function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
