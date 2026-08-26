# Prompt: Order-Flow & Bestellterminal

## Goal

Build the public **Bestellterminal** (`/terminal`) end to end: the McDonald's/Burger-King-style flow from an idle **welcome/attract screen** → category + product browsing → cart → optional name → payment choice (**Bar** or **PayPal-QR**) → order persisted to the DB and broadcast to all screens → confirmation → auto-return to welcome.

This is the first surface and also establishes the **order creation API + status flow** that Kasse, Küche and Abholmonitor will later consume.

Structural reference: the two kiosk screenshots in the repo root (`Burger King - new digital kiosk experience.jpeg`, `_.jpeg`). Adopt the **structure** (full-bleed attract screen with a large CTA; a vertical category rail on the left; a scrollable product-card grid; a persistent cart bar at the bottom). **Do not** copy the colors — the look should be modern, clean, warm and distinctly "Cafe Herzlich", with smooth, tasteful animations. The white community logo (`Gemeinde-Logo_weiss-600x338.png`) is white-on-transparent, so it needs a dark/colored backdrop (use it on the welcome screen).

## Existing code inspected

- `src/lib/db/schema.ts` — `categories`, `products`, `orders`, `order_items`, `settings`; `ORDER_STATUSES`, `PAYMENT_METHODS`, `ORDER_SOURCES` constants; money in integer cents; `products.stockCount` (NULL = unlimited, 0 = unavailable).
- `src/lib/db/index.ts` — server-only Drizzle client (`db`).
- `src/lib/events.ts` — `broadcast()` / event types `orders:changed`, `catalog:changed`.
- `src/app/api/events/route.ts` — SSE endpoint (already live).
- `src/hooks/use-event-stream.ts` — `useEventStream(types, onEvent)` client hook.
- `src/lib/format.ts` — `formatEuros(cents)`.
- `src/lib/roles.ts` — device roles (terminal is public, no gate).
- `src/app/terminal/page.tsx` — current placeholder to replace.
- `src/lib/db/seed.ts` — sample catalog (Kaffee/Kuchen/Kalte Getränke; one cake seeded with `stockCount: 0` to test the greyed-out state).

## Decisions / assumptions (confirm if wrong)

1. **When the order row is created:**
   - **Bar:** persisted when the guest taps "Jetzt bestellen / Bar bezahlen" → status `awaiting_cash`. Shown to Kasse.
   - **PayPal:** the QR (amount pre-filled) is shown **without** persisting yet; the order is persisted only when the guest taps **"Ich habe bezahlt"** → status `in_kitchen`, `paidConfirmedAt` set. This matches the trust-based flow and avoids ghost orders from people who walk away at the QR.
2. **Stock is decremented at order-creation time** (inside the same DB transaction), and the server **re-validates stock** then. If stock is insufficient (someone grabbed the last cake first), return `409` and the terminal shows a friendly German message + refreshes the catalog. Note: PayPal stock is not reserved while the QR is shown (trust-based café) — acceptable.
3. **Totals and prices are computed on the server from the DB**, never trusted from the client. The client sends only `{ productId, quantity }[]`.
4. **Guest name is the primary label**; the order number is a fallback. The **name** (optional, entered by the guest) is what Kasse/Küche/Abholmonitor show prominently (e.g. "Anna"). When no name is given, surfaces show `Bestellung #<orderNumber>` instead. The **order number** is a short, **daily-resetting running number** (first order of the calendar day = 1), assigned server-side inside the transaction — it always runs in the background so every order stays uniquely identifiable even if two guests share a name.
5. **Idle timeout → welcome:** after **90 s** of no interaction anywhere in the flow, return to the welcome screen and clear the cart. Also return to welcome after a completed/cancelled order. (Value centralized as a constant.)
6. **PayPal link format:** `https://www.paypal.com/paypalme/{handle}/{amount}EUR`, `handle` from `settings.paypal_handle`, `amount` = order total. QR rendered **client-side** with the `qrcode` package (no external calls). If no handle is configured, hide PayPal and show only Bar (log a console warning).
7. **Name is optional**, single free-text field, max ~40 chars, German placeholder (e.g. "Dein Name (optional)"). Encouraged in the UI since it's what appears on the pickup monitor, but never required.

