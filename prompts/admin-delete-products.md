# Produkte endgültig löschen + Archiv-Sektion (Admin)

## Ziel

Im Admin-Dashboard müssen Produkte nicht nur deaktiviert, sondern auch **endgültig entfernt**
werden können. Zusätzlich soll die Produktliste sauber bleiben: deaktivierte Produkte wandern
in eine eingeklappte **Archiv-Sektion** pro Kategorie statt dauerhaft in der Hauptliste zu stehen.

Zwei-Stufen-Modell (exakt wie bei Kategorien bereits umgesetzt):

1. **Deaktivieren** — bleibt unverändert: Produkt verschwindet vom Terminal, bleibt im Admin
   (jetzt: im Archiv) und ist reaktivierbar. Für Saisonartikel.
2. **Endgültig löschen** — harter DB-Delete, nur nach Bestätigungsdialog.

Kategorien bekommen keinen neuen Code — deren Löschfunktion existiert bereits vollständig
(siehe unten). Nur eine kleine Angleichung ist nötig (siehe Punkt 6).

## Inspizierter Code (Ist-Zustand)

- `src/app/api/admin/products/[id]/route.ts` — `DELETE` macht heute **nur** einen Soft-Delete
  (`updateProduct(id, { active: false })`). Kein `permanent`-Flag.
- `src/app/api/admin/categories/[id]/route.ts` — `DELETE` kennt bereits `?permanent=true`
  → `deleteCategory(id)` (hart), sonst soft. **Dieses Muster ist die Vorlage.**
- `src/lib/admin-catalog.ts` — `deleteCategory()` (Zeile ~290) ist der einzige harte Delete;
  wirft `AdminValidationError`, wenn noch Produkte an der Kategorie hängen.
  Es gibt **kein** `deleteProduct()`.
- `src/components/admin/category-manager.tsx` — hat bereits `deleting`/`deletePending`-State,
  einen `Dialog` als Bestätigung und einen `Trash2Icon`-Button (nur sichtbar, wenn die
  Kategorie leer ist). **Diese Komponente ist das UI-Vorbild.**
- `src/components/admin/product-manager.tsx` — nur `Deaktivieren`/`Reaktivieren`;
  inaktive Produkte stehen mit `opacity-55` in derselben Liste.
- `src/components/admin/admin-dashboard.tsx` — `mutate()`-Helper + `categoryHandlers.onDelete`
  (`?permanent=true`). `productHandlers` hat kein `onDelete`.
- `src/lib/messages.ts` — `adminMessages.common.deleteForever` existiert,
  `adminMessages.categories.confirmDelete.*` existiert, `products.confirmDelete` fehlt.
- `src/lib/db/schema.ts` — `orderItems.productId` ist `ON DELETE SET NULL`, Name und Preis
  liegen als Snapshot (`nameSnapshot`, `unitPriceCents`, `needsPreparation`) im `order_items`.
  `productModifierGroups.productId` ist `ON DELETE CASCADE`.
- `src/lib/uploads.ts` — `saveUpload` / `readUpload`; **kein** `deleteUpload`.
  Uploads liegen unter `data/uploads/<uuid>.<ext>`, referenziert als `/api/uploads/<file>`.

## Entscheidungen / Annahmen

- **Harter Produkt-Delete ist immer erlaubt** — anders als bei Kategorien braucht es keine
  „nur wenn nie bestellt“-Regel: `order_items` hält Name und Preis als Snapshot und
  `productId` wird auf NULL gesetzt. Alte Bestellungen und das Archiv bleiben korrekt;
  es geht nur die Verknüpfung verloren. Der Bestätigungstext sagt das nicht extra —
  „kann nicht rückgängig gemacht werden“ reicht.
- **Bild wird mitgelöscht**: beim harten Delete wird die zugehörige Upload-Datei entfernt,
  damit die Uploads auf der Pi nicht endlos wachsen. Fehlschlag beim Löschen der Datei
  (Datei fehlt o. ä.) darf den Request **nicht** scheitern lassen — best effort.
  Nur Dateien unter `/api/uploads/` löschen, externe/andere `imageUrl`-Werte ignorieren.
