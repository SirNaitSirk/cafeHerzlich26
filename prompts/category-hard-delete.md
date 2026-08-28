# Prompt: Kategorien endgültig löschen (nur bei 0 Produkten)

## Goal

Im Admin-Dashboard soll eine leere Kategorie (0 Produkte) **endgültig aus der
Datenbank gelöscht** werden können — nicht nur deaktiviert. Kategorien mit
mindestens einem Produkt (auch inaktiven) bleiben wie bisher nur
deaktivierbar/reaktivierbar.

## Existing code inspected

- `src/app/api/admin/categories/[id]/route.ts` — `PATCH` (update/move),
  `DELETE` = aktuell **Soft-Delete** (`active → false`). Broadcastet `catalog:changed`.
- `src/lib/admin-catalog.ts` — Service-Layer. `updateCategory`, `moveCategory`,
  `AdminNotFoundError`, `AdminValidationError`. `getAdminCatalog()` liefert je
  Kategorie `products` **inkl. inaktiver** Produkte → `products.length === 0`
  bedeutet: wirklich keine Produktzeile referenziert die Kategorie.
- `src/components/admin/category-manager.tsx` — Liste, `CategoryHandlers`
  (`onCreate/onRename/onMove/onToggleActive`). Zeigt pro Zeile Bearbeiten +
  Deaktivieren/Reaktivieren.
- `src/components/admin/admin-dashboard.tsx` — verdrahtet `categoryHandlers` via
  `mutate(url, method, body, successMessage)`; `refetch()` nach Erfolg.
- `src/lib/messages.ts` — `adminMessages` (`common`, `categories.toasts`, …).
- Bestätigungs-Muster: `src/components/kueche/order-card.tsx` nutzt `Dialog` +
  `DialogFooter` mit destruktivem Button (keine AlertDialog-Komponente im Projekt).
- `src/app/api/admin/response.ts` — `adminErrorResponse`, `parseId`.

## Decisions / assumptions

- **Guard doppelt (Client + Server):** Löschen nur erlaubt, wenn die Kategorie
  **keine einzige Produktzeile** hat (aktiv oder inaktiv). Das schützt den FK
  `products.category_id`.
- **API-Design:** Bestehendes `DELETE` bleibt Soft-Delete (Deaktivieren).
  Endgültiges Löschen über denselben Endpunkt mit Query-Param `?permanent=true`.
  Server prüft erneut die 0-Produkte-Bedingung; bei Verstoß `AdminValidationError`
  → HTTP 400. Nicht existierende ID → `AdminNotFoundError` (404).
- **Bestätigung:** Da irreversibel, vor dem Löschen ein `Dialog`-Confirm
  (Muster wie `order-card.tsx`), destruktiver Button.
- **Sichtbarkeit:** Der „Endgültig löschen“-Button erscheint nur bei
  `category.products.length === 0`. Deaktivieren/Reaktivieren bleibt unverändert.
- Broadcast `catalog:changed` wie bei allen Katalog-Mutationen.

## Files likely to change

- `src/lib/admin-catalog.ts` — neue `deleteCategory(id)`-Funktion (Transaktion:
  prüft, dass keine `products`-Zeile auf die Kategorie zeigt, sonst
  `AdminValidationError`; sonst `delete from categories`; `AdminNotFoundError`
  wenn ID unbekannt).
- `src/app/api/admin/categories/[id]/route.ts` — `DELETE` erweitern: bei
  `?permanent=true` → `deleteCategory(id)`, sonst wie bisher Soft-Delete.
- `src/components/admin/category-manager.tsx` — neuer Handler `onDelete`, Button
  „Endgültig löschen“ (nur bei 0 Produkten) + Confirm-`Dialog`.
- `src/components/admin/admin-dashboard.tsx` — `onDelete` in `categoryHandlers`
  (`mutate(\`/api/admin/categories/${id}?permanent=true\`, "DELETE", undefined, …)`).
- `src/lib/messages.ts` — neue Strings: `common.deleteForever`
  („Endgültig löschen“), `categories.confirmDelete` (title/description/confirm/cancel),
  `categories.toasts.deleted`.

## Implementation requirements

- `deleteCategory` in einer `db.transaction`: erst Existenz prüfen, dann
  `count`/`select` auf `products` mit `categoryId`; ist `> 0` →
  `throw new AdminValidationError("Kategorie enthält noch Produkte.")`.
- Route: Query-Param via `new URL(request.url).searchParams.get("permanent") === "true"`.
- Kein `any`; explizite Typen; deutsche UI-Strings ausschließlich über `messages.ts`.
- Button-Stil: dezent (`variant="ghost"`, destruktive Textfarbe) mit
  `Trash2Icon`, damit er nicht mit Deaktivieren konkurriert. Touch-Größe `h-10`.

## Real-time / broadcast requirements

- Nach erfolgreichem Löschen `broadcast({ type: "catalog:changed" })`, damit alle
  Screens (Terminal/Admin) sofort aktualisieren. Client `refetch()` via `mutate`.

## Acceptance criteria

- Kategorie mit 0 Produkten zeigt „Endgültig löschen“; Klick → Confirm → Zeile
  verschwindet dauerhaft (auch nach Reload / DB-seitig weg).
- Kategorie mit ≥1 Produkt (aktiv oder inaktiv) zeigt **keinen**
  Lösch-Button; nur Deaktivieren/Reaktivieren.
- Direkter API-Aufruf `DELETE …?permanent=true` auf eine nicht-leere Kategorie →
  400, keine Löschung.
- Ohne `?permanent=true` verhält sich `DELETE` unverändert (Deaktivieren).

## Checks to run

- `npm run lint`
- `npm run build` (Route/Service geändert)

## Manual test steps

1. `npm run dev`, `/admin` öffnen (bzw. vom Kasse-Gerät verlinkt), Tab „Kategorien“.
2. Neue leere Kategorie anlegen → „Endgültig löschen“ sichtbar → löschen,
   bestätigen → verschwindet; Seite neu laden → bleibt weg.
3. Bei einer Kategorie mit Produkten prüfen: kein Lösch-Button, nur Deaktivieren.
4. Alle Produkte einer Kategorie in eine andere verschieben, bis 0 → Lösch-Button
   erscheint live (SSE), ohne manuelles Reload.
