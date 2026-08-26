# Admin-Dashboard (`/admin`)

## Ziel

Das Admin-Dashboard von einem Placeholder zu einer voll funktionsfähigen Verwaltung ausbauen:
Kategorien, Produkte, Bestände und Café-Einstellungen pflegen. Alle Änderungen am Katalog
werden **live** an Terminal (und alle anderen Screens) gepusht — kein manueller Refresh nötig.

Das Admin ist ein **Staff-Device** (Rolle `admin`, per `src/proxy.ts` gegated). Es läuft auf
einem Touchscreen/iPad → große Touch-Targets, klare Hierarchie, aber funktional/dicht (kein
Attract-Screen-Look wie das Terminal).

## Inspizierter Bestand (real gelesen)

- `src/lib/db/schema.ts` — `categories` (id, name, sortOrder, active, createdAt),
  `products` (id, categoryId, name, priceCents, imageUrl, stockCount `NULL=unbegrenzt`,
  active, sortOrder, createdAt), `settings` (key/value). Money in **Cents**. Soft-Delete via
  `active`-Flag ist bereits vorgesehen. `categories → products` cascadet bei echtem Delete;
  `products → order_items` ist `set null` (Historie bleibt dank Snapshots erhalten).
- `src/lib/catalog.ts` — `getCatalog()` liefert nur **aktive** Kategorien/Produkte, sortiert
  nach `sortOrder, name`. Terminal + `GET /api/catalog` teilen sich diese Funktion.
- `src/lib/settings.ts` — nur `getSettings()` (read). Muss um Schreiben erweitert werden.
- `src/lib/events.ts` — Bus mit `broadcast()` / `subscribe()`; Events sind **Signale**
  (`orders:changed`, `catalog:changed`), keine Payloads. Clients refetchen bei Signal.
- `src/app/api/orders/[id]/route.ts` — Referenz-Pattern für Route-Handler: Zod-`safeParse`,
  typisierte Service-Errors → HTTP-Status, `broadcast()` nach jeder Mutation, `runtime="nodejs"`,
  `dynamic="force-dynamic"`.
- `src/components/terminal/product-image.tsx` — rendert `imageUrl` via `next/image` (`fill`,
  `object-cover`), sonst warmer Gradient-Platzhalter mit Initiale. `imageUrl` ist einfach ein
  URL-String → ein `/api/uploads/<file>`-Pfad funktioniert hier ohne Änderung.
- `src/lib/messages.ts` — zentrale deutsche UI-Copy pro Surface (`terminalMessages`,
  `kitchenMessages`, `kasseMessages`, `pickupMessages`). **Neues `adminMessages`-Objekt hier
  ergänzen** — keine hartkodierten Strings in Komponenten.
- `src/hooks/use-event-stream.ts`, `use-orders.ts`, `use-catalog`(falls vorhanden) — Muster für
  SSE-Subscription + Refetch. Für Admin einen `useCatalogAdmin`-Hook analog bauen.
- `next.config.ts` — `output: "standalone"`, `serverExternalPackages: ["better-sqlite3"]`.
- `.gitignore` — `/data` und `*.db` sind ignoriert. Uploads landen unter `data/uploads/` und
  sind damit bewusst **nicht** im Repo (leben auf der Pi).

## Entscheidungen (mit dem User geklärt)

1. **Produktbilder = lokaler Datei-Upload.** Bild wird vom Gerät hochgeladen, auf der Pi unter
   `data/uploads/` gespeichert und über einen eigenen Route-Handler ausgeliefert. Voll offline,
   keine externen URLs.
2. **Löschen = Deaktivieren (soft).** „Löschen“ setzt `active=false` → verschwindet vom Terminal,
   bleibt in der DB, ist reaktivierbar. Kein echtes DELETE (Historie/Snapshots bleiben sauber).
3. **Café-Einstellungen im Admin.** Eigener Bereich für `cafe_name` und `paypal_handle`
   (aus der `settings`-Tabelle).
4. **Sortierung via Hoch/Runter-Buttons** (touch-sicher), kein Drag & Drop.

## Annahmen (bitte beim Review bestätigen/korrigieren)

- Admin zeigt **alle** Kategorien/Produkte inkl. deaktivierte (mit „Inaktiv“-Badge + Reaktivieren),
  nicht nur aktive → braucht eigene Query, **nicht** `getCatalog()` (das filtert auf `active`).
