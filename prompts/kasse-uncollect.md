# Kasse: fälschlich abgeholte Bestellungen zurückholen

## Goal

An der Kasse muss eine Bestellung, die versehentlich auf **„Abgeholt"** getippt wurde,
wieder in die Liste **„Abholbereit"** zurückgeholt werden können (`collected` → `ready`).
Heute verschwindet so eine Bestellung sofort und ist nur noch in der Admin-Historie
(read-only) sichtbar — es gibt keinen Weg zurück.

## Existing code inspected

- `src/lib/orders.ts` — `collectOrder(id)` setzt `ready` → `collected` (kein Restock).
  `restoreOrder(id)` (`cancelled` → `in_kitchen`) ist die vorhandene Blaupause für eine
  Rücknahme inkl. `OrderTransitionError`-Guard. `READY_STATUSES`, `listOrders`,
  `hydrateOrders`, `startOfTodayMs()`, `listOrderHistory()` sind vorhanden.
- `src/app/api/orders/[id]/route.ts` — PATCH mit `z.discriminatedUnion("action", …)`;
  Actions `ready | cash | collect | restore | update`, jeweils mit `broadcast({type:"orders:changed"})`.
- `src/app/api/orders/route.ts` — GET `?scope=…`, `SCOPE_STATUSES`-Map + `scopeSchema`.
- `src/hooks/use-orders.ts` — `OrdersScope`-Union, live über SSE.
- `src/components/kasse/kasse-dashboard.tsx` — zwei Spalten (Barzahlungen / Abholbereit),
  `patchOrder(id, action, successMessage)`-Helper, Toaster, Vollbild-Panels
  (`AvailabilityPanel`, `OrderFlow`) als Alternativ-Screens.
- `src/components/kasse/ready-order-card.tsx` — Kartendesign der Abholbereit-Spalte.
- `src/lib/messages.ts` — `kasseMessages` (alle deutschen Strings; nichts hartcodiert).
- `src/lib/db/schema.ts` — `orders` hat `createdAt`, `paidConfirmedAt`, `readyAt`,
  `cancelledAt` — **kein** `collectedAt`.

## Decisions / assumptions

1. **Rückweg ist `collected` → `ready`**, nicht `→ in_kitchen`. Die Küche hat die
   Bestellung tatsächlich fertig gemacht; sie soll wieder abholbereit (grün) sein und
   auch auf dem Abholmonitor wieder erscheinen.
2. **Kein Restock**, symmetrisch zu `collectOrder` — die Ware existiert weiter.
3. **`readyAt` bleibt unangetastet**, damit der „fertig seit"-Timer ehrlich bleibt
   (gleiche Logik wie `restoreOrder`, das `createdAt` nicht anfasst).
4. **Keine Migration.** Es gibt keinen `collected_at`-Zeitstempel; die Liste der zuletzt
   abgeholten Bestellungen wird nach `readyAt` desc sortiert (≈ Abholreihenfolge) und auf
   **heute** begrenzt (passt zur täglich zurückgesetzten Bestellnummer, wie
   `listOrderHistory`).