- **Archiv-Sektion pro Kategorie**, nicht global — so bleibt der Bezug zur Kategorie
  sichtbar und die Reihenfolge-Pfeile bleiben logisch.
- Archiv ist **standardmäßig eingeklappt** und wird nur gerendert, wenn es mindestens ein
  inaktives Produkt in dieser Kategorie gibt. Aufklappzustand ist lokaler UI-State
  (`useState` pro Kategorie), nichts wird persistiert.
- Sortier-Pfeile im Archiv: **weglassen**. Reihenfolge ist nur für aktive Produkte relevant.
  `isFirst`/`isLast` beziehen sich dann auf die aktive Liste.
- Der `Endgültig löschen`-Button erscheint **nur bei inaktiven Produkten** (also im Archiv).
  Begründung: erst deaktivieren, dann löschen — verhindert Fehlgriffe an einem Produkt,
  das gerade im laufenden Betrieb am Terminal steht.

## Zu ändernde Dateien

| Datei | Änderung |
|---|---|
| `src/lib/uploads.ts` | neu: `deleteUpload(url: string): Promise<void>` (best effort) |
| `src/lib/admin-catalog.ts` | neu: `deleteProduct(id: number): string \| null` — löscht hart, gibt die `imageUrl` zurück |
| `src/app/api/admin/products/[id]/route.ts` | `DELETE` versteht `?permanent=true` |
| `src/lib/messages.ts` | `products.confirmDelete.*`, `products.toasts.deleted`, `products.archive.*` |
| `src/components/admin/product-manager.tsx` | Archiv-Sektion, Löschen-Button, Bestätigungsdialog |
| `src/components/admin/admin-dashboard.tsx` | `productHandlers.onDelete` |
| `src/components/admin/category-manager.tsx` | kleine Angleichung (Punkt 6) |

## Implementierungsanforderungen

### 1. `src/lib/uploads.ts` — `deleteUpload`

```ts
/**
 * Removes a stored product image. Best effort: a missing file or a URL that
 * isn't a local upload is silently ignored — deleting a product must never
 * fail because of its image.
 */
export async function deleteUpload(url: string | null): Promise<void>
```

- Nur `^/api/uploads/<uuid>.(jpg|png|webp)$` akzeptieren (gleiche Regex-Härte wie `readUpload`,
  kein Path-Traversal). Alles andere: no-op.
- `unlink` in `try/catch`, Fehler verschlucken.
- Dieselben `/*turbopackIgnore: true*/`-Kommentare an den Laufzeitpfaden wie im Rest der Datei.

### 2. `src/lib/admin-catalog.ts` — `deleteProduct`

```ts
/**
 * Permanently deletes a product — HARD delete, unlike the soft
 * `updateProduct({ active: false })`. Order history survives: `order_items`
 * snapshots name and price, and `order_items.product_id` is ON DELETE SET NULL.
 * Returns the product's image URL so the caller can clean up the file.
 */
export function deleteProduct(id: number): string | null
```

- In einer `db.transaction`: Produkt laden (`AdminNotFoundError`, wenn nicht vorhanden),
  `imageUrl` merken, `tx.delete(products).where(eq(products.id, id)).run()`.
- `product_modifier_groups` räumt der FK-Cascade ab — **nicht** manuell löschen.
- Sicherstellen, dass Foreign Keys in der DB aktiv sind (`PRAGMA foreign_keys = ON`);
  falls das in `src/lib/db/*` noch nicht gesetzt ist, dort ergänzen — sonst greift weder
  das `SET NULL` auf `order_items` noch die Cascade.
- Keine Neusortierung der übrigen `sortOrder`-Werte nötig (Lücken sind unkritisch, wie beim
  bestehenden `moveProduct`-Verhalten).

### 3. Route `DELETE /api/admin/products/[id]`

Exakt nach dem Vorbild der Kategorie-Route:

- `const permanent = new URL(request.url).searchParams.get("permanent") === "true";`
- `permanent` → `const imageUrl = deleteProduct(id); await deleteUpload(imageUrl);`
- sonst → wie bisher `updateProduct(id, { active: false })`
- In **beiden** Fällen `broadcast({ type: "catalog:changed" })`, danach `{ ok: true }`.
- Fehler weiter über `adminErrorResponse(error)`.
- Doc-Kommentar über der Funktion an die Kategorie-Route angleichen.

### 4. Messages (`src/lib/messages.ts`, `adminMessages`)

Deutsch, im Stil der bestehenden Einträge — analog zu `categories.confirmDelete`:

```ts
products: {
  // ...
  archive: {
    heading: (count: number) => count === 1 ? "1 archiviertes Produkt" : `${count} archivierte Produkte`,
    hint: "Deaktivierte Produkte — am Terminal nicht sichtbar.",
  },
  confirmDelete: {
    title: "Produkt endgültig löschen?",
    description: (name: string) =>
      `„${name}“ wird dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden. Bereits abgeschlossene Bestellungen bleiben unverändert.`,
    confirm: "Endgültig löschen",
    cancel: "Abbrechen",
  },
  toasts: {
    // ...
    deleted: "Produkt gelöscht.",
  },
}
```

Keine neuen `common`-Keys — `common.deleteForever` wird wiederverwendet.

### 5. `product-manager.tsx`

- `ProductHandlers` um `onDelete: (id: number) => Promise<boolean>` erweitern.
- Pro Kategorie aufteilen:
  `const active = category.products.filter(p => p.active)` /
  `const archived = category.products.filter(p => !p.active)`.
  Die bestehende „Noch keine Produkte in dieser Kategorie“-Empty-State greift, wenn
  **beide** leer sind; sind nur die aktiven leer, aber Archiv vorhanden, zeigt die
  Hauptliste den Empty-State und das Archiv steht darunter.
- Archiv-Block unter der aktiven Liste:
  - Toggle-Button (`variant="ghost"`, `size="sm"`, `ChevronDownIcon`/`ChevronRightIcon`
    je nach Zustand) mit `t.products.archive.heading(archived.length)`,
    `aria-expanded` gesetzt.
  - Aufgeklappt: `<ul className="divide-y rounded-2xl border">` mit denselben `ProductRow`s,
    plus `t.products.archive.hint` als kleiner `text-muted-foreground`-Text.
  - Aufklappzustand: `useState<Set<number>>` oder `Record<number, boolean>` im
    `ProductManager`, per Kategorie-Id.
- `ProductRow` bekommt ein `archived: boolean`-Prop:
  - `archived` → Sortier-Pfeile nicht rendern; „Heute aus“-Toggle und `StockControl`
    ebenfalls nicht rendern (bei einem archivierten Produkt sinnlos).
    Sichtbar bleiben: Bild, Name, Preis, `Bearbeiten`, `Reaktivieren`,
    `Endgültig löschen` (`Trash2Icon`, `variant="ghost"`,
    `className="h-10 text-destructive hover:text-destructive"`).
  - nicht `archived` → exakt wie heute, aber **ohne** Löschen-Button.
- Bestätigungsdialog 1:1 nach `category-manager.tsx`:
  `deleting`/`deletePending`-State, `Dialog` + `DialogHeader/Title/Description/Footer`,
  `Abbrechen` (`variant="outline"`, `disabled={deletePending}`) und
  `Endgültig löschen` (`variant="destructive"`, `disabled={deletePending}`).
  Nach Erfolg `setDeleting(null)`.
- Touch-Targets: alle Buttons behalten `h-10`/`size-8` wie bisher — das Admin läuft auf
  einem Touchscreen.

### 6. `category-manager.tsx` — kleine Angleichung

Der Löschen-Button erscheint dort heute bei **jeder** leeren Kategorie, auch bei einer aktiven.
Für ein konsistentes Modell („erst deaktivieren, dann löschen“) die Bedingung auf
`!category.active && category.products.length === 0` ändern. Sonst nichts anfassen.