- Reorder verschiebt innerhalb der Ebene: Kategorien global, Produkte innerhalb ihrer Kategorie.
- Preis-Eingabe erfolgt in Euro (`3,90`) und wird zu Cents konvertiert; Anzeige deutsch.
- `stockCount`: leeres Feld = `NULL` (unbegrenzt), `0` = ausverkauft/ausgegraut, Zahl = Bestand.
- Upload akzeptiert nur Bilder (jpeg/png/webp), max. ~5 MB; Dateiname wird server-seitig neu
  vergeben (z. B. `<nanoid>.<ext>`), Originalname wird nicht übernommen.
- Löschen des alten Bildes bei Ersetzen/Deaktivieren ist **nicht** nötig (verwaiste Dateien ok,
  keine Aufräum-Logik in diesem Scope).
- Settings-Änderungen brauchen keine Live-Push-Garantie; Terminal übernimmt sie beim nächsten
  Seitenaufbau. (Optional trotzdem `catalog:changed` broadcasten — siehe unten.)

## Dateien, die voraussichtlich geändert/erstellt werden

**Server / lib**
- `src/lib/admin-catalog.ts` (neu) — Service-Layer: `listCategoriesAdmin()`, `listProductsAdmin()`,
  `createCategory`, `updateCategory`, `deactivateCategory`, `reactivateCategory`, `moveCategory`,
  analog für Produkte (`createProduct`, `updateProduct`, `deactivateProduct`, `reactivateProduct`,
  `moveProduct`, `setStock`). Zod-Schemas hier definieren und exportieren. Typisierte Errors
  (`AdminNotFoundError`, `AdminValidationError`) analog zu `src/lib/orders.ts`.
- `src/lib/settings.ts` — `setSetting(key, value)` / `setSettings(map)` ergänzen; erlaubte Keys
  zentral als Konstante (`cafe_name`, `paypal_handle`).
- `src/lib/uploads.ts` (neu) — `saveUpload(file): Promise<string>` (schreibt nach `data/uploads/`,
  legt Verzeichnis bei Bedarf an, gibt `/api/uploads/<file>` zurück) + `readUpload(name)` +
  Content-Type/Extension-Whitelist. Pfad-Traversal (`..`, Slashes) hart ablehnen.

**Route-Handler (`runtime="nodejs"`, `dynamic="force-dynamic"`, Zod, broadcast)**
- `src/app/api/admin/categories/route.ts` — `GET` (alle, inkl. inaktiv), `POST` (anlegen).
- `src/app/api/admin/categories/[id]/route.ts` — `PATCH` (update / `move` up|down /
  active toggle), `DELETE` (soft = deactivate).
- `src/app/api/admin/products/route.ts` — `GET`, `POST`.
- `src/app/api/admin/products/[id]/route.ts` — `PATCH` (update / `move` / `setStock` / active
  toggle), `DELETE` (soft).
- `src/app/api/admin/settings/route.ts` — `GET`, `PATCH`.
- `src/app/api/admin/uploads/route.ts` — `POST` (multipart/form-data → `saveUpload`, gibt
  `{ url }` zurück). **Kein** `catalog:changed` hier (das Bild wird erst beim Produkt-Save
  verknüpft).
- `src/app/api/uploads/[file]/route.ts` — `GET` liefert die Bilddatei (Content-Type,
  `Cache-Control`), streamt aus `data/uploads/`. Öffentlich lesbar (Bilder erscheinen am Terminal).

**Client / UI**
- `src/app/admin/page.tsx` — Server Component: initiale Daten laden (Kategorien inkl. Produkte,
  Settings), an Client-Dashboard übergeben.
- `src/components/admin/admin-dashboard.tsx` — Client-Root mit Tab-Navigation
  (Kategorien · Produkte · Einstellungen), SSE-Subscription (`catalog:changed` → refetch),
  Toaster (sonner ist vorhanden).
- `src/components/admin/category-manager.tsx`, `category-row.tsx`, `category-form-dialog.tsx`.
- `src/components/admin/product-manager.tsx`, `product-row.tsx`, `product-form-dialog.tsx`
  (inkl. Bild-Upload-Feld + Vorschau, Kategorie-Select, Preis in €, Stock-Feld).