5. **Zwei Wege zurück**, weil der Fehler sofort *oder* später auffallen kann — auch an
   einem anderen Gerät:
   - **Undo direkt im Erfolgs-Toast** („Abgeholt • Rückgängig") für den Sofortfall.
   - **Ausklappbare Liste „Zuletzt abgeholt"** unter der Abholbereit-Spalte für alles
     spätere. Kein Vollbild-Panel — die Liste soll neben den Queues sichtbar bleiben.
6. Die Rücknahme ist eine reguläre Statusänderung → **`orders:changed` broadcasten**,
   damit Abholmonitor und alle Kassen-Geräte sofort mitziehen. Kein `catalog:changed`
   (kein Bestand berührt).

## Files likely to change

| Datei | Änderung |
| --- | --- |
| `src/lib/orders.ts` | `COLLECTED_STATUSES`, `listCollectedToday()`, `uncollectOrder(id)` |
| `src/app/api/orders/[id]/route.ts` | PATCH-Action `"uncollect"` |
| `src/app/api/orders/route.ts` | Scope `"collected"` |
| `src/hooks/use-orders.ts` | `OrdersScope` um `"collected"` erweitern |
| `src/app/kasse/page.tsx` | `initialCollectedOrders` laden und durchreichen |
| `src/components/kasse/kasse-dashboard.tsx` | `uncollect`-Handler, Undo-Toast, Bereich „Zuletzt abgeholt" |
| `src/components/kasse/collected-order-card.tsx` | **neu** — kompakte Karte mit „Zurückholen" |
| `src/lib/messages.ts` | neue deutsche Strings unter `kasseMessages` |

## Implementation requirements

### Server (`src/lib/orders.ts`)

```ts
/** Statuses the Kasse "recently collected" list shows (undo target). */
export const COLLECTED_STATUSES = ["collected"] as const;

/** Today's collected orders, newest-ready first — the Kasse undo list. */
export function listCollectedToday(): OrderWithItems[]

/**
 * Kasse takes back an accidental pickup: collected → ready. No restock (the goods
 * were never returned to the shelf) and readyAt stays untouched, so the "fertig
 * seit" timer keeps telling the truth.
 */
export function uncollectOrder(id: number): void
```

- `uncollectOrder` folgt exakt dem Muster von `collectOrder`/`restoreOrder`:
  `db.transaction` → `requireOrder` → Guard `order.status !== "collected"` →
  `throw new OrderTransitionError()` → `update(orders).set({ status: "ready" })`.
- `listCollectedToday()` nutzt `hydrateOrders`, filtert
  `inArray(orders.status, [...COLLECTED_STATUSES])` **und** `gte(orders.createdAt, startOfTodayMs())`,
  sortiert `desc(coalesce(readyAt, createdAt)), desc(orders.id)`.

### API

- `[id]/route.ts`: `z.object({ action: z.literal("uncollect") })` in die Union,
  Branch ruft `uncollectOrder(id)` + `broadcast({ type: "orders:changed" })`,
  antwortet `{ ok: true }`. Fehler laufen über das vorhandene `errorResponse`
  (409 bei `OrderTransitionError`, 404 bei `OrderNotFoundError`). Doc-Comment ergänzen.
- `route.ts` (GET): `scopeSchema` um `"collected"` erweitern; da die Abfrage
  zeitbegrenzt ist, **nicht** über `SCOPE_STATUSES`, sondern wie `history`/`archive`
  als eigener Branch `listCollectedToday()`.

### Client

- `use-orders.ts`: `OrdersScope` um `"collected"` erweitern (sonst keine Änderung —
  der Hook aktualisiert bereits per SSE).
- `kasse-dashboard.tsx`:
  - `const { orders: collectedOrders } = useOrders("collected", initialCollectedOrders)`.
  - `patchOrder` um `"uncollect"` im Action-Union erweitern.
  - `collect(id)` zeigt bei Erfolg einen Toast mit **Undo-Action**
    (`toast.success(msg, { action: { label: t.ready.undo, onClick: … } })`).
    Umsetzung: `patchOrder` gibt weiterhin `boolean` zurück; der Undo-Toast wird im
    `collect`-Callback des Dashboards gebaut, nicht im generischen Helper — der Helper
    bekommt dafür ein optionales `options`-Argument oder der Dashboard-Callback ruft
    `toast.success` selbst. Keine Toast-Logik in die Karten verschieben.
  - Neuer Bereich **„Zuletzt abgeholt"** am Fuß der rechten Spalte (unter „Abholbereit"):
    standardmäßig **eingeklappt**, Header-Button mit Anzahl (`t.collected.count`) und
    Chevron; ausgeklappt eine `AnimatePresence`-Liste von `CollectedOrderCard`.
    Bei `collectedOrders.length === 0` wird der Bereich gar nicht gerendert.
- `collected-order-card.tsx` (neu): kompakte, bewusst **zurückhaltende** Karte
  (muted/neutral, kein Grün — sie darf die Abholbereit-Spalte nicht dominieren):
  `orderDisplayLabel(order)`, `t.paymentBadge`/`t.sourceBadge`, und ein
  Outline-Button „Zurückholen" (`UndoIcon` aus `lucide-react`) mit lokalem
  `pending`-State wie in `ReadyOrderCard` (bei Erfolg animiert die Karte raus).

### Messages (`src/lib/messages.ts`, `kasseMessages`)

