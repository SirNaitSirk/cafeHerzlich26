# Küchenmonitor – Bestellverlauf (erledigte & gelöschte Bestellungen, Wiederherstellen)

## Goal

Dem Küchenmonitor (`/kueche`) einen **Bestellverlauf** hinzufügen, der vergangene
Bestellungen des Tages zeigt: **erledigte** (fertig / abgeholt) und **gelöschte**
(stornierte). Beide Gruppen müssen **klar unterscheidbar** sein. Zweck: versehentlich
gelöschte Bestellungen wieder in die Küche **zurückholen**.

Bestätigte Entscheidungen (mit dem User geklärt):

1. **Umfang:** Verlauf zeigt *erledigte* (`ready` + `collected`) **und** *gelöschte*
   (`cancelled`). **Nur gelöschte** sind wiederherstellbar; erledigte sind reine Ansicht.
2. **Zugang:** Ein **„Verlauf"-Button** im Header des Küchenmonitors öffnet ein
   **Overlay (Dialog)** über dem Monitor – kein Routenwechsel.
3. **Bestand beim Wiederherstellen:** Bestand wird **trotzdem** wieder abgezogen, auch
   wenn er dadurch auf 0 oder negativ geht (Personal-Korrektur hat Vorrang – die Ware
   wurde ohnehin schon zubereitet). Kein Blockieren.
4. **Zeitfenster:** Verlauf ist auf **heute** begrenzt (`createdAt >= Tagesbeginn`) –
   passend zum täglich zurückgesetzten `orderNumber`. Hält die Liste beschränkt.

## Existing code inspected

- `src/lib/db/schema.ts` – `orders` hat `createdAt`, `paidConfirmedAt`, `readyAt`.
  Status-Modell: `awaiting_payment | awaiting_cash | in_kitchen | ready | collected | cancelled`.
  **Kein** `cancelledAt`. `readyAt` wird beim „Erledigt" gesetzt und bleibt auch bei
  `collected` erhalten → eignet sich als „erledigt um"-Zeitpunkt.
- `src/lib/orders.ts` – Lese-/Schreibschicht. `listOrders({ statuses })` (sortiert
  `createdAt asc`), `cancelOrder` (soft: → `cancelled`, `restockItems`), `collectOrder`,
  `markOrderReady`, `updateOrder` (Alles-entfernt → `cancelled`). Status-Konstanten
  (`KITCHEN_STATUSES` etc.) leben hier. `restockItems` bucht Bestand zurück (nur getrackte).
- `src/app/api/orders/route.ts` – `GET ?scope=…` mappt Scope → Status via `SCOPE_STATUSES`,
  `scopeSchema = z.enum(["kitchen","pickup","cash","ready"])`. `POST` erstellt Order.
- `src/app/api/orders/[id]/route.ts` – `PATCH` (discriminated union `action`:
  `ready|cash|collect|update`) und `DELETE` (→ `cancelOrder`). Jede Mutation `broadcast`et.
- `src/hooks/use-orders.ts` – `useOrders(scope, initial)`, seedet + refetcht bei
  `orders:changed`. `OrdersScope = "kitchen"|"pickup"|"cash"|"ready"`.
- `src/components/kueche/kitchen-monitor.tsx` – Header + Live-Grid, `useOrders("kitchen", …)`.
- `src/components/kueche/order-card.tsx` – Live-Karte mit Wartetimer (nicht wiederverwendet).
- `src/lib/messages.ts` – `kitchenMessages` (zentrale deutsche Copy).
- `src/lib/format.ts` – `formatEuros`. `src/lib/order-label.ts` – `orderDisplayLabel`.

## Decisions / assumptions

- **Neue Spalte `cancelledAt` (nullable integer, epoch ms)** auf `orders`. Nur damit lässt
  sich der Löschzeitpunkt anzeigen und der Verlauf sinnvoll (neueste zuerst) sortieren.
  `collected` behält `readyAt` als „erledigt um"; kein zusätzliches `collectedAt` nötig.
  → Migration erforderlich.
