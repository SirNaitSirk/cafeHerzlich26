# Direktverkauf: Produkte, die nicht in die Küche müssen

## Goal

Manche Produkte (Snickers, Twix, Cola) brauchen keine Zubereitung. Wird eine
Bestellung **an der Kasse** aufgegeben und enthält sie **ausschließlich** solche
Artikel, soll sie gar nicht erst durch Küche und Abholmonitor laufen: kassieren,
aushändigen, fertig.

Am **Terminal** bleibt alles unverändert — dort steht der Gast nicht hinterm
Tresen, jemand muss die Ware ausgeben, also braucht es Küche und Abholmonitor
weiterhin. Die Entscheidung ist also **Produkt-Flag × Quelle**, nicht das Flag
allein.

## Existing code inspected

- `src/lib/db/schema.ts` — `products` (mit `stockCount`, `soldOut`), `orders`
  (`status`, `source`, `paidConfirmedAt`, `readyAt`, `cancelledAt`),
  `orderItems` (Snapshots `nameSnapshot`, `unitPriceCents`), `ORDER_STATUSES`.
- `src/lib/orders.ts` — `initialStatus(method)` (reine Funktion der Zahlart),
  `createOrder()` (synchrone Transaktion, siehe ATOMICITY-Kommentar),
  `confirmCashPayment()` (`awaiting_cash` → `in_kitchen`), `collectOrder()`,
  `uncollectOrder()` (`collected` → `ready`), `markOrderReady()`,
  `cancelOrder()` (nur aus `in_kitchen`, mit `restockItems`), `restoreOrder()`,
  `updateOrder()`, `listCollectedToday()`, `KITCHEN_STATUSES`/`PICKUP_STATUSES`/
  `CASH_QUEUE_STATUSES`/`READY_STATUSES`/`COLLECTED_STATUSES`/`HISTORY_STATUSES`.
- `src/app/api/orders/route.ts` — GET `?scope=…`, POST (`createOrder` +
  `orders:changed` + `catalog:changed`).
- `src/app/api/orders/[id]/route.ts` — PATCH `z.discriminatedUnion("action", …)`
  mit `ready | cash | collect | uncollect | restore | update`, DELETE = Storno.
- `src/lib/admin-catalog.ts` — `AdminProduct`, `createProductSchema`,
  `updateProductSchema`, `createProduct()`, `updateProduct()`,
  `getAdminCatalog()`.
- `src/lib/catalog.ts` — `CatalogProduct`/`getCatalog()` (Terminal + Kasse).
- `src/components/admin/product-form-dialog.tsx` — Produktformular (Name, Preis,
  Kategorie, Bild, Bestand, Optionsgruppen).
- `src/components/kasse/kasse-dashboard.tsx` — Queues, `patchOrder()`-Helper,
  `handleOrderCreated()` → `CashRegisterDialog`, Bereich „Zuletzt abgeholt".
- `src/components/kasse/cash-register-dialog.tsx`, `collected-order-card.tsx`.
- `src/components/terminal/order-flow.tsx` — geteilte Bestell-Maschine
  (`source: "terminal" | "kasse"`), `SuccessScreen`.
- `src/components/kueche/order-card.tsx` — Positionsliste der Küchenkarte.
- `src/lib/messages.ts` — `kasseMessages`, `kitchenMessages`, `adminMessages`.

## Decisions / assumptions

1. **Alles-oder-nichts pro Bestellung** (vom Nutzer bestätigt). Eine Bestellung
   überspringt die Küche nur, wenn **jede** Position `needsPreparation = false`
   hat **und** `source = "kasse"` ist. Gemischte Bestellungen laufen komplett
   normal — **kein** Aufsplitten in zwei Bestellungen (zwei Nummern, zwei
   Zeilen am Abholmonitor, doppelte Storno-Logik = zu viel Komplexität für
   einen Fall, in dem die Küche den Riegel in zwei Sekunden dazulegt).
2. **Neues Produkt-Flag `needsPreparation`** (boolean, NOT NULL, **default
   `true`**) auf `products`. Default true heißt: Bestandsdaten und jedes neu
   angelegte Produkt verhalten sich exakt wie heute; Direktverkauf ist ein
   bewusstes Opt-out im Admin.
3. **Zwei Snapshots, kein Nachschlagen im Katalog.** Wie bei Name und Preis
   darf sich eine bestehende Bestellung nicht rückwirkend ändern, wenn jemand
   das Flag im Admin umlegt:
   - `order_items.needs_preparation` — Snapshot pro Position (die Küche zeigt
     Direktverkaufspositionen abgesetzt an).
   - `orders.direct_sale` — beim Anlegen einmal berechnet und persistiert; die
     Statusübergänge lesen nur noch dieses Feld.
