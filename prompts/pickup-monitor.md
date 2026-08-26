# Prompt: Abholmonitor (`/abholung`)

## Goal

Build the **Abholmonitor** (`/abholung`), a large **public TV** that shows guests the status of their orders at a glance: **In Zubereitung** (in progress) on one side and **Abholbereit** (ready for pickup, green) on the other. When the kitchen marks an order done it moves — live, with a clear animated transition — into the green "ready" column. Everything updates via SSE; no manual refresh, ever.

This is the third consumer of the shared order layer and the payoff for the kitchen's **Erledigt** action: marking an order ready must turn it green here **instantly**. It reuses the `useOrders` hook and `listOrders` service already built for the Küchenmonitor.

## Existing code inspected

- `src/lib/orders.ts` — `listOrders({ statuses })` → `OrderWithItems[]` (with item snapshots, oldest first); `KITCHEN_STATUSES`; `orderDisplayLabel(order)` (guest name, or `Bestellung #<n>`).
- `src/lib/order-label.ts` — client-safe `orderDisplayLabel`.
- `src/app/api/orders/route.ts` — `GET ?scope=…` with `SCOPE_STATUSES` map + `scopeSchema` (currently only `kitchen`).
- `src/hooks/use-orders.ts` — `useOrders(scope, initial)`: seeds from server data, refetches on `orders:changed`, exposes `{ orders, hasError }`. `OrdersScope` type currently `"kitchen"`.
- `src/lib/events.ts` / `src/app/api/events/route.ts` — SSE + `orders:changed`.
- `src/lib/db/schema.ts` — `ORDER_STATUSES` (`awaiting_payment | awaiting_cash | in_kitchen | ready | collected | cancelled`); `orders.readyAt`, `orders.createdAt`, `orders.orderNumber`, `orders.guestName`.
- `src/lib/roles.ts` — `abholung` is **public** (not in `STAFF_ROLES`); `src/proxy.ts` matcher does **not** gate `/abholung`.
- `src/app/abholung/page.tsx` — current `SurfacePlaceholder` to replace.
- `src/components/kueche/*` + `src/lib/messages.ts` (`kitchenMessages`) — patterns/copy conventions to mirror.
- `src/app/layout.tsx` — global font is now **Montserrat** (`--font-sans`).

## Decisions / assumptions (confirm if wrong)

1. **What the board shows:** exactly two groups — `in_kitchen` → **„In Zubereitung"**, and `ready` → **„Abholbereit"** (green). `awaiting_payment` / `awaiting_cash` stay hidden (not paid/released yet); `collected` / `cancelled` never appear. New shared scope `pickup` → `PICKUP_STATUSES = ["in_kitchen", "ready"]`.
2. **Ordering:** within each column, sort by arrival — in-progress by `createdAt` asc (oldest waiting first), ready by `readyAt` asc (or desc — newest-ready pops to the top so guests spot a fresh "ready" fast; **confirm** which). Centralize the choice.
3. **Ready orders persist until manually collected — NO auto-clear (user decision).** Ready tiles stay green on the board until staff mark the order **abgeholt** → status `collected`, which removes it here live. That **„abgeholt" action belongs to the Kasse, not this surface** — the pickup monitor stays strictly read-only (built with the Kasse in its own prompt). **Note for the Kasse:** show **how long each order has already been ready** (`readyAt` → now) so staff can spot forgotten/overlooked pickups. **Interim:** until the Kasse's collected action exists, ready orders accumulate on the board — accepted.
4. **Label:** `orderDisplayLabel` — the guest **name**, or `Bestellung #<n>` when none. This is the product's intended public display (AGENTS: "by name/number"); names are shown on the public TV by design.
5. **No wait timer, no prices, no payment/source badges** here — the pickup monitor is glanceable, not operational. Just the label, grouped by status. (Item lists optional/omitted — confirm; default: **omit**, show only the label for maximum legibility.)
6. **No audio.** A visual highlight when an order turns ready is enough; don't add sound unless asked.

## Files likely to change / add

**Server / data**
- `src/lib/orders.ts` — add `PICKUP_STATUSES = ["in_kitchen", "ready"] as const` (single source, mirrors `KITCHEN_STATUSES`).
- `src/app/api/orders/route.ts` — extend `SCOPE_STATUSES` with `pickup: PICKUP_STATUSES` and `scopeSchema` with `"pickup"`. No other change.

**Client / UI (pickup)**
- `src/hooks/use-orders.ts` — widen `OrdersScope` to `"kitchen" | "pickup"`. (Hook logic already generic.)
- `src/app/abholung/page.tsx` — server component: initial `listOrders({ statuses: PICKUP_STATUSES })`, render the client board. `export const dynamic = "force-dynamic"`.
- `src/components/abholung/pickup-board.tsx` — client: `useOrders("pickup", initial)`, split into in-progress vs. ready, render the two columns, empty/error states. No timeout/clearing logic — read-only.
- `src/components/abholung/pickup-order.tsx` — one order tile: big label; ready tiles styled green. Uses Framer Motion `layout` / shared `layoutId={order.id}` so a tile **animates from the left column to the green column** when it becomes ready.
- `src/lib/messages.ts` — add `pickupMessages` (title, `inProgress`, `ready`, empty states, connection-lost) — German, single source of truth.

