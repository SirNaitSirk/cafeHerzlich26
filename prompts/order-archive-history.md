# Prompt: Dauerhafte, schreibgeschützte Bestellhistorie (Admin)

## Ziel

Eine **permanente, rein lesende Bestellhistorie** aller Bestellungen, die je **in der Küche angekommen** sind (= abkassiert/bezahlt). Sie ist **nicht über das UI löschbar** — kein Löschen-/Stornieren-Button, keine Restore-Aktion. Sie ist **tagesübergreifend** (alle Tage, nicht nur heute) und wird im **Admin-Dashboard** als neuer Reiter „Bestellhistorie" angezeigt. Live-Aktualisierung via SSE.

Diese Historie ist **getrennt** von der bestehenden Küchen-Historie (`OrderHistory` in `src/components/kueche/order-history.tsx`), die nur den heutigen Tag zeigt und Restore erlaubt.

## Entscheidungen (mit dem User bestätigt)

- **„In der Küche angekommen"-Marker:** `orders.paidConfirmedAt IS NOT NULL`. Dieses Feld wird exakt beim Eintritt in die Küche gestempelt (PayPal bestätigt bei Erstellung; Bar am Terminal beim `confirmCashPayment`; Bar an der Kasse bei Erstellung). Damit umfasst die Historie genau alle abkassierten/bezahlten Bestellungen — abgebrochene, nie bezahlte (`awaiting_payment`/`awaiting_cash`) tauchen **nicht** auf. **Kein Schema-Change nötig.**
- **Stornierte/gelöschte Bestellungen erscheinen** — mit Kennzeichnung (rot/durchgestrichen, Badge „Gelöscht"). Sie hatten `paidConfirmedAt` gesetzt (nur `in_kitchen` → `cancelled` möglich), sind also Teil des Nachweises. **Nichts verschwindet.**
- **Ort:** neuer Admin-Tab „Bestellhistorie" neben Kategorien/Produkte/Extras/Einstellungen. Lädt bei Bedarf (erst wenn der Tab aktiv ist), live via SSE.
- **Umfang:** wirklich alle, **nach Tagen gruppiert** (Datum-Überschrift, neueste zuerst; innerhalb eines Tages neueste zuerst).
- **Rein lesend:** keine Buttons, die den Zustand ändern. Keine neue Mutations-Route.

## Inspizierter Code

- `src/lib/orders.ts` — `listOrders`, `listOrderHistory` (heute, `HISTORY_STATUSES`), `hydrateOrders`, `OrderWithItems`. `HISTORY_STATUSES = ["ready","collected","cancelled"]`. `startOfTodayMs()` bounded die heutige Historie.
- `src/lib/db/schema.ts` — `orders` mit `paidConfirmedAt`, `readyAt`, `cancelledAt`, `createdAt` (alle epoch ms). `OrderStatus`.
- `src/app/api/orders/route.ts` — `GET` mit `scope`-Enum; mappt Scope → Statuslisten bzw. `listOrderHistory()`.
- `src/hooks/use-orders.ts` — `OrdersScope`-Union, `useOrders(scope, initial)` refetcht bei `orders:changed`.
- `src/components/kueche/order-history.tsx` + `history-order-card.tsx` — Muster für Historien-Karten (Badges, Items, Summe, Storno-Styling). **Als Vorlage nutzen, nicht wiederverwenden mit Restore.**
- `src/components/admin/admin-dashboard.tsx` — `Tab`-Union, `TABS`-Array, Tab-Rendering. `src/app/admin/page.tsx`.
- `src/lib/messages.ts` — `adminMessages` (ab Z. 326), `kitchenMessages.history` (ab Z. 228), `formatEuros`/`formatTime` in `src/lib/format.ts`.

## Umzusetzende Änderungen

### 1. Server-Read: `src/lib/orders.ts`

- Neue exportierte Funktion `listOrderArchive(): OrderWithItems[]`.
  - Selektiert alle `orders` mit `isNotNull(orders.paidConfirmedAt)` (aus `drizzle-orm` importieren).
  - Sortierung: `orderBy(desc(coalesce(cancelledAt, readyAt, paidConfirmedAt, createdAt)), desc(orders.id))` — Zeitpunkt, an dem die Bestellung ihren Endzustand erreichte, neueste zuerst. (Analog zum `resolvedAt`-Muster in `listOrderHistory`, aber mit `paidConfirmedAt` als weiterem Fallback und **ohne** Tages-Grenze.)
  - `hydrateOrders(...)` anhängen und zurückgeben.
  - Kurzer JSDoc-Kommentar: dauerhaft, tagesübergreifend, rein lesend; Marker = paidConfirmedAt.
- Keine neuen Statuskonstanten nötig (der Filter ist der Marker, nicht die Statusliste).

### 2. API-Scope: `src/app/api/orders/route.ts`

- `scopeSchema` um `"archive"` erweitern.
- Im `GET`: `parsed.data === "archive" ? listOrderArchive() : …` (analog zum bestehenden `history`-Zweig). `listOrderArchive` importieren.
- JSDoc am `GET` um den `archive`-Scope ergänzen.

### 3. Client-Hook: `src/hooks/use-orders.ts`

- `OrdersScope` um `"archive"` erweitern. Sonst keine Änderung — der bestehende Refetch-bei-`orders:changed`-Mechanismus deckt Live-Updates ab.

### 4. Neue Komponenten (`src/components/admin/`)

- `order-archive.tsx` (Client Component):
  - Nutzt `useOrders("archive", initial)` — `initial` als Prop vom Server (siehe 5), damit der erste Render sofort Daten hat.
  - Gruppiert `orders` nach Kalendertag (lokale Zeit) via Endzeit-Key (dieselbe `coalesce`-Reihenfolge wie die Sortierung; als Helper im Client aus den vorhandenen Feldern berechnen). Reihenfolge: Tage neueste zuerst, innerhalb neueste zuerst (Server liefert bereits sortiert — Gruppierung muss die Reihenfolge bewahren).
  - Pro Tag eine Datums-Überschrift (deutsches Format, z. B. „Donnerstag, 28. August 2026"; über `Intl.DateTimeFormat("de-DE", …)` oder einen Helper in `src/lib/format.ts`).
  - Rendert pro Bestellung eine **rein lesende** Karte (siehe unten). **Keine** Restore-/Lösch-/Edit-Buttons.
  - `hasError` → dezenter Offline-Hinweis (`WifiOffIcon` + Text), Muster aus `order-history.tsx`.
  - Empty-State: Icon (`HistoryIcon`) + „Noch keine Bestellungen in der Historie."
- `archive-order-card.tsx` (Client Component), abgeleitet aus `history-order-card.tsx`, aber **ohne** `onRestore`/Button:
  - Zeigt `orderDisplayLabel(order)`, Status-Badge (Fertig/Abgeholt/Gelöscht — grün bzw. rot), Zahlungs-Badge, Quellen-Badge, Endzeit (`formatTime`).
  - Storno: rot, durchgestrichen (wie Vorlage).
  - Item-Liste mit Menge, `nameSnapshot`, Zeilensumme; **Modifier-Snapshots** je Item anzeigen (die Vorlage zeigt sie noch nicht — hier ergänzen: kleine, gedämpfte Liste der `item.modifiers[].nameSnapshot`, optional `groupNameSnapshot`), damit die Historie vollständig ist.
  - Gesamtsumme (`formatEuros(order.totalCents)`).
  - `motion.li` mit `layout`/`AnimatePresence` wie Vorlage (dezente Ein-/Ausblendung bei Live-Updates).

### 5. Admin-Integration

- `src/components/admin/admin-dashboard.tsx`:
  - `Tab`-Union um `"history"` erweitern; `TABS`-Array um `{ id: "history", label: t.tabs.history }` ergänzen.
  - Im Tab-Panel `tab === "history"` → `<OrderArchive initial={initialArchive} />` rendern.
  - Neue Prop `initialArchive: OrderWithItems[]` am `AdminDashboard`.
- `src/app/admin/page.tsx`:
  - `listOrderArchive()` (aus `@/lib/orders`) serverseitig aufrufen und als `initialArchive` übergeben. Seite ist bereits `dynamic = "force-dynamic"`.

### 6. Deutsche Texte: `src/lib/messages.ts`

- `adminMessages.tabs.history = "Bestellhistorie"`.
- Neuer Block `adminMessages.archive` mit: `title`, `empty`, `connectionLost`, Status-Badges (`done`/`collected`/`cancelled`), ggf. `total`-Label, Zeit-Präfixe (analog `kitchenMessages.history.doneAt`/`cancelledAt`). Keine deutschen Strings in Komponenten hardcoden — alles hier.

## Real-time / Broadcast

- **Keine neuen Broadcasts.** Alle relevanten Mutationen (`createOrder`, `confirmCashPayment`, `markOrderReady`, `collectOrder`, `cancelOrder`, `restoreOrder`, `updateOrder`) senden bereits `orders:changed`. Die Admin-Historie hört über `useOrders("archive", …)` mit und refetcht automatisch → neue abkassierte/fertige/gelöschte Bestellungen erscheinen live, ohne manuelles Neuladen.

## Akzeptanzkriterien

- Neuer Admin-Tab „Bestellhistorie" zeigt **alle** Bestellungen mit `paidConfirmedAt IS NOT NULL`, tagesübergreifend, nach Tagen gruppiert, neueste zuerst.
- Bestellungen, die **nie** in die Küche kamen (abgebrochene PayPal-/Bar-Terminal-Bestellungen ohne Bestätigung), erscheinen **nicht**.
- **Gelöschte/stornierte** Bestellungen erscheinen mit klarer Kennzeichnung.
- **Kein** Element in der Historie verändert Daten: keine Lösch-, Storno-, Restore- oder Edit-Aktion, keine neue Mutations-Route.
- Eine neue Bestellung, die abkassiert wird / fertig wird / gelöscht wird, erscheint **live** in der Historie (SSE), ohne Reload.
- Beträge in Euro (deutsches Format), alle UI-Texte deutsch; Code englisch.

## Checks

- `npm run lint`
- `npm run build`

## Manuelle Testschritte

1. `npm run dev`, `/setup` als **Admin**-Rolle (falls nötig), `/admin` öffnen → Tab **„Bestellhistorie"**.
2. Am **Terminal** (`/terminal`, anderes Gerät/Tab) eine **PayPal**-Bestellung abschließen und „Ich habe bezahlt" tippen → erscheint sofort in der Admin-Historie (Live, kein Reload).
3. Am Terminal eine **Bar**-Bestellung aufgeben (landet in `/kasse`), an der **Kasse** abkassieren → erscheint jetzt in der Historie.
4. Eine Terminal-Bestellung **ohne** Bezahlbestätigung abbrechen → erscheint **nicht** in der Historie.
5. In der **Küche** (`/kueche`) eine Bestellung auf „fertig" → Badge/Status in der Historie aktualisiert sich live; danach an der Kasse „abgeholt" → Badge wechselt.
6. In der Küche eine Bestellung **löschen** → erscheint in der Historie rot/durchgestrichen als „Gelöscht"; **kein** Restore-Button in der Historie.
7. Prüfen, dass die Historie **kein** Element zum Ändern/Löschen enthält.
8. LAN: `/admin` von einem anderen Gerät über die Pi-IP öffnen, Tab „Bestellhistorie" — dieselben Daten, live.