## Files likely to change / add

**Server / data**
- `src/lib/orders.ts` — order-creation service: validate items with Zod, load products, compute total, check + decrement stock, assign daily order number, insert order + items in one transaction. Pure server logic, reused by the route handler (and later by Kasse). Also export a small `orderDisplayLabel(order)` helper — returns the guest name, or `Bestellung #<orderNumber>` when empty — so every surface labels orders identically.
- `src/app/api/orders/route.ts` — `POST` create order (Zod-validated) → calls the service → `broadcast({type:"orders:changed"})` and `broadcast({type:"catalog:changed"})` (stock changed) → returns `{ id, orderNumber, totalCents }`. Returns `409` on stock conflict, `400` on invalid input.
- `src/app/api/catalog/route.ts` — `GET` active categories with their active products (id, name, priceCents, imageUrl, stockCount) for the terminal.
- `src/lib/catalog.ts` — shared query used by the API and the terminal server component.

**Client / UI (terminal)**
- `src/app/terminal/page.tsx` — server component: loads initial catalog + café settings, renders the client experience.
- `src/components/terminal/terminal-experience.tsx` — top-level client component holding flow state (`welcome | menu | cart | payment | paypal | success`), cart state, idle timer, catalog refetch on `catalog:changed`.
- `src/components/terminal/welcome-screen.tsx` — attract/standby screen (logo, hero, big "Jetzt bestellen" CTA, ambient animation).
- `src/components/terminal/menu-screen.tsx` — left category rail + product grid + bottom cart bar.
- `src/components/terminal/product-card.tsx` — image/name/price, add button, greyed-out + unselectable when `stockCount === 0`.
- `src/components/terminal/cart-sheet.tsx` — cart review, quantity +/-, remove, name field, "Weiter zur Bezahlung".
- `src/components/terminal/payment-choice.tsx` — Bar vs. PayPal choice.
- `src/components/terminal/paypal-screen.tsx` — QR (amount pre-filled) + "Ich habe bezahlt".
- `src/components/terminal/success-screen.tsx` — confirmation + order number, auto-return.
- `src/hooks/use-cart.ts` — cart state (add/remove/setQty/clear, totals).
- `src/hooks/use-idle-timeout.ts` — resets to welcome after inactivity.
- `src/lib/messages.ts` — central German UI copy for the terminal (single source of truth; no hardcoded strings scattered around).
- shadcn primitives as needed (`button` exists; add `card`, `sheet`/`dialog`, `input` via `npx shadcn@latest add`).

## Implementation requirements

- **Language:** all UI copy German (from `src/lib/messages.ts`); all code identifiers English.
- **Money:** integer cents everywhere; format only via `formatEuros`.
- **Server owns pricing & stock:** never trust client amounts. Validate every input with Zod.
- **Transaction:** create order + items + stock decrement + order-number assignment atomically (better-sqlite3 synchronous transaction).
- **Catalog freshness:** the terminal subscribes via `useEventStream(["catalog:changed"], refetch)` so admin stock changes (and its own purchases) grey out sold-out items live.
- **Idle & reset:** clear cart and return to welcome on idle timeout and after success/cancel.
- Keep route handlers thin; business logic in `src/lib/orders.ts`.

## Real-time / broadcast requirements

- On successful order creation broadcast **both** `orders:changed` (so Kasse/Küche/Abholung update once built) and `catalog:changed` (stock changed).
- The terminal itself reacts to `catalog:changed` to refresh availability.

## UI / design requirements

