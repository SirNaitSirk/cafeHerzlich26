# Prompt: Küchenmonitor (`/kueche`)

## Goal

Build the **Küchenmonitor** (`/kueche`), a staff touchscreen that consumes the orders created by the terminal (and later the Kasse). It shows all **open kitchen orders** sorted by arrival, each with a **live waiting timer**, and lets the kitchen **edit**, **delete** and **mark done**. Marking done turns the order **green on the Abholmonitor** — everything live via SSE, never a manual refresh.

This is the first consumer of the order data, so it also establishes the **read + mutation server layer** (`listOrders`, `markOrderReady`, `cancelOrder`, `updateOrder`) and a shared **`useOrders` client hook** that Kasse and Abholmonitor will reuse.

## Existing code inspected

- `src/lib/db/schema.ts` — `orders` (`status`, `createdAt`, `readyAt`, `orderNumber`, `guestName`, `totalCents`, `paymentMethod`, `source`) and `order_items` (`nameSnapshot`, `unitPriceCents`, `quantity`, `productId`); `ORDER_STATUSES` (`awaiting_payment | awaiting_cash | in_kitchen | ready | collected | cancelled`).
- `src/lib/orders.ts` — `createOrder`, `createOrderSchema`, `OrderStockError`, `OrderValidationError`, `orderDisplayLabel(order)`. Transaction/stock patterns to mirror.
- `src/app/api/orders/route.ts` — `POST` create → `broadcast({type:"orders:changed"})` + `catalog:changed`. Currently **no `GET`**.
- `src/lib/events.ts` — `broadcast()`, event types `orders:changed` / `catalog:changed`.
- `src/app/api/events/route.ts` — live SSE endpoint.
- `src/hooks/use-event-stream.ts` — `useEventStream(types, onEvent)` (signal-based: on event, refetch).
- `src/lib/format.ts` — `formatEuros(cents)`.
- `src/lib/messages.ts` — central German copy (currently only `terminalMessages`).
- `src/lib/roles.ts` — `kueche` is a **staff role** (gated by `src/proxy.ts`).
- `src/app/kueche/page.tsx` — current `SurfacePlaceholder` to replace.
- `src/components/terminal/*` — client-component + `motion` patterns to match.

## Decisions / assumptions (confirm if wrong)

1. **Which orders the kitchen sees:** exactly `status = "in_kitchen"`, sorted by `createdAt` ascending (oldest first = top of queue). `awaiting_payment` / `awaiting_cash` stay hidden (not yet released). `ready` disappears from the kitchen (it now lives on the Abholmonitor).
2. **Mark done:** `in_kitchen → ready`, set `readyAt = now`. Broadcasts `orders:changed` so the Abholmonitor turns it green instantly. No stock change.
3. **Delete = cancel (soft), not a hard row delete:** `→ status "cancelled"`, and **restock** every tracked item (`stockCount += quantity` for items whose product still tracks stock). Preserves history and keeps daily order numbers stable. Requires a confirm step (accidental taps on a touchscreen are easy). Broadcasts `orders:changed` + `catalog:changed`.
4. **Edit scope (please confirm — main ambiguity):** editing an open order lets the kitchen **adjust item quantities**, **remove items**, and **edit the guest name**. Reducing/removing quantities **restocks** the delta; increasing a quantity **decrements + re-validates** stock (reject with a friendly message if insufficient). The order **total is recomputed** from the existing item price snapshots (never re-priced from the current catalog). **Adding brand-new products is out of scope** for this first version — flag if you want it. If all items are removed, treat it as a cancel.
5. **Waiting timer origin:** counts up from `orders.createdAt` (total guest wait). Displayed as `mm:ss`, updating every second on the client only (no server polling). Cards get a subtle **urgency escalation** as the wait grows (e.g. calm < 5 min, amber ≥ 5 min, red ≥ 10 min — values centralized as constants). If you'd rather measure "time in kitchen" for cash orders, flag it (would need a new `enteredKitchenAt` column + migration).
6. **Shared read layer:** add a generic `listOrders({ statuses })` returning each order **with its items**, plus a `GET /api/orders?scope=kitchen` that maps a validated `scope` (`kitchen` for now; `kasse`/`pickup` later) to the right status set. Kasse and Abholmonitor will reuse both.