- `src/components/admin/settings-form.tsx`.
- `src/components/admin/image-upload.tsx` — Datei wählen → `POST /api/admin/uploads` → Vorschau.
- `src/hooks/use-admin-catalog.ts` — lädt Kategorien/Produkte, abonniert `catalog:changed`,
  bietet Mutations-Helfer (fetch + Fehler-Toast).
- `src/lib/messages.ts` — `adminMessages` ergänzen (alle Strings deutsch, siehe unten).
- Ggf. `next.config.ts` — falls `next/image` das lokale `/api/uploads/*` optimieren soll,
  entweder `images.unoptimized: true` (einfachste, Pi-freundliche Variante) **oder** die
  Route als erlaubte Quelle konfigurieren. **Empfehlung: `unoptimized` für lokale Uploads**,
  da die Bildoptimierung auf Pi-Hardware Kosten spart und offline robust ist.

## Implementierungs-Anforderungen

- **Alle Writes server-seitig**, Zod-validiert, via Drizzle. Browser schreibt nie direkt in die DB.
- **Money in Cents** durchgängig; Euro nur an der UI-Kante formatieren (bestehende Helfer in
  `src/lib/format.ts` nutzen; kein neues Formatting erfinden).
- **Code englisch, UI deutsch** — keine Mischung (kein `getKategorie`). Deutsche Copy nur in
  `adminMessages`.
- Route-Handler dünn und single-purpose; Businesslogik in `src/lib/admin-catalog.ts`.
- **Reorder** über eine `move`-Aktion (`direction: "up" | "down"`): Service tauscht `sortOrder`
  mit dem Nachbarn in derselben Ebene in einer Transaktion. Kein Client-berechnetes sortOrder.
- **Soft-Delete**: `DELETE` setzt `active=false`. Reaktivieren über `PATCH { active: true }`.
  Kategorie deaktivieren blendet ihre Produkte am Terminal ohnehin aus (getCatalog filtert
  Kategorien) — Produkte selbst unangetastet lassen.
- **Upload-Sicherheit**: MIME/Extension-Whitelist, Größenlimit, generierter Dateiname,
  Pfad-Traversal ausschließen. Verzeichnis `data/uploads/` bei Bedarf anlegen.
- Fehlerbehandlung wie im Orders-Handler: typisierte Errors → 400/404/409, sonst 500 + Log.

## Echtzeit / Broadcast-Anforderungen

- Nach **jeder** katalogverändernden Mutation (Kategorie/Produkt anlegen/ändern/deaktivieren/
  reaktivieren/verschieben, Stock ändern): `broadcast({ type: "catalog:changed" })`.
  → Terminal (und Admin selbst) refetchen live; ausverkaufte/deaktivierte Artikel verschwinden
  bzw. grauen sofort aus, ohne Refresh.
- Upload-Route broadcastet **nicht** (Verknüpfung passiert erst beim Produkt-Save).
- Settings-`PATCH`: `broadcast({ type: "catalog:changed" })` als leichter Nudge ist ok
  (Terminal liest Settings ohnehin beim Seitenaufbau) — nicht kritisch, aber konsistent.
- Admin-Dashboard abonniert selbst `catalog:changed` und refetcht, damit zwei Admin-Geräte
  synchron bleiben.

## UI / UX (Touchscreen)

- **Layout**: Kopfzeile mit Café-Name + Tab-Leiste (Kategorien · Produkte · Einstellungen).
  Große Touch-Targets (min. ~44–48px Höhe), klare Zeilen mit Aktionen rechts.
- **Kategorien-Tab**: Liste sortiert nach `sortOrder`; pro Zeile Name, Aktiv-Status,
  Hoch/Runter-Buttons, Bearbeiten, Deaktivieren/Reaktivieren. „Neue Kategorie“-Button oben.
- **Produkte-Tab**: nach Kategorie gruppiert; pro Zeile Bild-Thumbnail, Name, Preis, Bestand
  (Badge: „unbegrenzt“ / Zahl / „ausverkauft“ bei 0), Hoch/Runter, Bearbeiten, Deaktivieren.
  Inline-Stock-Schnellanpassung (−/+ oder Feld) ist wünschenswert. „Neues Produkt“-Button.