```ts
ready: { …, undo: "Rückgängig" },
collected: {
  heading: "Zuletzt abgeholt",
  count: (count: number) => (count === 1 ? "1 Bestellung" : `${count} Bestellungen`),
  hint: "Versehentlich abgeholt? Hier zurückholen.",
  action: "Zurückholen",
  collapse: "Einklappen",
  expand: "Anzeigen",
},
toasts: { …, uncollectSuccess: "Zurück in die Abholung.", uncollectGone: "Diese Bestellung ist nicht mehr abgeholt." },
```
Alles Sichtbare deutsch, aller Code englisch (`uncollectOrder`, `listCollectedToday`,
`CollectedOrderCard`).

## UI details

- **Touch:** „Zurückholen"-Button und der Aufklapp-Header mindestens `h-12`;
  Undo-Action im Toast ist bewusst nur die *Sofort*-Hilfe, die Liste der verlässliche Weg.
- **Hierarchie:** „Abholbereit" bleibt visuell dominant (grün, große Karten);
  „Zuletzt abgeholt" ist gedämpft, eingeklappt, mit dünnem Trenner (`border-t`) abgesetzt.
- **Layout:** Der Bereich sitzt außerhalb des `overflow-y-auto`-Containers der
  Abholbereit-Liste, damit er beim Scrollen nicht wegrutscht; die Liste selbst bekommt
  eine eigene `max-h` mit Scroll, damit der Dashboard-Grid nicht bricht.
- **Motion:** gleiche `motion.li`-Spring-Werte wie `ReadyOrderCard`; Auf-/Zuklappen mit
  `AnimatePresence` + `height: auto`.
- **States:** leer → Bereich unsichtbar; Fehler → bestehender `connectionLost`-Hinweis
  im Header deckt es ab (`hasError` um den collected-Scope erweitern).

## Real-time / broadcast requirements

- `uncollect` broadcastet `orders:changed`. Kein `catalog:changed` (kein Bestand berührt).
- Nach dem Zurückholen muss die Bestellung **ohne Reload** wieder erscheinen:
  in der Kasse-Spalte „Abholbereit", auf `/abholung` grün, und aus „Zuletzt abgeholt"
  verschwinden — auf **allen** Geräten.
- Zwei Kassen gleichzeitig: der zweite Klick bekommt 409 → Toast `t.toasts.uncollectGone`,
  kein Doppel-Status.

## Acceptance criteria

1. „Abgeholt" antippen → Toast mit „Rückgängig"; Klick darauf holt die Bestellung sofort
   zurück nach „Abholbereit".
2. Der Bereich „Zuletzt abgeholt" listet die heute abgeholten Bestellungen (neueste zuerst)
   und holt jede per „Zurückholen" nach „Abholbereit" zurück.
3. Die zurückgeholte Bestellung erscheint sofort (SSE, kein Reload) auf allen Kassen-Geräten
   und wieder grün auf `/abholung`.
4. `readyAt` ist unverändert (Timer läuft weiter), Bestände sind unverändert.
5. Zurückholen einer Bestellung, die nicht mehr `collected` ist → 409 + deutscher Toast,
   kein Statuswechsel.
6. Der Bereich ist unsichtbar, solange heute nichts abgeholt wurde.
7. Küchen-Monitor und Bar-Queue bleiben unberührt.

## Checks to run

- `npm run lint`
- `npm run build`
- (`npm test` nur, falls inzwischen konfiguriert)

## Manual test steps

1. `npm run dev`, Pi-/Rechner-IP notieren (`http://<IP>:3000`).
2. Gerät A: `/terminal` → Bestellung mit Namen aufgeben, PayPal → „Ich habe bezahlt".
3. Gerät B: `/kueche` → Bestellung „Fertig" → erscheint grün auf `/abholung` (Gerät C, TV).
4. Gerät D: `/kasse` → „Abgeholt" tippen → Toast erscheint → **„Rückgängig"** tippen:
   Bestellung steht wieder unter „Abholbereit"; auf `/abholung` (Gerät C) wieder grün —
   ohne Reload.
5. Nochmals „Abgeholt", Toast auslaufen lassen → „Zuletzt abgeholt" aufklappen →
   „Zurückholen" → gleiches Ergebnis, ebenfalls live auf allen Geräten.
6. Zwei `/kasse`-Tabs offen: in beiden dieselbe Bestellung zurückholen → der zweite Tab
   zeigt „Diese Bestellung ist nicht mehr abgeholt.", Status bleibt korrekt.
7. `/admin` → Bestellhistorie: Bestellung erscheint nach dem Zurückholen wieder als
   „Erledigt" statt „Abgeholt".