## Implementation requirements

- **Language:** all visible copy German (from `messages.ts`); identifiers/comments English.
- **Reuse, don't fork:** use the existing `useOrders` hook, `listOrders`, `orderDisplayLabel` — no parallel fetching/label logic. Only widen the scope union + status map.
- **Pure read surface:** the pickup monitor issues **no mutations** and has **no auto-clear** — ready orders persist until a future Kasse „abgeholt" action removes them. No timeout logic on this screen.
- **Constants centralized:** pickup status set + sort direction in one place, not inline literals.

## Real-time / broadcast requirements

- The board subscribes via `useOrders` → `useEventStream(["orders:changed"], refetch)`. A new order entering the kitchen appears under **In Zubereitung**; the kitchen's **Erledigt** moves it to **Abholbereit (grün)** — both **live, no refresh**.
- Assume the TV runs untouched for hours: it must reconnect on its own (EventSource does) and refetch on reconnect (hook already does). Verify it self-heals after a dropped connection.
- This surface only **reads**; it never broadcasts.

## UI / design requirements

- **Format:** a big **landscape TV (16:9)**, viewed from **across the room** — this is the single most important constraint. Huge type, very high contrast, generous spacing, minimal chrome. No hover/touch affordances (nobody interacts with it).
- **Layout:** two clear columns/zones — **In Zubereitung** (neutral) and **Abholbereit** (green), each with a large heading and a count. The green side should read as unmistakably "come get it" (strong green, maybe a check icon per tile). Balance the two zones; the ready side should catch the eye.
- **Order tiles:** the **label** dominates (very large, legible at distance). Grid/stack of tiles that stays readable with anywhere from 1 to ~20+ orders (tiles may shrink gracefully; consider a max, then scroll/paginate — keep simple).
- **The moment of "ready":** the defining animation. When an order flips to ready it should **visibly travel** from the in-progress zone into the green zone (Framer Motion `layoutId` shared element) with a brief highlight/pop, so a waiting guest notices their name go green. Smooth on Pi-class hardware; respect `prefers-reduced-motion` (fall back to a simple fade/color change).
- **States:** **empty** (no open orders → friendly branded idle state, e.g. café name + „Aktuell keine Bestellungen", not a blank screen), connection-lost indicator (subtle, non-alarming), initial load. No per-order error states (read-only).
- **Branding:** warm, „Cafe Herzlich", consistent with the terminal/kitchen; Montserrat is the global font. Use the **impeccable** and **ui-ux-pro-max** skills for TV-scale hierarchy, color and motion.

## Security / constraints

- `/abholung` is **public** (no role, not gated by `src/proxy.ts`) — correct; don't add a gate.
- **Read-only:** no DB writes from this surface.
- No external network calls at runtime (no external fonts/CDNs — Montserrat is self-hosted; no icons/assets from the internet).

## Acceptance criteria

- `/abholung` shows two zones: **In Zubereitung** (`in_kitchen`) and **Abholbereit / grün** (`ready`), each with a live count, orders labelled by name or `Bestellung #<n>`.
- Placing a new order (PayPal terminal flow) makes it appear under **In Zubereitung** with no refresh; a second `/abholung` tab stays in sync.
- Pressing **Erledigt** on `/kueche` moves that order **live** into the green **Abholbereit** zone with the shared-element animation.
- `awaiting_*`, `collected`, and `cancelled` orders never appear.
- Ready orders **persist** on the board (no auto-hide); the surface performs **no mutations**.
- Empty state shows a branded idle screen, not a blank page; the board self-heals after a dropped SSE connection.
- All visible text is German; `npm run lint` and `npm run build` pass.

## Checks to run

- `npm run lint`
- `npm run build`
- Manual test steps below. (No automated test runner configured yet.)

## Exact manual test steps

1. `npm run dev` (DB already migrated/seeded from earlier work).
2. Open `/abholung` on a large screen (or resize a browser to 16:9). Confirm the branded empty state when no orders are open.
3. On `/terminal`, place a **PayPal** order → it appears under **In Zubereitung** on `/abholung` live. Open a second `/abholung` tab and confirm both match.
4. On `/kueche` (device role „Küche" via `/setup`), press **Erledigt** → the order animates into the green **Abholbereit** zone on the TV instantly.
5. Confirm the ready order **stays** on the board (no auto-hide) — it will only be removed later by the Kasse's „abgeholt" action.
6. Place several orders to sanity-check legibility and layout with many tiles.
7. **Self-heal:** stop and restart `npm run dev` (or briefly kill the network) with `/abholung` open → the board reconnects and refetches without a manual reload.
8. `npm run lint` and `npm run build` are green.
