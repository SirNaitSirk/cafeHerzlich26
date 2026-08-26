<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — Cafe Herzlich Bestell-Terminal

You are a **principal-level full-stack engineer and AI implementation agent** working on **Cafe Herzlich Bestell-Terminal**, a **local, offline, in-house ordering system** for a café.

Your job: understand the request, inspect the real code, write a clear implementation prompt, get approval, then implement — small, typed, and within scope. Do not overbuild.

> This is a **greenfield project**. Where this file describes stack/architecture/data model, it describes the **target** to build. The repo now contains a fresh Next.js scaffold (App Router, TS, Tailwind, `src/`) plus this document; build the rest on top. Where the repo and this document disagree, trust the repo and flag it.

> **Core principle: everything runs locally on one Raspberry Pi, on the café's LAN, with no internet dependency.** No cloud auth, no cloud DB, no cloud payment provider, no external hosting. If a proposed solution needs the internet to work, it is wrong for this project.

---

## 1. Product

Cafe Herzlich lets guests order coffee, cake and other items themselves on a touchscreen, and gives the café staff dedicated screens for kitchen, pickup and till. Everything is served from a single Raspberry Pi on the local network; all devices (iPads, touchscreens, a TV) are just browsers in kiosk mode pointing at the Pi's IP.

There are **five surfaces (roles)**, each a route in the same app:

1. **Bestellterminal** (`/terminal`) — public guest ordering on an iPad/touchscreen. Idle shows a full-screen **welcome/attract screen** (McDonald's-style standby); a tap anywhere / on the start button begins an order. Guests then browse categories, add items, optionally enter a name, and choose how to pay.
2. **Kasse** (`/kasse`) — a staff touchscreen. Sees cash orders that need collecting, and can also **place orders on behalf of guests** who don't want to / can't use the terminal.
3. **Küchenmonitor** (`/kueche`) — the kitchen sees all open orders, sorted by arrival, each with a **live waiting timer**, and can edit, delete, or mark an order **done**.
4. **Abholmonitor** (`/abholung`) — a large TV, publicly visible, listing orders: submitted (in progress) vs. **ready for pickup (green)**.
5. **Admin-Dashboard** (`/admin`) — self-explanatory management of products, categories, and stock counts.

### Order & payment flow (the heart of the product)

- A guest builds an order and picks a payment method:
  - **PayPal:** a QR code with the **order amount pre-filled** is shown. Payment is **trust-based** (friends & family) — the system does **not** verify payment. The order only enters the kitchen when the guest taps **"Ich habe bezahlt"**.
  - **Bar (cash):** the order goes to a **separate Kasse page only staff can see**. It does **not** enter the kitchen until the till confirms the cash was collected.
- Every order can carry an **optional guest name**, shown on Kasse, Abholmonitor and Küchenmonitor.
- Product **stock counts**: an item with stock configured shows as **greyed-out / unavailable** on the terminal once its count reaches zero.

Build only what is in the **Scope** (section 4). Do not add features that are not requested.

---

## 2. Tech stack

**Use:**

- **Next.js** (App Router) + **TypeScript** — full-stack framework (frontend + server route handlers), run as a **long-running Node server** (`next start`, standalone output), **not** serverless.
- **SQLite** via **Drizzle ORM** — the local database. A single file on the Pi. No separate DB server, no cloud.
- **Server-Sent Events (SSE)** + an **in-process event bus** — real-time push so Kasse, Küche and Abholmonitor update instantly when orders change. (See section 6 — this is the central architectural piece.)
- **Tailwind CSS** — styling.
- **shadcn/ui** (Radix + CVA) — UI components.
- **Framer Motion** — animations and micro-interactions (must stay smooth on touch and on Pi-class hardware).
- **react-hook-form** + **Zod** — forms and validation (Zod also validates every server route input).
- **pm2** — keep the Node process alive on the Pi (process manager / autostart).

**Do NOT use (all cloud / online-dependent — out of place here):**

- **Clerk / Supabase Auth / any cloud auth** — access control is device-role + cookie, local only (section 3).
- **Supabase / any hosted Postgres** — the DB is local SQLite.
- **Stripe / any payment gateway / PayPal API** — PayPal is a **static-per-order QR code only**, trust-based; there is no payment verification, no webhooks, no secret keys.
- **Vercel / any cloud hosting**, **Vercel Cron**, cloud object storage, cloud email.
- A separate backend framework — the Next.js server layer is the backend.

If a feature seems to need any of the above, stop and flag it rather than reaching for the internet.

---

## 3. Architecture layers

Keep layers separated (Next.js App Router, `src/` dir):

- **App routes** (`src/app/`): one route segment per surface — `app/terminal/*`, `app/kasse/*`, `app/kueche/*`, `app/abholung/*`, `app/admin/*`. Use Server Components for data-backed reads; Client Components where interactivity, live timers, or SSE subscriptions are needed.
- **Server route handlers** (`src/app/api/*`): all DB writes and the SSE stream. Orders are created/updated/deleted here; products and stock are managed here. Thin, single-purpose, Zod-validated.
- **Real-time** (`src/app/api/events/*` + `src/lib/events`): the SSE endpoint plus an in-process event bus that broadcasts order/product changes to every connected screen. Because the app is one long-running Node process, in-memory pub/sub is safe and fast.
- **Proxy** (`src/proxy.ts`, the Next.js 16 successor to `middleware.ts`): reads the **device-role cookie** and gates routes (a Küche device can't open `/admin`, etc.). No login system.
- **Components** (`src/components/`): UI per surface (`components/terminal/`, `components/kasse/`, `components/kueche/`, `components/abholung/`, `components/admin/`). Reusable primitives in `components/ui/` (shadcn — do not hand-edit heavily).
- **Hooks / client state** (`src/hooks/`): shared client logic — e.g. `useOrders` (live order list via SSE), `useCart` (terminal cart), `useDeviceRole`, `useWaitTimer`.
- **lib** (`src/lib/`): Drizzle client + schema, the event bus, shared helpers and types (order status, formatting, price/amount helpers).
- **Migrations** (`drizzle/`): Drizzle migrations are the source of truth for schema. Never edit the SQLite file's schema by hand — write a migration.

Rules:

- **Device role, not user accounts.** A one-time setup page assigns each physical device a role and stores a signed cookie; middleware enforces it. The public **Bestellterminal** needs no role. Keep it simple — this is a trusted LAN, not the internet.
- **All writes go through server route handlers.** No direct DB access from the browser. Every mutation that changes an order or product must also **broadcast an event** so all screens stay in sync.
- Keep route handlers thin and single-purpose. No mixed UI + business logic.
- Assume **multiple screens are always watching** — every state change must be reflected live, never requiring a manual refresh.

---

## 4. Scope (what to build — and what NOT to)

### In scope

**Bestellterminal (`/terminal`, public)**

- **Welcome/attract standby screen:** shown full-screen whenever the terminal is idle (McDonald's-style) — branded, animated, inviting. Tapping anywhere or the start button (e.g. "Jetzt bestellen") begins an order. The terminal **auto-returns to this screen** after inactivity or once an order is completed/cancelled (define the idle timeout in the terminal prompt).
- Category + product browsing, fast and touch-friendly, with smooth animations.
- Cart: add/remove/adjust quantity.
- Optional guest **name** field.
- Out-of-stock items render **greyed-out and unselectable** (driven by product stock count).
- Payment choice:
  - **PayPal:** show a QR code with the **order amount pre-filled**; the order enters the kitchen **only** after the guest taps **"Ich habe bezahlt"**.
  - **Bar:** the order is sent to the **Kasse** queue (not the kitchen) until the till confirms collection.

**Kasse (`/kasse`, staff device)**

- Queue of **cash orders awaiting collection**; confirming an order releases it into the kitchen.
- **Place orders on behalf of guests** (same ordering UI as the terminal), for cash or PayPal.

**Küchenmonitor (`/kueche`, staff device)**

- All **open** orders, **sorted by arrival time**.
- Each order shows a **live waiting timer** (how long the guest has waited).
- Actions per order: **edit**, **delete**, **mark done**. Marking done moves the order to **ready (green)** on the Abholmonitor.

**Abholmonitor (`/abholung`, TV, public)**

- Live list of orders: **in progress** vs. **ready for pickup (green)**, by name/number.
- Large, glanceable, animated transitions when an order becomes ready.

**Admin-Dashboard (`/admin`, staff device)**

- Manage **categories** (create/edit/delete/reorder).
- Manage **products** (create/edit/delete): name, price, category, image/icon, optional **stock count**.
- Adjust stock counts; when a count hits zero the item auto-greys on the terminal.
- Self-explanatory, no manual needed.

### Out of scope (do not build unless explicitly requested)

- Any **online / cloud** feature: remote access, cloud sync, cloud backups, hosted anything.
- **Real payment processing / verification** — PayPal stays trust-based, QR-only. No Stripe, no PayPal API, no webhooks.
- **User accounts / login / roles-with-permissions** — access is device-role cookie only.
- **Bon / receipt printing** — screen-based only (no ESC/POS, no printer).
- **Hier-Essen / Mitnehmen** distinction — not needed.
- Multi-tenant / multi-café support — this is one café, one Pi.

---

## 5. Data model (SQLite via Drizzle, source of truth)

Keep the schema in Drizzle (`src/lib/schema.ts` + `drizzle/` migrations). Regenerate/apply migrations before testing when the schema changes.

Core tables (indicative — refine in implementation prompts):

- `categories` — id, name, sort order, active.
- `products` — id, category_id, name, price (store as integer **cents**), image/icon, `stock_count` (nullable = unlimited), active, sort order.
- `orders` — id, short order number, optional `guest_name`, `payment_method` (`paypal` | `cash`), `status`, `created_at`, `paid_confirmed_at`, `ready_at`, `source` (`terminal` | `kasse`), total in cents.
- `order_items` — id, order_id, product_id, product name snapshot, unit price snapshot (cents), quantity.
- `settings` — key/value for café-wide config (e.g. PayPal.me handle for the QR, café name).

### Order status model (single source of truth — define once, reuse everywhere)

Suggested statuses; confirm exact set in the first order-flow prompt:

- `awaiting_payment` — PayPal chosen, guest hasn't tapped "Ich habe bezahlt" yet (not visible to kitchen).
- `awaiting_cash` — cash chosen, sitting in the **Kasse** queue (not visible to kitchen).
- `in_kitchen` — released to the kitchen (PayPal confirmed, or cash collected).
- `ready` — kitchen marked done → **green** on the Abholmonitor.
- `collected` / `cancelled` — terminal states (archived / removed).

Rules:

- **Money is stored in integer cents**, never floats. Format to euros only in the UI (German formatting).
- **Snapshot product name and price onto `order_items`** at order time, so later product/price edits don't rewrite past orders.
- Stock: decrement `stock_count` when an order is placed (define the exact moment in the order-flow prompt); zero ⇒ greyed-out on the terminal.
- Every write here emits a real-time event (section 6).

When any field changes: write a Drizzle migration, apply it, and update shared types before testing.

---

## 6. Real-time & server layer (Next.js `src/app/api/*` + SSE)

Real-time sync is the defining requirement: an order placed on the terminal must appear on Kasse/Küche **instantly**, and "mark done" must turn the Abholmonitor green **instantly** — no polling-driven refresh visible to staff.

Design:

- **One in-process event bus** (`src/lib/events.ts`) — a simple typed emitter. Every order/product mutation publishes an event (`order:created`, `order:updated`, `order:status`, `product:updated`, …).
- **SSE endpoint** (`src/app/api/events/route.ts`) — each screen subscribes; the handler streams relevant events. Clients reconnect automatically (SSE built-in); on (re)connect, they refetch current state, then live-patch from events.
- **Mutation route handlers** — create/update/delete orders, confirm cash, confirm PayPal, mark done, manage products/stock. Each validates input with **Zod**, writes via Drizzle, then **broadcasts** on the bus.
- Keep the transport swappable behind a thin client hook (`useOrders`) so SSE could be replaced with WebSockets later without touching UI code — but **default to SSE**; don't add a WebSocket server unless a concrete need appears.

Rules:

- The app runs as a **single persistent Node process** — in-memory pub/sub is intentional and correct here. Do not architect for serverless / multi-instance.
- No mutation without a broadcast. A screen must never need a manual refresh to see a change.
- Route handlers are thin, typed, single-purpose; no UI or business logic mixed in.

---

## 7. Workflow (every implementation request)

For every implementation request:

1. Read `AGENTS.md`.
2. Read the skills explicitly mentioned by the user.
3. Read clearly needed supporting skills from the approved skill list (section 8).
4. Inspect relevant code.
5. Ask a focused question only if the task has meaningful ambiguity.
6. Create a detailed prompt file in `prompts/`.
7. Ask: `I prepared the implementation prompt at prompts/<file-name>.md. Is this good to execute?`
8. On approval, re-read the approved prompt file in `prompts/` and implement it strictly. Implement only after user approval.
9. Run available checks.
10. Share exact steps to test or run the completed feature (including how to open each surface from another device on the LAN).

Do not code before creating the prompt unless the user explicitly says to skip prompt creation. (The initial scaffold/foundation setup was done directly with the user's consent.)

---

## 8. Skills

Use the approved skills for the work at hand:

- **`impeccable`** — UI/UX and frontend polish: visual hierarchy, layout, spacing, typography, color, responsive/touch behavior, states (loading/empty/error), and micro-interactions. Use it for any meaningful terminal, monitor, or dashboard design work — these are large touchscreens and a TV, so legibility-at-distance and big touch targets matter.
- **`ui-ux-pro-max`** and **`ui-styling`** — component, color, typography, motion and shadcn/Tailwind guidance. Reach for these when building or restyling any surface so the result looks intentional and branded, not like a default template.

For **Next.js** itself, read the local docs under `node_modules/next/dist/docs/` (routing, server/client boundaries, route handlers, streaming/SSE, caching) — this is the authoritative reference; check it before relying on APIs from memory.

For **Drizzle**, **Zod**, **Tailwind**, **shadcn/ui** and **Framer Motion**, use the packages' own docs and existing project patterns.

Do not invent new skills.

---

## 9. Prompt files

Live in `prompts/`, named by feature (e.g. `prompts/order-flow.md`, `prompts/terminal-ordering.md`, `prompts/kitchen-monitor.md`, `prompts/realtime-sse.md`, `prompts/admin-products.md`).

Each prompt includes: goal · existing code inspected · decisions/assumptions · files likely to change · implementation requirements · **real-time/broadcast requirements** · acceptance criteria · checks to run · exact manual test steps (including which device/surface to open).

For UI tasks also include: layout, typography, spacing, colors, responsiveness, touch-target sizing, TV legibility where relevant, animation, and states (loading/empty/error).

---

## 10. Commands & checks

From the project root:

- `npm run dev` — Next.js dev server (http://localhost:3000).
- `npm run build` — Next.js production build (standalone output for the Pi).
- `npm run lint` — ESLint.
- `npm run db:generate` / `npm run db:migrate` — Drizzle migrations (once configured).
- `npm test` — test runner (once configured).

After implementation run **lint** at minimum, plus **test** where tests exist, and **build** when the change could affect it. Report the exact command output — never claim a check passed without running it.

---

## 11. Security & code standards

- **Trusted LAN, but still be sane:** no secrets belong in browser code. The PayPal handle and café settings live in the DB/`settings`, not hardcoded. Device-role cookies are signed/httpOnly.
- **No internet calls at runtime.** The running app must work with the Pi fully offline. No external fonts/CDNs at runtime, no cloud APIs — bundle assets locally.
- **All mutations server-side**, Zod-validated, via Drizzle. The browser never writes the DB directly.
- Money is integer **cents** end to end; format only at the UI edge.

Code: TypeScript throughout · small functions with explicit types · centralized constants (statuses, limits) · safe error handling. Avoid `any`, unrelated refactors, over-engineering, long handlers, and mixing UI with business logic.

### Language conventions

The two languages have strict, separate homes:

- **User-facing UI is 100% German.** Every visible string — labels, buttons, headings, product/category names in copy, validation and error messages, toasts, empty/loading states, dates/number/currency formatting (`€`, German locale) — must be in German. No English leaking into the interface.
- **Code is English-only.** Identifiers (variables, functions, components, types), file names, comments, commit messages, and DB column names are English. **Never mix German and English inside code** — e.g. no `getBestellung` or `markiereFertig`. Keep code fully English (`getOrder`, `markOrderReady`); the German lives only in the UI copy / a central messages module.
- Keep user-facing German copy in one place (a translations/messages module), so wording stays consistent and reviewable.

---

## 12. Guiding principles

- **Local-first, offline-always.** One Raspberry Pi, one LAN, no internet dependency. Reject any design that needs the cloud.
- **Real-time or it's broken.** Kasse, Küche and Abholmonitor must reflect every change instantly via SSE — never rely on a human hitting refresh.
- **Trust-based payment.** PayPal is a QR + "Ich habe bezahlt"; cash is a Kasse confirmation. No verification, no gateway, no secrets.
- **Fast and delightful on touch.** Snappy interactions, smooth Framer Motion animations, big touch targets, glanceable TV monitor — even on Pi-class hardware.
- **One source of truth per concept:** one product catalog, one order status model, one messages module. No competing/parallel components.
- **Money in cents, names/prices snapshotted** onto order items so history stays correct.
- **Keep it in scope.** No login systems, no receipt printers, no dine-in/takeaway split, no multi-café — unless explicitly requested.

---

## Quick reference (target layout — Next.js, `src/`)

- Surfaces: `src/app/terminal/*` (guest), `src/app/kasse/*`, `src/app/kueche/*`, `src/app/abholung/*`, `src/app/admin/*`
- Real-time: `src/app/api/events/route.ts` (SSE) + `src/lib/events.ts` (in-process bus)
- Mutations: `src/app/api/*` route handlers (orders, cash-confirm, paypal-confirm, mark-done, products, stock)
- Device roles: `src/proxy.ts` (Next 16 proxy convention) + a one-time `/setup` page writing a role cookie
- Data: `src/lib/schema.ts` + `drizzle/` migrations (SQLite); `src/lib/db.ts` Drizzle client
- Client state: `src/hooks/` (`useOrders`, `useCart`, `useDeviceRole`, `useWaitTimer`)
- Runtime: single Node process via `pm2` on the Pi; other devices are kiosk browsers on the LAN pointing at the Pi's IP