4. **Zielstatus ist `collected`**, kein neuer Status. Die Ware ist im selben
   Moment bezahlt und übergeben; `ORDER_STATUSES` bleibt unverändert. Gesetzt
   werden `paidConfirmedAt` **und** `readyAt` (= `now`), damit Historie,
   Tagesumsatz (`listOrderArchive` filtert über `paidConfirmedAt`) und die
   Sortierung von `listCollectedToday()` (nach `readyAt`) weiter stimmen.
5. **Zwei Einstiegspunkte**, je nach Zahlart:
   - **Bar:** `createOrder` legt wie gehabt `awaiting_cash` an (die Kasse
     kassiert im `CashRegisterDialog`); `confirmCashPayment` setzt bei
     `directSale` **`collected`** statt `in_kitchen`.
   - **PayPal:** `createOrder` legt bei `directSale` direkt **`collected`** an
     (statt `in_kitchen`) — die Bestellung entsteht ohnehin erst nach
     „Ich habe bezahlt".
6. **Storno statt Zurückholen.** Eine Direktverkauf-Bestellung landet sofort in
   „Zuletzt abgeholt". Dort ist „Zurückholen" (`collected` → `ready`) sinnlos —
   sie würde grün am Abholmonitor auftauchen, obwohl sie nie dort war. Deshalb:
   `uncollectOrder` verweigert `directSale`-Bestellungen, und `cancelOrder`
   erlaubt zusätzlich `collected` **wenn** `directSale` (inkl. Restock).
7. **Bestand unverändert** — Dekrement beim Anlegen, wie heute.
8. **Terminal unverändert.** Kein neues UI, keine Kennzeichnung; `source =
   "terminal"` schließt Direktverkauf serverseitig aus.
9. Alle Mutationen broadcasten wie gehabt (`orders:changed`, bei
   Bestandsänderung zusätzlich `catalog:changed`).

## Files likely to change

| Datei | Änderung |
| --- | --- |
| `src/lib/db/schema.ts` | `products.needsPreparation`, `orderItems.needsPreparation`, `orders.directSale` |
| `drizzle/` | neue Migration (`npm run db:generate`) |
| `src/lib/orders.ts` | `initialStatus` → Direktverkauf-Logik, `createOrder`, `confirmCashPayment`, `uncollectOrder`, `cancelOrder` |
| `src/app/api/orders/[id]/route.ts` | keine neue Action nötig — nur ggf. Fehlertexte |
| `src/lib/admin-catalog.ts` | `AdminProduct.needsPreparation`, Create/Update-Schema + Writes, `getAdminCatalog` |
| `src/components/admin/product-form-dialog.tsx` | Umschalter „Muss zubereitet werden" |
| `src/components/admin/product-manager.tsx` | Badge „Direktverkauf" an der Produktzeile |
| `src/lib/catalog.ts` | **nicht** ändern — das Terminal braucht das Flag nicht |
| `src/components/kueche/order-card.tsx` | Direktverkaufspositionen abgesetzt darstellen |
| `src/components/kasse/kasse-dashboard.tsx` | Erfolgs-Toast/Handling für Direktverkauf |
| `src/components/kasse/cash-register-dialog.tsx` | Hinweis „direkt aushändigen" bei Direktverkauf |
| `src/components/kasse/collected-order-card.tsx` | „Zurückholen" → „Stornieren" bei Direktverkauf |
| `src/lib/messages.ts` | neue deutsche Strings (`kasseMessages`, `kitchenMessages`, `adminMessages`) |

## Implementation requirements

### 1. Schema + Migration

```ts
// products
needsPreparation: integer("needs_preparation", { mode: "boolean" })
  .notNull()
  .default(true),

// orderItems — Snapshot, damit spätere Produktänderungen die Historie nicht umschreiben
needsPreparation: integer("needs_preparation", { mode: "boolean" })
  .notNull()
  .default(true),

// orders — beim Anlegen einmal entschieden, danach unveränderlich
directSale: integer("direct_sale", { mode: "boolean" }).notNull().default(false),
```

Migration mit `npm run db:generate` erzeugen und mit `npm run db:migrate`
anwenden. **Nicht** von Hand am SQLite-File schrauben.

### 2. Order-Logik (`src/lib/orders.ts`)

- `initialStatus(method)` ersetzen durch eine Funktion, die den Direktverkauf
  kennt, z. B.:

  ```ts
  /**
   * A Kasse order made up entirely of no-prep products (a chocolate bar, a can
   * of cola) is handed over across the counter right away: it never reaches the
   * kitchen or the pickup board. Terminal orders are never direct sales — nobody
   * is standing behind the counter to hand them over.
   */
  function isDirectSale(source: OrderSource, items: { needsPreparation: boolean }[]): boolean
  ```

