# Prompt: Kasse (`/kasse`)

## Goal

Build the **Kasse** (`/kasse`), the staff till surface. It has three jobs (AGENTS §4):

1. **Bar-Warteschlange:** a live queue of cash orders (`awaiting_cash`) waiting to be collected. Tapping **„Kassiert"** confirms the cash was taken and releases the order into the kitchen (`awaiting_cash → in_kitchen`).
2. **Stellvertretend bestellen:** staff take an order for a guest who won't/can't use the terminal — the same ordering UI as the terminal (Menü → Warenkorb → Zahlung → PayPal-QR / Erfolg), but with `source: "kasse"`.
3. **Abgeholt + „fertig seit":** the Abholmonitor's counterpart. Ready orders (`ready`) are listed with **how long they've been ready** (`readyAt → now`); tapping **„Abgeholt"** archives them (`ready → collected`), which removes them from the Kasse **and** from the public Abholmonitor — live.

This is the last consumer of the shared order layer. It reuses `listOrders`/`useOrders`, the SSE bus, and the terminal ordering screens. It closes the loop the pickup-monitor prompt deliberately left open: the **„abgeholt"** action lives here, not on the TV.

## Existing code inspected

- `src/lib/orders.ts` — `createOrder` (branches only on payment today), `createOrderSchema` (has `source: enum(ORDER_SOURCES)`), `listOrders({ statuses })`, `markOrderReady`, `cancelOrder`, `updateOrder`, `requireOrder`, `OrderTransitionError`/`OrderNotFoundError`, `statusForPayment` (payment-only), `KITCHEN_STATUSES`, `PICKUP_STATUSES`.
- `src/app/api/orders/route.ts` — `GET ?scope=…` with `SCOPE_STATUSES` map + `scopeSchema` (`kitchen | pickup`); `POST` creates an order and broadcasts `orders:changed` + `catalog:changed`.
- `src/app/api/orders/[id]/route.ts` — `PATCH` discriminated union (`action: "ready" | "update"`), `DELETE` (cancel). `errorResponse` helper maps service errors to HTTP.
- `src/hooks/use-orders.ts` — `useOrders(scope, initial)` → `{ orders, hasError }`; `OrdersScope = "kitchen" | "pickup"`. Seeds from server data, refetches on `orders:changed`.
- `src/hooks/use-wait-timer.ts` — live elapsed timer + `WaitLevel` (used by the kitchen card); `src/lib/wait.ts` for the level thresholds.
- `src/components/terminal/terminal-experience.tsx` — the ordering brain: `Step` machine (`welcome → menu → cart → payment → paypal → success`), `submitOrder(method)`, catalog refetch on `catalog:changed`, idle-timeout reset, `useCart`. **To be split.**
- `src/components/terminal/{menu-screen,cart-screen,payment-choice,paypal-screen,success-screen,welcome-screen}.tsx` — the leaf step screens (reused as-is).
- `src/hooks/use-cart.ts`, `src/hooks/use-idle-timeout.ts`, `src/lib/catalog.ts` (`getCatalog`), `src/lib/settings.ts` (`getSettings`).
- `src/components/kueche/{kitchen-monitor,order-card}.tsx` — staff-surface patterns (header with connection-lost + count, toasts, `AnimatePresence` list, confirm dialog, action buttons) to mirror.
- `src/lib/messages.ts` — `terminalMessages`, `kitchenMessages`, `pickupMessages`. Add `kasseMessages`.
- `src/lib/order-label.ts` — `orderDisplayLabel`. `src/lib/format.ts` — `formatEuros`.
- `src/lib/roles.ts` / `src/proxy.ts` — `/kasse` is a **staff** surface, already gated to the `kasse` role.
- `src/app/kasse/page.tsx` — current `SurfacePlaceholder` to replace.

## Decisions (confirmed with the user)