- `cancelledAt` wird **bei jeder** Stornierung gesetzt: in `cancelOrder` **und** im
  Cancel-Zweig von `updateOrder` (alle Positionen entfernt). Beim Wiederherstellen wieder
  auf `null`.
- Verlauf sortiert **neueste zuerst** nach `resolvedAt = coalesce(cancelledAt, readyAt, createdAt)`.
- Wiederherstellen: `cancelled → in_kitchen`, `cancelledAt = null`, Bestand erneut
  abziehen (ohne Fehler bei Unterdeckung). **`createdAt` bleibt unverändert**, damit der
  Wartetimer die echte Wartezeit zeigt und die Karte korrekt einsortiert wird.
- Verlauf wird **nur bei geöffnetem Dialog** geladen (History-Komponente mountet dann,
  `useOrders("history", [])` fetcht sofort). Kein Server-Preload auf der Seite.
- Nur `cancelled` ist wiederherstellbar → serverseitig in `restoreOrder` per
  `OrderTransitionError` erzwungen (nicht nur im UI).

## Files likely to change

- `src/lib/db/schema.ts` – Spalte `cancelledAt` ergänzen.
- `drizzle/000X_*.sql` (+ `drizzle/meta`) – Migration via `npm run db:generate`.
- `src/lib/orders.ts` – `HISTORY_STATUSES`, `listOrderHistory()`, `restoreOrder()`,
  `cancelledAt` in `cancelOrder`/`updateOrder`-Cancel setzen; Item-Hydration in Helper
  extrahieren (von `listOrders` + `listOrderHistory` geteilt).
- `src/app/api/orders/route.ts` – Scope `history` (eigener Pfad → `listOrderHistory()`),
  `scopeSchema` erweitern.
- `src/app/api/orders/[id]/route.ts` – PATCH-Action `restore` → `restoreOrder`,
  broadcast `orders:changed` + `catalog:changed`.
- `src/hooks/use-orders.ts` – `OrdersScope` um `"history"` erweitern.
- `src/components/kueche/kitchen-monitor.tsx` – „Verlauf"-Button + Dialog-State.
- `src/components/kueche/order-history.tsx` (neu) – Verlaufs-Liste + Wiederherstellen.
- `src/components/kueche/history-order-card.tsx` (neu, optional) – kompakte Verlaufs-Karte.
- `src/lib/messages.ts` – `kitchenMessages.history` (neue deutsche Copy).

## Implementation requirements

### Schema + Migration
- `cancelledAt: integer("cancelled_at")` (nullable) zu `orders` hinzufügen.
- `npm run db:generate` ausführen, generierte Migration prüfen, dann `npm run db:migrate`.
  SQLite-Schema **nie** von Hand ändern.