### 7. `admin-dashboard.tsx`

`productHandlers` um

```ts
onDelete: (id) =>
  mutate(`/api/admin/products/${id}?permanent=true`, "DELETE", undefined, t.products.toasts.deleted),
```

erweitern — identisch zu `categoryHandlers.onDelete`.

## Real-time / Broadcast

- Beide `DELETE`-Pfade (soft und permanent) senden `broadcast({ type: "catalog:changed" })`.
- Ein gelöschtes Produkt muss **sofort** von jedem offenen Terminal und der Kasse
  verschwinden, ohne Reload — der bestehende `catalog:changed`-Konsument
  (`use-catalog.ts` / `use-event-stream.ts`) deckt das ab; kein neuer Event-Typ.
- Sonderfall prüfen: Liegt das gelöschte Produkt gerade in einem **offenen Warenkorb**
  am Terminal oder in der Kasse, darf die UI nicht crashen. `use-cart.ts` gegen den
  neuen Katalog abgleichen — nicht mehr vorhandene Produkte still aus dem Warenkorb
  entfernen, falls das nicht ohnehin schon passiert. Falls die bestehende Logik das
  bereits leistet: nichts ändern und im Ergebnis vermerken.

## Akzeptanzkriterien

- [ ] Ein aktives Produkt hat **keinen** Löschen-Button — nur `Deaktivieren`.
- [ ] Deaktivieren verschiebt das Produkt in die eingeklappte Archiv-Sektion seiner Kategorie.
- [ ] Im Archiv gibt es `Bearbeiten`, `Reaktivieren` und `Endgültig löschen`.
- [ ] `Endgültig löschen` öffnet einen Bestätigungsdialog mit dem Produktnamen; `Abbrechen`
      lässt alles unverändert.
- [ ] Nach Bestätigung ist das Produkt aus DB und Admin-Liste verschwunden, Toast
      „Produkt gelöscht.“ erscheint.
- [ ] Die zugehörige Bilddatei unter `data/uploads/` ist weg.
- [ ] Eine alte Bestellung mit diesem Produkt zeigt im Admin-Archiv weiterhin Name, Preis
      und Summe korrekt an.
- [ ] Terminal und Kasse aktualisieren sich live, ohne Reload.
- [ ] Kategorien: Löschen-Button nur noch bei inaktiven, leeren Kategorien.
- [ ] Alle sichtbaren Strings deutsch, aller Code englisch.

## Checks

```
npm run lint
npm run build
```

Keine Migration nötig — das Schema ändert sich nicht.

## Manuelle Tests

1. `npm run dev`, `http://localhost:3000/admin` öffnen, Tab **Produkte**.
2. Testprodukt mit Bild anlegen. Dateiname unter `data/uploads/` merken (`ls -t data/uploads | head -1`).
3. Am Terminal (`/terminal`, zweiter Tab oder zweites Gerät über die LAN-IP der Pi:
   `http://<pi-ip>:3000/terminal`) das Produkt bestellen und die Bestellung an der Kasse
   (`/kasse`) kassieren, damit Historie existiert.
4. Im Admin **Deaktivieren** klicken → Produkt verschwindet aus der Hauptliste, das Archiv
   zeigt „1 archiviertes Produkt“. Terminal (offen lassen!) blendet es sofort aus.
5. Archiv aufklappen → **Endgültig löschen** → Dialog erscheint, erst **Abbrechen**
   (nichts passiert), dann bestätigen.
6. Prüfen: Produkt weg, Toast erscheint, `ls data/uploads` enthält die Datei nicht mehr.
7. Admin-Tab **Archiv** (Bestellungen): die alte Bestellung zeigt weiterhin Produktname,
   Preis und korrekte Summe.
8. Kategorie-Tab: eine aktive leere Kategorie hat keinen Löschen-Button; nach
   `Deaktivieren` erscheint er.
9. Kanten-Fall: Produkt am Terminal in den Warenkorb legen, im Admin löschen — das
   Terminal darf nicht crashen.
