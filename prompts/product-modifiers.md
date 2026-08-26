# Prompt: Produkt-Modifier (Zusatzangaben / Extras)

## Ziel

Guests sollen bei bestimmten Produkten Zusatzangaben machen können — z. B. einen Latte
Macchiato „mit einem Schuss Karamell" oder eine Milchsorte wählen. Umgesetzt als
**wiederverwendbare Modifier-Gruppen**, die im Admin definiert und einzelnen Produkten
zugewiesen werden. Zwei Auswahltypen in einer Struktur:

- **single** — genau eine Option (Radio), z. B. „Milch": Vollmilch / Hafer / Soja.
- **multi** — beliebig viele Optionen (Checkbox), z. B. „Extras": Schuss Karamell, Extra-Shot.

Gruppen können `required` sein (mindestens eine Auswahl nötig). Modifier haben **keinen**
eigenen Stock-Count in dieser Iteration — nur ein `active`-Flag (ausverkauft = im Admin
deaktivieren). Preis-Deltas in **Cents**, können 0 sein.

## Bestehender Code (inspiziert)

- Schema: [schema.ts](../src/lib/db/schema.ts) — `products`, `orders`, `orderItems` (mit
  `nameSnapshot`/`unitPriceCents`-Snapshots), Money in Cents, Timestamps in ms.
- Terminal-Katalog (nur aktiv): [catalog.ts](../src/lib/catalog.ts) → `CatalogProduct`.
- Admin-Katalog (alle, inkl. Mutationen): [admin-catalog.ts](../src/lib/admin-catalog.ts).
- Bestell-Erstellung: [orders.ts](../src/lib/orders.ts) `createOrder` + `createOrderSchema`;
  Server besitzt Preis & Stock, Client sendet nur ids + quantities. Route:
  [route.ts](../src/app/api/orders/route.ts) (broadcastet `orders:changed` + `catalog:changed`).
- Cart: [use-cart.ts](../src/hooks/use-cart.ts) — Zeile aktuell nur per `productId` identifiziert.
- Terminal-Komponenten: [src/components/terminal/](../src/components/terminal/)
  (`menu-screen`, `product-card`, `cart-screen`, `order-flow`).
- Admin-Komponenten: [src/components/admin/](../src/components/admin/)
  (`product-form-dialog`, `product-manager`, `admin-dashboard`).
- Staff-Anzeige der Positionen: `orderItems` werden über `hydrateOrders` in `OrderWithItems`
  geladen und in Küche/Kasse/Abholung gerendert.
- Copy zentral in [messages.ts](../src/lib/messages.ts).

## Entscheidungen / Annahmen

- Beide Auswahltypen (single + multi) in **einer** Struktur (`selectionType`).
- **Kein** Modifier-Stock; nur `active`.
- Gruppen sind **wiederverwendbar** (n:m zu Produkten) — nicht am Einzelprodukt hängend.
- Gewählte Modifier werden pro `order_item` **gesnapshottet** (Name + Preis-Delta), analog
  zum bestehenden Name-/Preis-Snapshot — Historie bleibt stabil bei späteren Edits.
- Positionspreis = Produkt-Basispreis + Summe der gewählten Modifier-Deltas.
- Cart-Zeilen werden per **Produkt + Signatur der gewählten Modifier-ids** unterschieden:
  zwei identische Produkte mit unterschiedlichen Modifiern sind getrennte Zeilen; gleiche
  Auswahl erhöht die Menge.
- Server bleibt Source of Truth: Client sendet gewählte `modifierId`s; Server re-validiert
  (Gruppe gehört zum Produkt, Modifier aktiv, single = max 1, required erfüllt) und berechnet
  Deltas neu. Client-Preise werden nie vertraut.

## Datenmodell (neue Tabellen — Drizzle-Migration)

In [schema.ts](../src/lib/db/schema.ts):

```ts
export const MODIFIER_SELECTION_TYPES = ["single", "multi"] as const;
export type ModifierSelectionType = (typeof MODIFIER_SELECTION_TYPES)[number];

// modifier_groups: id, name, selectionType ($type<ModifierSelectionType>),
//   required (boolean, default false), sortOrder (int default 0),
//   active (boolean default true), createdAt
// modifiers: id, groupId (FK → modifier_groups, onDelete cascade), name,
//   priceDeltaCents (int, default 0, >= 0), active (boolean default true),
//   sortOrder (int default 0), createdAt
// product_modifier_groups: productId (FK → products, onDelete cascade),
//   groupId (FK → modifier_groups, onDelete cascade), sortOrder (int default 0);
//   composite PK (productId, groupId)
// order_item_modifiers: id, orderItemId (FK → order_items, onDelete cascade),
//   modifierId (FK → modifiers, onDelete set null, nullable — history survives delete),
//   nameSnapshot (text notNull), groupNameSnapshot (text notNull),
//   priceDeltaCents (int notNull)
```