- In `createOrder`:
  - Beim Preisen/Validieren jeder Position `product.needsPreparation` mit
    aufnehmen und als Snapshot in `orderItems` schreiben.
  - `directSale` bestimmen und auf `orders` persistieren.
  - Status: `cash` → `awaiting_cash` (unverändert). `paypal` → `directSale ?
    "collected" : "in_kitchen"`. Bei `collected` zusätzlich `readyAt = now`
    setzen (`paidConfirmedAt` wird ohnehin gesetzt).
  - **Die Transaktion muss synchron bleiben** — kein `await` einführen (siehe
    ATOMICITY-Kommentar über `createOrder`).
- `confirmCashPayment(id)`: bei `order.directSale` → `status: "collected"`,
  `paidConfirmedAt: now`, `readyAt: now`; sonst wie bisher `in_kitchen`.
- `uncollectOrder(id)`: zusätzlicher Guard — `if (order.directSale) throw new
  OrderTransitionError()`. Eine Direktverkauf-Bestellung war nie abholbereit.
- `cancelOrder(id)`: Guard erweitern auf `in_kitchen` **oder** (`collected` und
  `directSale`). Restock und `cancelledAt` bleiben unverändert.
- `restoreOrder(id)` bleibt wie es ist (aus `cancelled` → `in_kitchen`), gilt
  aber nicht für Direktverkauf: Guard ergänzen, dass `directSale`-Bestellungen
  nicht wiederhergestellt werden (sonst landen sie fälschlich in der Küche).
  Alternativ: `directSale` → zurück nach `collected`. **Entscheide dich für
  einen Weg und kommentiere ihn** — bevorzugt der einfache Guard.
- `CreateOrderResult` um `directSale: boolean` erweitern, damit die Kasse den
  richtigen Folge-Screen zeigt.

### 3. Admin

- `AdminProduct.needsPreparation`, in `getAdminCatalog()` mitselektieren.
- `createProductSchema` / `updateProductSchema` um
  `needsPreparation: z.boolean().optional()` erweitern; `createProduct`
  (`input.needsPreparation ?? true`) und `updateProduct` (nur wenn `!== undefined`)
  entsprechend schreiben.
- Im `ProductFormDialog` ein klar beschrifteter Umschalter, formuliert aus
  Küchensicht, **nicht** als Negation: Label „Muss zubereitet werden" mit
  Hilfetext „Aus = Direktverkauf: geht an der Kasse nicht in die Küche."
  Platzierung unter dem Bestand-Feld. Default für neue Produkte: **an**.