- **Format:** designed for a large **portrait or landscape touchscreen / iPad**; big touch targets (min ~64px tall interactive elements), generous spacing, high legibility. Fully responsive but optimized for kiosk.
- **Welcome/attract:** full-screen, dark/warm branded backdrop, the white community logo, café name, a large primary "Jetzt bestellen" button, subtle looping ambient motion (e.g. gentle gradient/float). Tapping anywhere starts.
- **Menu:** left vertical **category rail** (icon/label, active state), top optional category chips, main **product-card grid** (image, name, price, "+"), a persistent **bottom cart bar** ("X Artikel · Summe" + "Weiter"). Right-side scroll affordance optional.
- **Out-of-stock** products: greyed, "Ausverkauft" badge, not tappable.
- **Cart:** slide-in sheet; quantity steppers; optional name input; clear total; "Weiter zur Bezahlung".
- **Payment choice:** two large cards "Bar bezahlen" / "Mit PayPal bezahlen".
- **PayPal:** large centered QR with amount label, instructions ("Bitte mit Freunde & Familie zahlen"), prominent "Ich habe bezahlt" button, plus "Zurück".
- **Success:** friendly confirmation, order number, "Vielen Dank", auto-returns to welcome after a few seconds.
- **Animations (Framer Motion / `motion`):** page/step transitions, add-to-cart feedback (item flies/pulses, cart badge bumps), card press states, list reordering — smooth and fast, must not feel sluggish on Pi-class hardware. Respect `prefers-reduced-motion`.
- **States:** loading (initial catalog), empty (category with no items), error (order failed / stock conflict → German toast or inline message), disabled (sold-out).
- Use the **impeccable** and **ui-ux-pro-max** skills for layout, hierarchy, spacing, typography, color and motion.

## Security requirements

- Terminal is public (no role) but **all writes go through the server**; the browser never touches the DB.
- Server recomputes totals/prices from the DB and re-validates stock; reject tampered input.
- No external network calls at runtime — QR is generated locally; no external fonts/CDNs.

## Acceptance criteria

- Idle terminal shows the welcome screen; tap starts an order; 90 s inactivity returns to welcome with an empty cart.
- Guest can browse categories, add/remove items, adjust quantities; sold-out (`stockCount 0`) items are greyed and unselectable.
- Optional name can be entered.
- **Bar:** completing creates an order with status `awaiting_cash`; success screen shows the order number.
- **PayPal:** QR shows the correct pre-filled amount; only "Ich habe bezahlt" creates the order (status `in_kitchen`, `paidConfirmedAt` set).
- Stock decrements on creation; a second attempt to buy the last unit is rejected with a friendly message and the catalog refreshes.
- Order total, items (with name/price snapshots), payment method, source `terminal`, and order number are correctly persisted.
- Creating an order broadcasts `orders:changed` + `catalog:changed` (verify via the SSE stream / a second tab greying out).
- All visible text is German; `npm run lint` and `npm run build` pass.

## Checks to run

- `npm run lint`
- `npm run build`
- Manual test steps below. (No automated test runner configured yet.)

## Exact manual test steps

1. `npm run db:migrate && npm run db:seed` (fresh catalog; note the seeded sold-out cake).
2. `npm run dev`, open http://localhost:3000/terminal.
3. Verify the welcome screen; wait 90 s idle → returns to welcome. Tap → menu.
4. Confirm the sold-out cake is greyed/unselectable; other items add to cart; adjust quantities; enter a name.
5. **Bar flow:** choose Bar → success with order number. In a DB check (`npm run db:studio`) confirm the order row: status `awaiting_cash`, source `terminal`, correct total, item snapshots.
6. **PayPal flow:** new order → choose PayPal → confirm QR amount matches the total → tap "Ich habe bezahlt" → success. Confirm order row: status `in_kitchen`, `paidConfirmedAt` set.
7. **Stock:** set a product's stock to 1 (via studio), order it, then try to order it again → friendly rejection + item greys out live.
8. **Realtime:** open a second tab on the SSE endpoint (`curl -N http://localhost:3000/api/events`) and confirm `orders:changed` / `catalog:changed` fire on each order.
9. `npm run lint` and `npm run build` are green.
