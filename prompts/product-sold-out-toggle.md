# Prompt: Schnell-„Heute aus"-Toggle für Produkte

## Goal

Personal soll ein Produkt mit **einem Tap** als „heute nicht verfügbar" markieren können — **ohne den Stock-Zähler zu benutzen**. Das ist der schnelle Alltagsfall: „Der Käsekuchen ist alle." Ein zweiter Tap macht es wieder verfügbar.

Das Flag ist ein **eigenständiges Boolean** am Produkt, komplett getrennt vom bestehenden `stockCount`-Mechanismus:

- **Manuelles Reset** (keine Datums-/Nacht-Logik): das Flag bleibt gesetzt, bis Personal es zurücktippt. „Heute" ist nur die Sprech-/Label-Ebene für Personal, keine automatische Zeitsteuerung.
- Bedienbar in **zwei Oberflächen**: in der Admin-Produktliste **und** in einem neuen kompakten „Verfügbarkeit"-Panel in der Kasse (die Kasse hat aktuell keine Produktliste).

## Existing code inspected

- `src/lib/db/schema.ts` — `products` hat `stockCount` (NULL = unbegrenzt, 0 = ausverkauft) und `active` (soft-delete). **Kein** „sold out today"-Flag vorhanden. Booleans werden als `integer({ mode: "boolean" })` mit `.notNull().default(...)` gespeichert.
- `drizzle/` — Migrationen `0000..0002`, `meta/_journal.json` + Snapshots. Migrationen sind Source of Truth; nie die DB-Datei von Hand ändern. Generieren via `npm run db:generate`, anwenden via `npm run db:migrate`.
- `src/lib/catalog.ts` (`getCatalog`, server-only, terminal — nur aktive) — `CatalogProduct` liefert `id/name/priceCents/imageUrl/stockCount/modifierGroups`. Selektiert die Felder explizit; **muss** um das neue Flag erweitert werden.
- `src/lib/admin-catalog.ts` — `AdminProduct` (inkl. inaktive), Zod-Schemas (`updateProductSchema`, `setStockSchema`), Mutationen (`updateProduct`, `setProductStock`). Muster für neue Mutation + Schema hier.
- `src/app/api/admin/products/[id]/route.ts` — `PATCH` mit `discriminatedUnion("action", [...])`: `update` / `stock` / `move`. Broadcastet nach jeder Mutation `{ type: "catalog:changed" }`.
- `src/components/admin/product-manager.tsx` — `ProductRow` + `StockControl`. `ProductHandlers` bündelt `onCreate/onUpdate/onMove/onToggleActive/onSetStock`. Hier kommt der Admin-Toggle rein.
- `src/components/admin/admin-dashboard.tsx` — verdrahtet Handlers auf `mutate(url, method, body, toast)` gegen `/api/admin/products/...` mit `{ action: ... }`.
- `src/hooks/use-admin-catalog.ts` — Live-Liste, refetch bei SSE-Event `catalog:changed`.
- `src/components/terminal/product-card.tsx` — `const soldOut = product.stockCount === 0 || available === 0;` steuert grau/deaktiviert + Badge `t.menu.soldOut` („Ausverkauft"). **Zentrale Stelle** für die Anzeige.
- `src/components/terminal/menu-screen.tsx` — `availableFor()` (aus `availableToAdd`), `handleAdd` blockt bei `<= 0`.
- `src/lib/orders.ts` (`createOrder`, Zeilen ~220–246) — serverseitige Validierung: prüft `active` + `stockCount`, wirft `OrderValidationError("Ein Produkt ist nicht mehr verfügbar.")` bzw. `OrderStockError`. **Muss** das Flag mitprüfen, damit ein stale Terminal/Kasse ein „heute aus"-Produkt nicht doch bestellen kann.
- `src/components/kasse/kasse-dashboard.tsx` — Header mit Buttons „Admin" + „Neue Bestellung"; Body = zwei Bestellschlangen (`cash`/`ready`); `OrderFlow` übernimmt den Screen bei On-behalf-Bestellung. Bekommt `catalog` bereits als Prop übergeben. Hier kommt der Einstieg ins neue Kasse-Panel rein.
- `src/lib/messages.ts` — deutsche Copy zentral: `menu.soldOut` = „Ausverkauft"; `adminMessages.products.stock.*`, `.toasts.*`. Neue Copy hier ergänzen (Admin + Kasse + ggf. Terminal). Terminal-Copy ist mehrsprachig (auch RU) — `menu.soldOut` existiert bereits pro Sprache, keine neue Terminal-Copy nötig, außer gewünscht.

## Decisions / assumptions

1. **Neues Feld `soldOut` (boolean) auf `products`**, statt `stockCount` zu missbrauchen. Default `false`. „Heute aus ohne Stock zu zählen" heißt genau: dieses Flag ist unabhängig von `stockCount`.
2. **Manuelles Reset.** Kein Datum, kein Cron, keine Mitternachts-Logik. `soldOut` bleibt, bis jemand es zurücksetzt.
3. **Anzeige-Logik konsolidiert**: ein Produkt gilt für den Gast als nicht verfügbar, wenn `soldOut === true` **oder** `stockCount === 0` **oder** `available === 0`. `stockCount` und `soldOut` bleiben zwei getrennte Konzepte (Zähler vs. Tagesschalter); die UI führt sie nur an der Anzeige-Kante zusammen.
4. **Kasse-Panel** ist read/write nur für dieses Flag — es ist **kein** zweiter Produkt-Editor. Nur Liste + Toggle pro Produkt (Name, Bild, Preis, aktueller Status). Bewusst schlank.
5. Reaktivieren/Deaktivieren (`active`) bleibt unangetastet — inaktive Produkte tauchen im Kasse-Panel nicht auf (Kasse zeigt nur den terminal-sichtbaren Katalog, d.h. aktive Produkte).
6. `soldOut` wird beim Bestellen **nie** automatisch verändert (anders als `stockCount`, das dekrementiert wird). Rein manuell.

## Files likely to change

- `src/lib/db/schema.ts` — Spalte `soldOut: integer("sold_out", { mode: "boolean" }).notNull().default(false)` auf `products`.
- `drizzle/…` — neue Migration via `npm run db:generate`.
- `src/lib/catalog.ts` — `CatalogProduct.soldOut` + im `select` mitziehen + im Mapping ausgeben.
- `src/lib/admin-catalog.ts` — `AdminProduct.soldOut`; im `getAdminCatalog`-Mapping ausgeben; neues `setSoldOutSchema = z.object({ soldOut: z.boolean() })`; neue Mutation `setProductSoldOut(id, soldOut)` (analog `setProductStock`).
- `src/app/api/admin/products/[id]/route.ts` — neuen Zweig `setSoldOutSchema.extend({ action: z.literal("availability") })` in die `discriminatedUnion`, im Handler `setProductSoldOut(...)` aufrufen, danach wie gehabt `broadcast({ type: "catalog:changed" })`.
- `src/components/admin/product-manager.tsx` — `ProductHandlers.onSetSoldOut`; in `ProductRow` einen Toggle-Button „Heute aus" / „Wieder da" (mit Badge, wenn gesetzt).
- `src/components/admin/admin-dashboard.tsx` — `onSetSoldOut` verdrahten: `mutate('/api/admin/products/${id}', 'PATCH', { action: 'availability', soldOut }, toast)`.
- `src/components/terminal/product-card.tsx` — `soldOut`-Bedingung um `product.soldOut` erweitern.
- `src/components/terminal/menu-screen.tsx` — `availableFor`/`handleAdd` so ergänzen, dass `soldOut`-Produkte nicht hinzufügbar sind (Card ist bereits disabled; zusätzlich in `handleAdd` hart blocken).
- `src/lib/orders.ts` — in `createOrder`-Validierung `soldOut` mitprüfen und `OrderValidationError("Ein Produkt ist nicht mehr verfügbar.")` werfen (gleiche Meldung wie bei fehlendem Produkt — passt semantisch).
- **Neu:** `src/components/kasse/availability-panel.tsx` — kompaktes Panel, das den (aktiven) Katalog nach Kategorien listet und pro Produkt einen „Heute aus"/„Wieder da"-Toggle zeigt.
- `src/components/kasse/kasse-dashboard.tsx` — Header-Button „Verfügbarkeit", der das Panel öffnet (analog zum `ordering`-Vollbild-Muster: eigener State, übernimmt Screen oder Sheet/Dialog — siehe UI-Abschnitt). Nutzt das bereits vorhandene `catalog`-Prop; für Live-Updates via `catalog:changed` refetchen (siehe unten).
- `src/lib/messages.ts` — Admin + Kasse Copy (siehe Copy-Abschnitt).
- Shared Types: `AdminProduct`/`CatalogProduct` werden von den Panels konsumiert — nach Schema-Änderung neu durchziehen.

## Implementation requirements

- **Migration zuerst**: Schema ändern → `npm run db:generate` → `npm run db:migrate`. Migration und Snapshot mitcommitten.
- Money bleibt Cents; keine Änderung an Preisen/Stock.
- Alle Mutationen laufen serverseitig über den Route-Handler, Zod-validiert, via Drizzle — **kein** direkter DB-Zugriff aus dem Browser. Nach jeder Mutation `catalog:changed` broadcasten (die neue `availability`-Action tut das).
- TypeScript strikt, keine `any`. Kleine typisierte Funktionen. Route-Handler dünn.
- Code Englisch (`soldOut`, `setProductSoldOut`, `onSetSoldOut`, Spalte `sold_out`), UI-Copy 100 % Deutsch aus `messages.ts`.
- Kein Overengineering: kein Datum, kein Bulk-„alles zurücksetzen", keine Historie — nur der Toggle.

## Real-time / broadcast requirements

- Die `availability`-Action broadcastet `{ type: "catalog:changed" }`.
- **Admin**: `useAdminCatalog` refetcht bereits auf `catalog:changed` → Toggle spiegelt sich sofort auf allen Admin-Screens.
- **Terminal**: reagiert auf `catalog:changed` und lädt den Katalog neu (bestehendes Verhalten prüfen — der Terminal muss ein neu „heute aus" gesetztes Produkt live ausgrauen, ohne manuellen Refresh). Falls der Terminal-Katalog noch nicht auf `catalog:changed` hört, in diesem Prompt mit anbinden.
- **Kasse-Panel**: muss den Katalog live halten. Da `kasse/page.tsx` `catalog` serverseitig rendert, im Panel (oder Dashboard) auf `catalog:changed` via `useEventStream` refetchen (`GET /api/catalog`), damit zwei Kassen-/Admin-Geräte synchron bleiben. Muster wie `useAdminCatalog`.
- Kein Zustandswechsel ohne Broadcast; kein Screen darf manuellen Refresh brauchen.

## UI / UX

**Admin-Produktzeile (`ProductRow`)**

- Neuer Toggle-Button rechts, neben Bearbeiten/Deaktivieren, klar vom `StockControl` (Zähler) getrennt — es sind zwei Konzepte.
- Zustand „verfügbar" → Button „Heute aus" (neutral, `variant="outline"`). Zustand „heute aus" → deutlich sichtbarer Zustand: Zeile leicht abgesetzt + Badge „Heute aus" (z. B. `variant="destructive"`/amber), Button wird „Wieder da" (`variant="secondary"`).
- Touch-Targets ≥ 44px (`h-10`+), konsistent mit den vorhandenen Buttons.
- `soldOut` ist unabhängig von `active`: ein deaktiviertes Produkt zeigt weiterhin seinen `active`-Zustand; der „Heute aus"-Toggle bleibt bedienbar.

**Kasse „Verfügbarkeit"-Panel (neu)**

- Einstieg: Button „Verfügbarkeit" im Kasse-Header (neben „Admin"/„Neue Bestellung"), Icon z. B. `PackageIcon`/`EyeOffIcon`.
- Vollbild-Übernahme wie der `ordering`-Flow (eigener State `managingAvailability`), mit klarem „Zurück"/„Fertig"-Button — konsistent mit `OrderFlow.onExit`. Groß, touch-freundlich, für ein Kassen-Tablet.
- Layout: Kategorien als Abschnitte, darunter Produkte als große Zeilen/Kacheln: Bild + Name + Preis + großer Statusschalter (Switch oder zwei-Zustands-Button). Sofortiges optisches Feedback beim Tap (optimistisch oder nach Response — konsistent mit vorhandenem `mutate`-Muster, das nach Erfolg refetcht).
- „Heute aus"-Produkte deutlich abgesetzt (gedämpft + Badge), damit auf einen Blick klar ist, was gerade aus ist.
- Nur **aktive** Produkte (terminal-sichtbarer Katalog).
- States: leer (keine Produkte) → Hinweistext; Fehler/Connection-lost → vorhandenes `WifiOffIcon`-Muster wiederverwenden; Toast bei Erfolg/Fehler wie in Kasse (`sonner`).
- Für Design/Feinschliff die Skills `impeccable` bzw. `ui-ux-pro-max`/`ui-styling` heranziehen (große Touch-Flächen, klare Zustände).

**Terminal**

- `soldOut`-Produkt: identische Darstellung wie bisher bei Stock 0 — ausgegraut, `disabled`, Badge „Ausverkauft" (`t.menu.soldOut`). Keine neue Terminal-Copy nötig.

## Copy (deutsch, in `src/lib/messages.ts`)

- Admin: `products.availability.markOut` = „Heute aus", `products.availability.markAvailable` = „Wieder da", `products.availability.badge` = „Heute aus", `products.toasts.soldOut` = „Als heute aus markiert.", `products.toasts.available` = „Wieder verfügbar."
- Kasse: `kasseMessages.availability.title` = „Verfügbarkeit", `.open` = „Verfügbarkeit", `.done` = „Fertig", `.empty` = „Keine Produkte vorhanden.", plus dieselben Button-/Badge-/Toast-Strings (ggf. aus einer gemeinsamen Stelle wiederverwenden, aber Kasse hat eigenen Namespace — Duplizierung vermeiden, indem gemeinsame Strings referenziert oder bewusst dupliziert werden; eine Quelle pro Konzept anstreben).
- Exakte Endstrings beim Umsetzen final abstimmen; Ton wie bestehende Copy (freundlich, knapp).

## Acceptance criteria

- [ ] Migration erzeugt Spalte `products.sold_out` (Boolean, Default false); `npm run db:migrate` läuft sauber.
- [ ] Admin: Toggle pro Produkt markiert „heute aus" / zurück — ein Tap, ohne den Stock-Zähler zu verändern. Stock-Wert bleibt exakt gleich.
- [ ] Kasse: „Verfügbarkeit"-Panel listet aktive Produkte und toggelt dasselbe Flag; ein Tap genügt.
- [ ] Terminal: ein „heute aus"-Produkt ist sofort (ohne manuellen Refresh) ausgegraut/„Ausverkauft" und nicht hinzufügbar.
- [ ] Server lehnt eine Bestellung mit einem „heute aus"-Produkt ab (409/400 mit deutscher Meldung), auch wenn der Client stale ist.
- [ ] Zurücksetzen des Flags macht das Produkt sofort wieder verfügbar (sofern `stockCount` nicht 0 ist).
- [ ] `soldOut` und `stockCount` beeinflussen sich nicht gegenseitig.
- [ ] Änderung auf einem Gerät erscheint live auf Admin, Kasse und Terminal (SSE `catalog:changed`).
- [ ] Keine englische UI-Copy, kein deutsches Wort im Code.

## Checks to run

- `npm run db:generate` / `npm run db:migrate`
- `npm run lint`
- `npm run build`
- `npm test` (falls Tests existieren/relevant)
- Exakte Command-Ausgabe berichten.

## Manuelle Testschritte (LAN)

1. `npm run dev`, dann Pi-IP im LAN öffnen (`http://<PI-IP>:3000`).
2. **Admin** (`/admin`, Admin-Gerät): bei einem Produkt „Heute aus" tippen → Badge erscheint, Stock-Zähler unverändert.
3. **Terminal** (`/terminal`, anderes Gerät/Tab): Produkt ist ohne Refresh ausgegraut + „Ausverkauft", nicht antippbar.
4. **Kasse** (`/kasse`): „Verfügbarkeit" öffnen → Produkt als „heute aus" sichtbar → auf „Wieder da" tippen → Terminal reaktiviert das Produkt live.
5. Bestellversuch-Kante: Terminal-Katalog stale halten (z. B. Tab offen von vor der Markierung), Produkt in Kasse „heute aus" setzen, dann auf dem stale Terminal bestellen → Server lehnt mit deutscher Fehlermeldung ab.
6. Prüfen: Stock-getracktes Produkt „heute aus" schalten und zurück → `stockCount` bleibt unverändert.