- In `ProductManager` bekommen Direktverkauf-Produkte ein ruhiges Badge
  („Direktverkauf", `variant="secondary"`), damit im Katalog auf einen Blick
  klar ist, welche Produkte betroffen sind.

### 4. Küche (gemischte Bestellungen)

`OrderCard` rendert Direktverkaufspositionen weiterhin in der Liste, aber
optisch abgesetzt: gedämpfte Textfarbe (`text-muted-foreground`) plus ein
kleines Label „direkt" hinter dem Namen. Kein Ausblenden — die Küche muss die
Position sehen, um sie mit auf den Tresen zu legen. Vorbereitungspflichtige
Positionen bleiben unverändert prominent.

### 5. Kasse

- **Bar:** Nach dem Anlegen öffnet wie bisher der `CashRegisterDialog`. Bei
  `directSale` zeigt er statt des Küchen-Wordings den Hinweis „Ware direkt
  aushändigen". Nach dem Kassieren lautet der Erfolgs-Toast
  „Kassiert – bitte direkt aushändigen." statt „Bestellung an die Küche
  übergeben."
- **PayPal:** Der `SuccessScreen` des `OrderFlow` bleibt unverändert (das Wording
  „bitte an der Theke warten" ist an der Kasse ohnehin schon so). Optional, wenn
  es ohne Verrenkung geht: Bei `directSale` schließt die Kasse den Flow direkt
  wie beim Barfall. **Nicht erzwingen**, wenn es den geteilten `OrderFlow`
  verkompliziert.
- **„Zuletzt abgeholt":** `CollectedOrderCard` zeigt bei `order.directSale` ein
  Badge „Direktverkauf" und als Aktion **„Stornieren"** (DELETE auf
  `/api/orders/[id]`) statt „Zurückholen"; danach `orders:changed` +
  `catalog:changed` (Restock). Sicherheitsabfrage: einfacher Bestätigungsdialog,
  da der Vorgang Geld betrifft und nicht per Undo-Toast zurückzuholen ist.
  Alle anderen Bestellungen behalten „Zurückholen" exakt wie heute.

### 6. Sprache

Alle sichtbaren Strings in `src/lib/messages.ts` ergänzen — nichts im JSX
hartcodieren. Code bleibt komplett englisch (`needsPreparation`, `directSale`,
`isDirectSale`), Deutsch nur in der Copy.

## Real-time / broadcast requirements

- `createOrder` (POST): `orders:changed` + `catalog:changed` — unverändert. Eine
  Direktverkauf-Bestellung erscheint dadurch sofort in „Zuletzt abgeholt" auf
  **jedem** Kassengerät und taucht **nirgends** auf Küche/Abholmonitor auf
  (deren Scopes enthalten `collected` nicht).
- `confirmCashPayment` (PATCH `cash`): `orders:changed` — unverändert. Bei
  Direktverkauf verschwindet die Bestellung aus der Barzahlungs-Queue und
  erscheint in „Zuletzt abgeholt", ohne je in der Küche gewesen zu sein.
- Storno einer Direktverkauf-Bestellung (DELETE): `orders:changed` +
  `catalog:changed` — wie beim bestehenden Storno.
- Admin-Umschalter: `catalog:changed` — wie bei jeder anderen Produktänderung.
- Kein neuer Event-Typ. `AppEvent` bleibt unverändert.

## Acceptance criteria

1. Ein Produkt lässt sich im Admin als Direktverkauf markieren; bestehende und
   neue Produkte sind standardmäßig zubereitungspflichtig.
2. Kasse, nur Direktverkaufsartikel, **bar**: nach „Kassiert" ist die Bestellung
   `collected`. Sie erscheint **nie** auf Küchenmonitor oder Abholmonitor.
3. Kasse, nur Direktverkaufsartikel, **PayPal**: nach „Ich habe bezahlt" ist die
   Bestellung sofort `collected` — ohne Küche, ohne Abholmonitor.
4. Kasse, **gemischt**: normaler Ablauf (`in_kitchen`); die Küche sieht alle
   Positionen, die Direktverkaufspositionen abgesetzt gekennzeichnet.
5. **Terminal**, nur Direktverkaufsartikel: unverändert — Küche und
   Abholmonitor wie bisher.
6. Eine Direktverkauf-Bestellung steht in „Zuletzt abgeholt" mit Badge und
   „Stornieren"; Storno bucht den Bestand zurück. „Zurückholen" gibt es dort
   nicht.
7. Umsatz/Historie (Admin-Archiv) enthält Direktverkauf-Bestellungen mit
   korrektem Betrag und Zeitstempel.
8. Ein nachträgliches Umlegen des Flags im Admin ändert **keine** bestehende
   Bestellung (Snapshots).
9. Alle Änderungen erscheinen ohne manuelles Neuladen auf allen Geräten.

## Checks to run

```
npm run db:generate
npm run db:migrate
npm run lint
npm run build
```

Ausgabe jeweils wörtlich berichten.

## Manual test steps

1. `npm run dev`, im LAN erreichbar unter `http://<PI-IP>:3000`.
2. **Admin** (`/admin`): Produkt „Cola" anlegen bzw. bearbeiten →
   „Muss zubereitet werden" **aus**. Badge „Direktverkauf" prüfen. Ein zweites
   Produkt („Cappuccino") bleibt zubereitungspflichtig.
3. Vier Geräte/Tabs offen halten: `/kasse`, `/kueche`, `/abholung`, `/terminal`.
4. **Kasse → Neue Bestellung → 2× Cola → Bar** → im Kassendialog kassieren.
   Erwartung: Toast „bitte direkt aushändigen", nichts auf `/kueche` und
   `/abholung`, Eintrag unter „Zuletzt abgeholt" mit Badge „Direktverkauf".
5. Dort **„Stornieren"** tippen → Bestätigen. Erwartung: Eintrag weg, Bestand
   der Cola wieder erhöht (in `/kasse` → „Verfügbarkeit" bzw. `/admin` prüfen).
6. **Kasse → Neue Bestellung → 1× Cola → PayPal → „Ich habe bezahlt"**.
   Erwartung: sofort `collected`, keine Spur auf Küche/Abholmonitor.
7. **Kasse → Neue Bestellung → 1× Cappuccino + 1× Cola → Bar** → kassieren.
   Erwartung: erscheint auf `/kueche` mit beiden Positionen, die Cola gedämpft
   mit „direkt"; „Fertig" macht sie auf `/abholung` grün wie gewohnt.
8. **Terminal → 2× Cola → Bar**. Erwartung: landet in der Barzahlungs-Queue der
   Kasse; nach „Kassiert" geht sie **in die Küche** (nicht Direktverkauf).
9. Während Schritt 4–8: alle vier Screens beobachten — jede Änderung muss ohne
   Reload erscheinen.