1. **Kasse-placed cash goes straight to the kitchen.** When staff take a **cash** order on behalf (`source: "kasse"`, `paymentMethod: "cash"`), the money is collected at the counter in that moment, so the order is created directly as **`in_kitchen`** — it does **not** enter the Bar-Warteschlange (no redundant „Kassiert" step for the same person). Terminal cash orders (`source: "terminal"`) still land in `awaiting_cash` as today. → `createOrder` must branch on **both** payment method **and** source.
   - PayPal on-behalf is unchanged: show the QR, order is persisted only after „Ich habe bezahlt" → `in_kitchen`, regardless of source.
2. **Reuse the ordering UI via a shared component.** Extract the step-machine + submit logic from `terminal-experience.tsx` into one reusable `OrderFlow` component. The **terminal** wraps it with the welcome/attract screen + idle-timeout; the **Kasse** mounts the same flow **without** the attract screen (starts at `menu`, returns to the Kasse dashboard on completion). One ordering brain, no parallel orchestrator (AGENTS: one source of truth per concept).

## Files likely to change / add

**Server / data**
- `src/lib/orders.ts`
  - Change `statusForPayment(method)` → `initialStatus(method, source)`: `paypal → in_kitchen`; `cash → source === "kasse" ? "in_kitchen" : "awaiting_cash"`. Set `paidConfirmedAt = now` whenever the initial status is `in_kitchen` (PayPal always; Kasse-cash now too), else `null`.
  - Add `CASH_QUEUE_STATUSES = ["awaiting_cash"] as const` and `READY_STATUSES = ["ready"] as const` (single source; mirrors `KITCHEN_STATUSES`).
  - Add `confirmCashPayment(id)`: `awaiting_cash → in_kitchen`, stamp `paidConfirmedAt = now`; throw `OrderTransitionError` if status ≠ `awaiting_cash`. (Wrap in `db.transaction` + `requireOrder`, like `markOrderReady`.)
  - Add `collectOrder(id)`: `ready → collected`; throw `OrderTransitionError` if status ≠ `ready`. (No restock — the guest received the items.)
- `src/app/api/orders/route.ts` — extend `SCOPE_STATUSES` with `cash: CASH_QUEUE_STATUSES` and `ready: READY_STATUSES`; add both to `scopeSchema`.
- `src/app/api/orders/[id]/route.ts` — extend the `PATCH` discriminated union with `{ action: "cash" }` (→ `confirmCashPayment`) and `{ action: "collect" }` (→ `collectOrder`); both broadcast `orders:changed` (no catalog change — stock untouched). Keep `errorResponse` mapping.

**Client / hooks**
- `src/hooks/use-orders.ts` — widen `OrdersScope` to `"kitchen" | "pickup" | "cash" | "ready"`. (Hook logic already generic.)

**Ordering flow (shared)**
- `src/components/terminal/order-flow.tsx` (new) — the extracted client orchestrator: `Step` machine **without** `welcome`, `submitOrder(method)`, catalog refetch on `catalog:changed`, `useCart`. Props: `paypalHandle`, `initialCatalog`, `source: OrderSource`, `onExit()` (cancel from the menu), `onComplete()` (after the success screen), and optional entry so the terminal can still show `success` auto-return. Renders `menu | cart | payment | paypal | success` + `Toaster`.
- `src/components/terminal/terminal-experience.tsx` — becomes a thin wrapper: owns the `welcome` step + `useIdleTimeout`, then renders `<OrderFlow source="terminal" onExit={resetToWelcome} onComplete={resetToWelcome} … />`. **No behavioural change to the terminal** — same screens, same idle reset, same auto-return.

**Kasse UI**
- `src/app/kasse/page.tsx` — server component: initial data via `listOrders({ statuses: CASH_QUEUE_STATUSES })` and `listOrders({ statuses: READY_STATUSES })`, plus `getCatalog()` + `getSettings()` for the on-behalf flow. `export const dynamic = "force-dynamic"`. Renders the client dashboard.
- `src/components/kasse/kasse-dashboard.tsx` (new) — the till dashboard: header (title, connection-lost, „Neue Bestellung" button), two live sections via `useOrders("cash", …)` and `useOrders("ready", …)`, and the on-behalf `OrderFlow` mounted as a full-screen overlay/step toggled by „Neue Bestellung". Owns the `cash`/`collect` mutation calls (same fetch+toast pattern as `kitchen-monitor.tsx`).
- `src/components/kasse/cash-order-card.tsx` (new) — one `awaiting_cash` order: label, item list, total (`formatEuros`), payment/source badges, big **„Kassiert"** button → `PATCH {action:"cash"}`. Optimistic-out via `AnimatePresence`.
- `src/components/kasse/ready-order-card.tsx` (new) — one `ready` order: label, **„fertig seit"** timer (`readyAt → now`, reuse `useWaitTimer(order.readyAt)`), **„Abgeholt"** button → `PATCH {action:"collect"}`. Green accent to match the Abholmonitor.
- `src/lib/messages.ts` — add `kasseMessages` (title, section headings „Offene Barzahlungen" / „Abholbereit", counts, „Neue Bestellung", „Kassiert", „Abgeholt", „fertig seit", empty/loading/connection-lost, toasts) — German, single source of truth.

## Implementation requirements

- **Language:** all visible copy German (from `messages.ts`); identifiers/comments English. No mixed-language identifiers.
- **Money in cents**; format only at the UI edge with `formatEuros`.
- **Reuse, don't fork:** use `useOrders`, `listOrders`, `orderDisplayLabel`, `useWaitTimer`, `formatEuros`, and the extracted `OrderFlow`. No parallel fetch/label/timer/ordering logic.
- **Constants centralized:** the new status sets live in `orders.ts`, not inline literals in routes.
- **Thin, typed routes:** the new `PATCH` actions stay in the existing single-purpose handler; Zod-validated; every mutation **broadcasts**.
- **Status transitions are guarded** in the service (throw `OrderTransitionError` on the wrong status) so a double-tap on two screens can't corrupt state — the loser gets a 409 → „nicht mehr offen" toast.

## Real-time / broadcast requirements

- **No mutation without a broadcast.** `confirmCashPayment` and `collectOrder` routes broadcast `orders:changed`; the on-behalf `POST` already broadcasts `orders:changed` + `catalog:changed`.
- **Cross-surface propagation to verify live (no manual refresh):**
  - Terminal **Bar** order → appears in the Kasse **„Offene Barzahlungen"** instantly.
  - Kasse **„Kassiert"** → order leaves the cash queue and appears on **/kueche** instantly.
  - Kitchen **„Erledigt"** → order appears in the Kasse **„Abholbereit"** and on **/abholung** (green) instantly.
  - Kasse **„Abgeholt"** → order disappears from the Kasse ready list **and** from **/abholung** instantly.
  - Kasse on-behalf **PayPal/Bar(kasse)** order → appears on **/kueche** (+ **/abholung**) instantly; stock decrements reflect on **/terminal** and **/admin** via `catalog:changed`.
- The dashboard self-heals after a dropped SSE connection (EventSource reconnects; `useOrders` refetches on reconnect).

## UI / design requirements

- **Format:** a **staff touchscreen** (like the kitchen) — big touch targets (buttons ≥ h-14), clear hierarchy, glanceable. Not a public/attract surface; operational and fast. Two obvious zones plus a prominent „Neue Bestellung" entry.
- **Two sections:** „Offene Barzahlungen" (`awaiting_cash`, neutral/attention) and „Abholbereit" (`ready`, green — matches the Abholmonitor). Each with a heading + live count. Sensible empty states per section (e.g. „Keine offenen Barzahlungen").
- **Cash card:** label, items, total, payment/source badges, one dominant **„Kassiert"** action.
- **Ready card:** label, a **„fertig seit"** timer that grows more urgent the longer it sits (reuse `useWaitTimer`/`WaitLevel` so forgotten pickups stand out), one **„Abgeholt"** action, green framing.
- **On-behalf overlay:** reuses the terminal screens verbatim (Menü/Warenkorb/Zahlung/PayPal/Erfolg). Entry from „Neue Bestellung"; a clear way to cancel back to the dashboard (`onExit`); on completion, return to the dashboard (`onComplete`) — **no** attract screen, **no** idle-timeout in the Kasse.
- **Motion:** `AnimatePresence` for cards entering/leaving (mirror the kitchen monitor); smooth on Pi-class hardware; respect `prefers-reduced-motion`.
- Use the **impeccable**, **ui-ux-pro-max**, and **ui-styling** skills for hierarchy, color, touch sizing and motion — branded „Cafe Herzlich", consistent with the other surfaces; Montserrat global font.

## Security / constraints

- `/kasse` is **staff-only** — already gated to the `kasse` role in `src/proxy.ts`; don't change the gate.
- **All writes server-side**, Zod-validated, via Drizzle; the browser never writes the DB directly.
- **No internet at runtime** — no external fonts/CDNs/APIs; PayPal stays a static per-order QR from the `settings` handle (already handled by `PaypalScreen`).

## Acceptance criteria

- `/kasse` shows two live sections — **Offene Barzahlungen** (`awaiting_cash`) and **Abholbereit** (`ready`) — each with a count and correct empty states.
- **„Kassiert"** moves a cash order out of the queue and into `/kueche` (status `in_kitchen`) live, from a second screen too; a double-tap loser gets a „nicht mehr offen" toast (409), not a crash.
- **„Abgeholt"** archives a ready order (`collected`): it vanishes from `/kasse` **and** `/abholung` live.
- **„Neue Bestellung"** opens the terminal ordering UI in the Kasse; a **PayPal** on-behalf order enters `/kueche` after „Ich habe bezahlt"; a **Bar** on-behalf order (`source: "kasse"`) goes **directly** to `/kueche` (not the cash queue).
- The **terminal is unchanged** in behaviour after the `OrderFlow` extraction (welcome, idle reset, all steps, auto-return still work).
- Ready cards show a live **„fertig seit"** timer; all visible text is German.
- `npm run lint` and `npm run build` pass.

## Checks to run

- `npm run lint`
- `npm run build`
- Manual test steps below. (No automated test runner configured yet.)

## Exact manual test steps

1. `npm run dev` (DB already migrated/seeded).
2. Assign this device the **Kasse** role once via `/setup` (choose „Kasse"), then open `/kasse`. Confirm both sections show their empty states.
3. On `/terminal`, place a **Bar** order → it appears under **Offene Barzahlungen** on `/kasse` live. Open a second `/kasse` tab and confirm both match.
4. Press **„Kassiert"** → the order leaves the queue and appears on `/kueche` (open it as a Küche device). Confirm the second `/kasse` tab updated too. Double-tap „Kassiert" from both tabs → the second gets a „nicht mehr offen" toast.
5. On `/kueche`, press **Erledigt** → the order appears under **Abholbereit** on `/kasse` (green, with a „fertig seit" timer) and on `/abholung`.
6. On `/kasse`, press **„Abgeholt"** → the order disappears from `/kasse` and from `/abholung` live.
7. Press **„Neue Bestellung"** → order via **PayPal** → after „Ich habe bezahlt" the order is on `/kueche`. Then **„Neue Bestellung"** → **Bar** → confirm it goes **straight** to `/kueche` (never into the cash queue). Stock decrements show on `/terminal` and `/admin`.
8. Regression: run the full **terminal** flow end-to-end (welcome → menu → cart → payment → PayPal & Bar → success → auto-return) and confirm nothing changed after the `OrderFlow` extraction.
9. **Self-heal:** restart `npm run dev` with `/kasse` open → it reconnects and refetches without a manual reload.
10. `npm run lint` and `npm run build` are green.