### `src/lib/orders.ts`
- `export const HISTORY_STATUSES = ["ready", "collected", "cancelled"] as const;`
- `cancelOrder`: beim Update zusätzlich `cancelledAt: Date.now()` setzen.
- `updateOrder` (Zweig „alle Positionen entfernt"): ebenfalls `cancelledAt: Date.now()` setzen.
- Item-Hydration aus `listOrders` in privaten Helper `hydrateOrders(rows): OrderWithItems[]`
  extrahieren; `listOrders` nutzt ihn weiter.
- `listOrderHistory(): OrderWithItems[]`:
  - lädt `orders` mit Status ∈ `HISTORY_STATUSES` **und** `createdAt >= startOfTodayMs()`,
  - sortiert `desc` nach `coalesce(cancelledAt, readyAt, createdAt)` (dann `id desc`),
  - hydratisiert Items über den geteilten Helper.
- `restoreOrder(id: number): void`:
  - `requireOrder`; wenn `status !== "cancelled"` → `OrderTransitionError`,
  - Items laden, für jede getrackte Position Bestand `- quantity` (analog `createOrder`,
    **ohne** Bestandsprüfung/Fehler – darf auf 0/negativ),
  - `orders`-Update: `status = "in_kitchen"`, `cancelledAt = null` (`createdAt` unangetastet).

### API
- `route.ts`: `scopeSchema` → `z.enum(["kitchen","pickup","cash","ready","history"])`.
  In `GET`: wenn `scope === "history"` → `listOrderHistory()` zurückgeben; sonst wie bisher
  über `SCOPE_STATUSES`. (History nicht in `SCOPE_STATUSES`, da eigene Sortierung/Fenster.)
- `[id]/route.ts`: `patchSchema` um `z.object({ action: z.literal("restore") })` erweitern.
  Handler: `restoreOrder(id)` → `broadcast({ type: "orders:changed" })` **und**
  `broadcast({ type: "catalog:changed" })` (Bestand geändert). Fehler über `errorResponse`
  (409 bei `OrderTransitionError`, 404 bei `OrderNotFoundError`).

### Hook
- `use-orders.ts`: `OrdersScope` um `"history"` erweitern. Sonst unverändert (refetch bei
  `orders:changed` deckt neue Löschungen/Wiederherstellungen live ab).

### UI – Küchenmonitor
- **Header:** neben Zähler ein `Button variant="outline"` mit `HistoryIcon`
  (lucide) + `kitchenMessages.history.open` („Verlauf"). Öffnet `Dialog`.
- **Dialog:** großzügiger `DialogContent` (breit, scrollbar – `ScrollArea` vorhanden).
  Titel `history.title`, Kurzbeschreibung `history.description`. Rendert
  `<OrderHistory />` nur wenn offen (bedingtes Mount).
- **`OrderHistory`:** `useOrders("history", [])`. Zustände:
  - **Loading:** dezenter Hinweis, solange initial noch kein Fetch zurück ist (optional,
    da schnell) – zumindest kein Layout-Sprung.
  - **Empty:** `history.empty` (z. B. „Heute noch keine vergangenen Bestellungen.").
  - **Error:** `hasError` → dezenter Hinweis (`connectionLost`-Stil), Liste bleibt sichtbar.
  - **Liste:** neueste zuerst (Server liefert bereits sortiert). Jede Zeile eine kompakte
    Karte.
- **Kompakte Verlaufs-Karte (`history-order-card.tsx`):**
  - `orderDisplayLabel(order)`, Zahlungs-/Quellen-Badge (wie `order-card`), Positionsliste
    (`quantity× nameSnapshot`), Summe `formatEuros(totalCents)`.
  - **Status klar unterscheidbar:**
    - `ready` / `collected` → **grün** (emerald) akzentuiert, Badge `history.badge.done`
      („Erledigt") bzw. `history.badge.collected` („Abgeholt"); Zeit „erledigt um HH:MM"
      aus `readyAt`.
    - `cancelled` → **rot/gedämpft** (destructive, evtl. leicht transparent /
      durchgestrichener Titel), Badge `history.badge.cancelled` („Gelöscht"); Zeit
      „gelöscht um HH:MM" aus `cancelledAt`.
  - Zeit im UI mit `Intl.DateTimeFormat("de-DE", { hour, minute })` formatieren – dafür
    einen Helper `formatTime(ms)` in `src/lib/format.ts` ergänzen (de-DE, offline-sicher).
  - **Nur bei `cancelled`:** Button `history.restore` („Wiederherstellen") →
    `PATCH { action: "restore" }`. Pending-State, danach Toast (Erfolg/Fehler wie in
    `kitchen-monitor` üblich). Bei Erfolg verschwindet die Karte aus dem Verlauf (Refetch)
    und erscheint wieder im Live-Grid.
- **Motion:** dezent (Fade/Layout), muss auf Pi-Hardware flüssig bleiben; kein Wartetimer
  in der Verlaufs-Karte.

### Copy (`kitchenMessages.history`)
Alles Deutsch, zentral:
- `open: "Verlauf"`, `title: "Bestellverlauf"`,
  `description: "Erledigte und gelöschte Bestellungen von heute."`,
- `badge: { done: "Erledigt", collected: "Abgeholt", cancelled: "Gelöscht" }`,
- `doneAt: (t) => \`erledigt um ${t}\``, `cancelledAt: (t) => \`gelöscht um ${t}\``,
- `restore: "Wiederherstellen"`,
- `empty: "Heute noch keine vergangenen Bestellungen."`,
- `toasts: { restoreSuccess: "Bestellung wiederhergestellt.", gone: "Diese Bestellung kann nicht wiederhergestellt werden.", generic: "Etwas ist schiefgelaufen. Bitte erneut versuchen." }`.

## Real-time / broadcast requirements

- `restoreOrder` läuft über den Route-Handler und **broadcastet** `orders:changed`
  (Live-Grid + Verlauf aktualisieren) und `catalog:changed` (Bestand verändert → Terminal).
- Keine Mutation ohne Broadcast. Der Verlauf aktualisiert sich live: löscht die Küche eine
  Bestellung, erscheint sie sofort im offenen Verlauf; wird sie wiederhergestellt,
  verschwindet sie dort und tauct im Live-Grid auf – ohne manuelles Neuladen.

## Acceptance criteria

- „Verlauf"-Button im Küchen-Header öffnet ein Overlay mit den heutigen erledigten +
  gelöschten Bestellungen, neueste zuerst.
- Erledigte (grün) und gelöschte (rot) sind auf einen Blick unterscheidbar, mit Zeitpunkt.
- Nur gelöschte Bestellungen haben „Wiederherstellen"; erledigte nicht.
- Wiederherstellen bringt die Bestellung zurück ins Live-Grid (`in_kitchen`), zieht den
  Bestand erneut ab (auch bei Unterdeckung) und verschwindet aus dem Verlauf – live auf
  allen Screens, ohne Refresh.
- `restore` einer nicht-`cancelled`-Bestellung → 409; UI zeigt `toasts.gone`.
- Geld weiterhin in Cent; alle sichtbaren Strings deutsch; Code englisch.

## Checks to run

- `npm run db:generate` + `npm run db:migrate` (Migration anwenden).
- `npm run lint`
- `npm run build`
- (`npm test`, falls vorhanden.)
Exakte Ausgabe berichten; nichts als bestanden melden, das nicht lief.

## Manual test steps

1. `npm run dev`. Am Terminal (`/terminal`, z. B. Desktop-Browser) eine Bestellung mit
   getracktem Artikel aufgeben (Bar → landet nach Kassenfreigabe / bzw. PayPal direkt in
   der Küche). Notiere den Bestand des Artikels (`/admin`).
2. Am **Küchenmonitor** (`/kueche`, ggf. zweites Gerät/Tab): Bestellung per Papierkorb
   **löschen**. → verschwindet aus dem Grid; Bestand am `/admin` wieder erhöht.
3. **Verlauf** öffnen: gelöschte Bestellung erscheint **rot** mit „gelöscht um HH:MM" und
   „Wiederherstellen".
4. Eine andere Bestellung **Erledigt** markieren → im Verlauf **grün** mit „erledigt um",
   **ohne** Wiederherstellen-Button.
5. Bei der gelöschten „Wiederherstellen" tippen: sie verschwindet aus dem Verlauf und
   erscheint wieder im Live-Grid; Bestand am `/admin` wieder verringert. Prüfe, dass ein
   zweites offenes Fenster (anderes Gerät/Tab) dies **live** ohne Refresh zeigt.
6. Verlauf schließen/öffnen: Zustand korrekt; leere Meldung, wenn heute nichts vorliegt.

Zugriff von anderen LAN-Geräten: `http://<PI-IP>:3000/kueche` im Kiosk-Browser
(Küchen-Rolle); Terminal `http://<PI-IP>:3000/terminal`.
