import "server-only";

import { EventEmitter } from "node:events";

/**
 * In-process event bus for real-time sync across all screens.
 *
 * The app runs as a single long-running Node process on the Pi, so in-memory
 * pub/sub is safe and fast. Every mutation route handler broadcasts here; the
 * SSE endpoint (`/api/events`) forwards events to every connected screen.
 *
 * Events are lightweight SIGNALS, not full payloads: a client that receives
 * `orders:changed` refetches the order list it cares about. This keeps the bus
 * trivial and avoids fragile client-side diff patching.
 */

export type AppEvent =
  | { type: "orders:changed" }
  | { type: "catalog:changed" };

export type AppEventType = AppEvent["type"];

const globalForBus = globalThis as unknown as {
  appEventBus?: EventEmitter;
};

const bus = globalForBus.appEventBus ?? new EventEmitter();
// Many screens may subscribe at once; lift the default listener cap.
bus.setMaxListeners(0);
globalForBus.appEventBus = bus;

const CHANNEL = "event";

/** Broadcast an event to all connected screens. */
export function broadcast(event: AppEvent): void {
  bus.emit(CHANNEL, event);
}

/** Subscribe to all events. Returns an unsubscribe function. */
export function subscribe(listener: (event: AppEvent) => void): () => void {
  bus.on(CHANNEL, listener);
  return () => bus.off(CHANNEL, listener);
}