## Files likely to change / add

**Server / data**
- `src/lib/orders.ts` — add:
  - `type OrderWithItems` (order + `items: OrderItem[]`).
  - `listOrders(opts: { statuses: OrderStatus[] })` → orders (with items) sorted by `createdAt` asc.
  - `markOrderReady(id)` → guard current status is `in_kitchen`; set `status "ready"`, `readyAt`.
  - `cancelOrder(id)` → set `status "cancelled"`, restock tracked items (in one transaction).
  - `updateOrder(id, input)` → Zod-validated edits (per assumption 4): adjust/remove items, edit name, restock/decrement deltas, recompute total — all in one transaction; throws `OrderStockError` / `OrderValidationError` (reuse existing).
  - `KITCHEN_STATUSES` constant (`["in_kitchen"]`) as the single source for the kitchen scope.
- `src/app/api/orders/route.ts` — add `GET`: parse `scope` with Zod, call `listOrders`, return `{ orders }`. Keep `POST` unchanged.
- `src/app/api/orders/[id]/route.ts` — new per-order handler (Next 16 App Router dynamic segment):
  - `PATCH` → body discriminated by an `action`: `{ action: "ready" }` (mark done) or `{ action: "update", ... }` (edits). Zod-validated. On success `broadcast("orders:changed")` (+ `catalog:changed` when stock changed).
  - `DELETE` → `cancelOrder`, broadcast `orders:changed` + `catalog:changed`.
  - Return `404` for a missing order, `409` on stock conflict, `400` on invalid input/illegal transition.

**Client / UI (kitchen)**
- `src/app/kueche/page.tsx` — server component: initial `listOrders({ statuses: KITCHEN_STATUSES })`, render the client monitor with that as initial data.
- `src/components/kueche/kitchen-monitor.tsx` — client: holds order list, `useOrders("kitchen")` for live refetch, renders the responsive card grid, empty/loading/error states.
- `src/components/kueche/order-card.tsx` — one order: label (`orderDisplayLabel`), payment/source badge, item lines (`2× Cappuccino`), live wait timer, total, actions (Erledigt / Bearbeiten / Löschen).
- `src/components/kueche/edit-order-dialog.tsx` — quantity steppers + remove + name field; submits `PATCH … {action:"update"}`; shows stock-conflict errors inline.
- `src/hooks/use-orders.ts` — fetches `/api/orders?scope=<scope>`, seeds from initial data, refetches on `orders:changed` via `useEventStream`. Returns `{ orders, error, isLoading }`. Reusable across staff surfaces.
- `src/hooks/use-wait-timer.ts` — given a start ms, returns a `mm:ss` string + urgency level, ticking each second (one shared interval; respects `prefers-reduced-motion` for any pulse).
- `src/lib/messages.ts` — add a `kitchenMessages` (or shared `staffMessages`) block: `Erledigt`, `Bearbeiten`, `Löschen`, `Wirklich löschen?`, `Speichern`, `Abbrechen`, empty state (`Keine offenen Bestellungen`), wait-label, stock-error, etc.
- shadcn primitives as needed (`dialog`, `card`, `button`, `input` exist; add others via `npx shadcn@latest add` only if required).

## Implementation requirements