- Exportiere `$inferSelect`/`$inferInsert`-Typen wie bei den bestehenden Tabellen.
- `npm run db:generate` → neue Migration in `drizzle/`; `npm run db:migrate` anwenden.
- `seed.ts` optional um eine Beispielgruppe („Extras" mit „Schuss Karamell" +0,50 €,
  „Extra Espresso-Shot" +0,80 €) erweitern und einem Kaffee zuweisen.

## Terminal (Guest)

- `getCatalog()` in [catalog.ts](../src/lib/catalog.ts) erweitern: pro `CatalogProduct` die
  zugewiesenen aktiven Gruppen mit ihren aktiven Modifiern mitladen
  (`modifierGroups: { id, name, selectionType, required, modifiers: { id, name, priceDeltaCents }[] }[]`).
  Effizient laden (kein N+1): Gruppen/Modifier für alle sichtbaren Produkte in wenigen
  Queries holen und im Speicher zuordnen (analog zur bestehenden Kategorie-/Produkt-Zuordnung).
- **Nur Produkte mit ≥1 zugewiesener Gruppe** zeigen ein Optionen-Sheet; Produkte ohne Gruppen
  verhalten sich wie bisher (direkt in den Cart).
- Neues Options-UI (shadcn Dialog/Sheet, Framer-Motion, große Touch-Targets): pro Gruppe eine
  Sektion — `single` als Radio, `multi` als Checkboxen. `required`-Gruppen ohne Auswahl
  blockieren „Hinzufügen" (deutliche Hinweis-Copy). Live-Preisvorschau (Basis + Deltas).
- [use-cart.ts](../src/hooks/use-cart.ts): `CartLine` um `modifiers: { modifierId, name, priceDeltaCents }[]`
  und einen stabilen `lineId` (Produkt-id + sortierte Modifier-ids) erweitern.
  - `add(product, selectedModifiers)`: Zeilen per `lineId` zusammenführen statt per `productId`.
  - `setQuantity`/`remove` auf `lineId` umstellen.
  - Positions- und Gesamtsumme = `(priceCents + Σ delta) * quantity`.
- [cart-screen.tsx](../src/components/terminal/cart-screen.tsx): gewählte Modifier je Zeile als
  Unterzeile anzeigen; korrekten Positionspreis rechnen.
- Bestell-Payload: pro Item zusätzlich `modifierIds: number[]` senden.

## Server / Bestell-Erstellung

- `createOrderSchema` in [orders.ts](../src/lib/orders.ts): jedes Item bekommt
  `modifierIds: z.array(z.number().int().positive()).default([])`.
- `createOrder`: in der Transaktion pro Item die gewählten Modifier laden und validieren:
  - jeder Modifier existiert, ist `active`, gehört zu einer Gruppe, die dem Produkt zugewiesen ist;
  - `single`-Gruppen: höchstens 1 gewählter Modifier;
  - `required`-Gruppen: mindestens 1 gewählt;
  - sonst `OrderValidationError`.
- Positionspreis = `product.priceCents + Σ modifier.priceDeltaCents`; `totalCents` daraus
  summieren (× quantity). **`order_items.unitPriceCents` = inkl. Modifier-Deltas** (Snapshot
  bleibt der tatsächlich berechnete Stückpreis).
- Gewählte Modifier in `order_item_modifiers` snapshotten (name, gruppenname, delta).
- Stock-Logik unverändert (nur Produkte).
- Route broadcastet weiterhin `orders:changed` + `catalog:changed` — unverändert.

## Staff-Anzeige (Küche / Kasse / Abholung)

- `hydrateOrders` / `OrderWithItems` in [orders.ts](../src/lib/orders.ts) erweitern: pro
  `orderItem` die `order_item_modifiers`-Snapshots mitladen (`items[].modifiers`).
- In Küche/Kasse die gewählten Modifier als kompakte Unterzeile pro Position rendern
  (z. B. „+ Schuss Karamell"). Abholmonitor braucht keine Detailtiefe — nur wenn dort ohnehin
  Positionen gezeigt werden, konsistent ergänzen.

## Admin

- `admin-catalog.ts`: CRUD für **Gruppen** (create/edit/deactivate/reactivate/reorder) und
  **Modifier** (create/edit/deactivate/reactivate/reorder innerhalb einer Gruppe), plus
  **Zuweisung** von Gruppen zu Produkten (setzen/entfernen, `product_modifier_groups`).
  Löschung soft (`active = false`) analog zu Produkten/Kategorien; Snapshots bleiben intakt.
- Neue Route(n) unter `src/app/api/admin/…` (thin, Zod-validiert), broadcasten
  `catalog:changed` nach jeder Mutation (Terminal muss Optionen sofort sehen).
- Admin-UI: neuer Bereich „Extras/Optionen" (Gruppen + Modifier verwalten) und im
  Produkt-Formular ([product-form-dialog.tsx](../src/components/admin/product-form-dialog.tsx))
  eine Mehrfachauswahl der zugewiesenen Gruppen.
- Alle neuen Strings in [messages.ts](../src/lib/messages.ts) (Deutsch), Code englisch.

## Real-time / Broadcast

- Jede Modifier-/Gruppen-/Zuweisungs-Mutation → `broadcast({ type: "catalog:changed" })`,
  damit Terminal die Optionen live nachlädt (bestehender `catalog:changed`-Kanal, kein neuer
  Event-Typ nötig).
- Bestell-Erstellung broadcastet unverändert; Staff-Screens zeigen Modifier durch die
  erweiterte Hydration automatisch.

## Betroffene Dateien (voraussichtlich)

- `src/lib/db/schema.ts`, `drizzle/*` (Migration), `src/lib/db/seed.ts` (optional)
- `src/lib/catalog.ts`, `src/lib/orders.ts`, `src/lib/admin-catalog.ts`
- `src/hooks/use-cart.ts`
- `src/components/terminal/*` (neues Options-Sheet, `menu-screen`, `product-card`, `cart-screen`, `order-flow`)
- `src/components/admin/*` (neuer Manager + Produkt-Formular)
- `src/app/api/orders/route.ts` (Payload), neue `src/app/api/admin/*`-Route(n)
- `src/lib/messages.ts`

## Acceptance-Kriterien

- Ein Produkt mit „Extras"-Gruppe zeigt am Terminal ein Options-Sheet; Auswahl „Schuss
  Karamell" erhöht den Positionspreis korrekt (Cents), Zeile zeigt die Auswahl.
- Zwei gleiche Produkte mit unterschiedlichen Optionen = zwei Cart-Zeilen; identische Auswahl
  erhöht die Menge derselben Zeile.
- `required`-single-Gruppe ohne Auswahl blockiert „Hinzufügen".
- Bestellung landet mit korrektem `totalCents` (inkl. Deltas) in Küche/Kasse; Modifier als
  Unterzeile sichtbar; Historie bleibt bei späterem Produkt-/Modifier-Edit unverändert.
- Server weist manipulierte Payloads (fremder/inaktiver Modifier, mehrere bei `single`) mit
  400 ab.
- Admin kann Gruppen + Modifier anlegen/bearbeiten/deaktivieren und Produkten zuweisen; Terminal
  aktualisiert live via `catalog:changed`.

## Checks

- `npm run db:generate` && `npm run db:migrate`
- `npm run lint`
- `npm run build`
- `npm test` (falls vorhanden)

## Manuelle Test-Schritte

1. `npm run dev`, Admin (`/admin`) öffnen: Gruppe „Extras" (multi) + Modifier „Schuss Karamell"
   (+0,50 €) anlegen, einem Latte Macchiato zuweisen. Zusätzlich Gruppe „Milch" (single,
   required) mit Vollmilch/Hafer anlegen und zuweisen.
2. Terminal (`/terminal`) auf einem zweiten Gerät/Tab: Latte hinzufügen → Sheet erscheint,
   Karamell ankreuzen, Milch wählen (Pflicht) → Preis stimmt.
3. Zweiten Latte ohne Karamell hinzufügen → getrennte Cart-Zeile.
4. Bestellung (Bar) abschließen; Kasse (`/kasse`) freigeben; Küche (`/kueche`) prüfen:
   Modifier als Unterzeile, Summe korrekt.
5. Im Admin den Modifier-Preis ändern → alte Bestellung in der Historie bleibt unverändert.