- **Formulare** (Dialog, `react-hook-form` + Zod-Resolver, beides vorhanden): Kategorie = Name.
  Produkt = Name, Kategorie (Select), Preis (€-Eingabe), Bild (Upload + Vorschau, optional),
  Bestand (optional/leer = unbegrenzt).
- **States**: Loading (Skeleton/Text), Empty („Noch keine Kategorien/Produkte“), Fehler-Toast.
  Deaktivierte Einträge visuell gedämpft + „Inaktiv“-Badge.
- **Motion**: dezent (Framer Motion / `motion`), Zeilen-Ein/Ausblenden, keine verspielten Effekte.
- **Copy** komplett deutsch in `adminMessages` (Beispiele): Titel „Verwaltung“, Tabs
  „Kategorien“/„Produkte“/„Einstellungen“, „Neue Kategorie“, „Neues Produkt“, „Bearbeiten“,
  „Deaktivieren“, „Reaktivieren“, „Nach oben“, „Nach unten“, „Bild hochladen“, „Preis (€)“,
  „Bestand (leer = unbegrenzt)“, „Ausverkauft“, „Unbegrenzt“, „Inaktiv“, „Café-Name“,
  „PayPal-Handle“, „Speichern“, „Abbrechen“, Toasts („Gespeichert.“, „Deaktiviert.“, …),
  Fehler („Etwas ist schiefgelaufen. Bitte erneut versuchen.“).

## Akzeptanzkriterien

- [ ] Kategorien: anlegen, umbenennen, deaktivieren, reaktivieren, hoch/runter sortieren.
- [ ] Produkte: anlegen (mit optionalem Bild-Upload), bearbeiten, deaktivieren, reaktivieren,
      hoch/runter sortieren, Kategorie zuweisen.
- [ ] Bild-Upload speichert lokal unter `data/uploads/`, Bild erscheint als Thumbnail im Admin
      und als Produktbild am Terminal (via `/api/uploads/<file>`), funktioniert offline.
- [ ] Bestand: `NULL`=unbegrenzt, Zahl, `0`=ausverkauft. `0` → Produkt am Terminal ausgegraut.
- [ ] Einstellungen: `cafe_name` und `paypal_handle` bearbeitbar und persistiert.
- [ ] Jede Katalog-Mutation pusht `catalog:changed`; ein offenes Terminal aktualisiert sich
      **ohne** Reload (live getestet).
- [ ] Preise durchgängig in Cents gespeichert, deutsch als € angezeigt; keine Float-Rundungsfehler.
- [ ] UI 100% deutsch, Code 100% englisch; keine hartkodierten UI-Strings außerhalb `messages.ts`.
- [ ] `/admin` ist nur mit Rolle `admin` erreichbar (proxy-gegated) — unverändert, aber verifizieren.

## Checks (nach Umsetzung ausführen, Output berichten)

- `npm run lint`
- `npm run build` (Upload-Route + `next/image`-Konfiguration können den Build beeinflussen)
- Falls Schema-Änderungen nötig würden: `npm run db:generate` && `npm run db:migrate`
  (Erwartung: **keine** Schema-Änderung nötig — alle Felder existieren bereits).

## Manuelle Test-Schritte

1. `npm run db:seed` (Beispielkatalog), dann `npm run dev`.
2. Gerät als `admin` einrichten: `/setup` → Rolle „Admin“; `/admin` öffnen.
3. **Zweites Fenster** `/terminal` offen lassen (idealerweise zweites Gerät im LAN via
   `http://<Pi-IP>:3000/terminal`) → Live-Sync beobachten.
4. Admin → Kategorie „Snacks“ anlegen → erscheint sofort; Produkt „Muffin“ mit Bild-Upload,
   Preis 2,50 €, Bestand 3 anlegen → am Terminal ohne Reload sichtbar, Bild lädt.
5. Bestand auf 0 setzen → Muffin am Terminal ausgegraut/„Ausverkauft“.
6. Produkt/Kategorie sortieren (hoch/runter) → Reihenfolge am Terminal ändert sich live.
7. Produkt deaktivieren → verschwindet am Terminal; reaktivieren → wieder da.
8. Einstellungen → PayPal-Handle ändern → im PayPal-Screen des Terminals (neue Bestellung)
   greift der neue Handle.
9. Offline-Check: Netzwerk/Internet trennen (nur LAN) → Upload + Bildanzeige funktionieren weiter.