- **Language:** all visible copy German (from `messages.ts`); all identifiers/comments English. No `getBestellung`-style mixing.
- **Money:** integer cents end to end; format only via `formatEuros`. Totals recomputed from **item snapshots**, never re-priced from the live catalog.
- **All writes server-side, Zod-validated, via Drizzle**, in transactions for multi-step changes (cancel/update touch orders + items + stock atomically). Browser never touches the DB.
- **Status guards:** every mutation checks the current status and rejects illegal transitions (e.g. can't mark a `cancelled` order ready).
- **Thin route handlers:** all logic in `src/lib/orders.ts`.
- **Constants centralized:** kitchen status set + wait-urgency thresholds live in one place, not inline literals.

## Real-time / broadcast requirements

- The monitor subscribes via `useEventStream(["orders:changed"], refetch)` — a new terminal order, a cash release from Kasse, or another kitchen device's action appears/updates **live**.
- Every mutation broadcasts `orders:changed`; cancel/edit that change stock also broadcast `catalog:changed`.
- **Mark done → the order leaves the kitchen and (once the Abholmonitor is built) shows green there** driven purely by the same `orders:changed` signal. No manual refresh anywhere.
- Assume **multiple kitchen screens** watch at once; state stays consistent because each refetches on the signal.

## UI / design requirements

- **Format:** staff **touchscreen**, likely landscape. Big touch targets (min ~64px), high legibility, glanceable. Responsive grid of order cards (e.g. 2–4 columns by width); newest-at-top queue order preserved.
- **Order card:** prominent **label** (name or `Bestellung #n`), a clear **wait timer** (large, monospace-ish), item list with quantities, total, and payment/source badges. **Erledigt** is the primary action (large, green); **Bearbeiten** and **Löschen** secondary; **Löschen** needs a confirm (dialog or press-hold).
- **Urgency:** subtle color escalation of the timer/card border as wait grows (calm → amber → red), so the kitchen sees the oldest orders at a glance.
- **Animations (`motion`):** smooth enter/exit and reordering of cards (new order slides in; done/cancelled animates out); timer updates must not jank. Fast and light for Pi-class hardware; respect `prefers-reduced-motion`.
- **States:** loading (initial), **empty** (`Keine offenen Bestellungen` — friendly, not blank), error (fetch/SSE dropped → German inline notice + auto-retry), per-action pending/disabled, stock-conflict message in the edit dialog.
- Use the **impeccable** and **ui-ux-pro-max** skills for hierarchy, spacing, typography, color and motion — legibility at arm's length matters.

## Security requirements

- `/kueche` is a **staff role** already gated by `src/proxy.ts` — no login, device-role cookie only. Don't add auth.
- All mutations go through the server; recompute totals/stock server-side; reject tampered or illegal-transition input.
- No external network calls at runtime.

## Acceptance criteria

- `/kueche` lists all `in_kitchen` orders, oldest first, each with label, items, total and a **live `mm:ss` wait timer** that ticks every second.
- A new terminal/PayPal order (or a cash order released from Kasse) appears **without refresh**; a second kitchen tab stays in sync.
- **Erledigt** sets `status "ready"` + `readyAt`, removes it from the kitchen, and broadcasts `orders:changed` (verify the order is now in `ready`).
- **Löschen** (after confirm) sets `status "cancelled"` and **restocks** tracked items; broadcasts `orders:changed` + `catalog:changed`.
- **Bearbeiten** adjusts quantities/removes items/edits the name, restocks or re-validates stock accordingly, and **recomputes the total from snapshots**; a stock-insufficient increase is rejected with a friendly German message.
- Illegal transitions are rejected; a missing id returns `404`.
- All visible text is German; `npm run lint` and `npm run build` pass.

## Checks to run

- `npm run lint`
- `npm run build`
- Manual test steps below. (No automated test runner configured yet.)

## Exact manual test steps

1. `npm run db:migrate && npm run db:seed`, then `npm run dev`.
2. On the terminal (`/terminal`), place a **PayPal** order (goes straight to `in_kitchen`) → it appears on `/kueche` with a running timer.
3. Open `/kueche` in a **second tab/device**; place another terminal order → both tabs show it live, sorted after the first.
4. Watch the timer tick; leave one order to cross the ≥5 min / ≥10 min thresholds (or temporarily lower the constants) → urgency color changes.
5. **Bearbeiten:** open an order, change a quantity and remove an item → total recomputes; check via `npm run db:studio` that item rows + `total_cents` updated and stock adjusted.
6. **Erledigt:** mark an order done → it leaves the kitchen; in studio it's `status ready` with `ready_at` set (this is what the Abholmonitor will show green).
7. **Löschen:** delete an order → confirm prompt → gone from kitchen; in studio it's `cancelled` and its tracked stock went back up; the terminal greys/ungreys accordingly (`catalog:changed`).
8. **Realtime sanity:** `curl -N http://localhost:3000/api/events` and confirm `orders:changed` (and `catalog:changed` on delete/edit) fire for each action.
9. `npm run lint` and `npm run build` are green.
