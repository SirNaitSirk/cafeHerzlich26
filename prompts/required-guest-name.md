# Prompt: Namensfeld beim Bestellabschluss zur Pflicht machen

## Goal

Das optionale Namensfeld im Warenkorb/Bestellabschluss wird zu einem **Pflichtfeld**. Ohne gültigen Namen kann die Bestellung nicht zur Bezahlung fortgesetzt werden. Gilt für **Terminal und Kasse** (beide nutzen denselben Flow).

## Existing code inspected

- [src/components/terminal/cart-screen.tsx](../src/components/terminal/cart-screen.tsx) — enthält das `Input`-Namensfeld (Zeilen 109–118) und den „Weiter zur Bezahlung“-Button (Zeilen 128–135). Button ist aktuell nur bei leerem Warenkorb deaktiviert.
- [src/components/terminal/order-flow.tsx](../src/components/terminal/order-flow.tsx) — hält `name`-State, `onContinue={() => setStep("payment")}`; wird von Terminal **und** Kasse (`source`) verwendet. Sendet `guestName: name.trim() || undefined` beim Submit (Zeile 96).
- [src/lib/messages.ts](../src/lib/messages.ts) — `cart.namePlaceholder` / `cart.nameHint` je Sprache (DE Zeilen 47–48, RU Zeilen 124–125).

## Decisions / assumptions

- Gültig = getrimmter Name ist nicht leer (min. 1 Zeichen). `maxLength={40}` bleibt.
- Validierung erfolgt clientseitig durch Deaktivieren des Weiter-Buttons; kein Server-/Zod-Zwang nötig, da UX-Gate ausreicht und der Flow ohnehin nur so weiterkommt. `guestName` wird dadurch immer gesetzt.
- Kein separater Fehler-Toast; stattdessen deaktivierter Button + angepasster Hinweistext, konsistent mit dem bestehenden Muster (Button-disabled bei leerem Warenkorb).

## Files likely to change

- `src/components/terminal/cart-screen.tsx`
- `src/lib/messages.ts` (DE + RU Copy)

## Implementation requirements

1. **cart-screen.tsx**
   - Continue-Button zusätzlich deaktivieren, wenn `name.trim()` leer ist:
     `disabled={cart.itemCount === 0 || name.trim().length === 0}`.
   - Hinweistext unter dem Feld an den Pflichtcharakter anpassen (`t.cart.nameHint`).
   - Optional dezente visuelle Kennzeichnung als Pflichtfeld (z. B. Platzhalter ohne „(optional)“).
2. **messages.ts** (DE + RU)
   - `namePlaceholder`: „(optional)“ / „(необязательно)“ entfernen → `"Dein Name"` bzw. `"Ваше имя"`.
   - `nameHint`: Pflichtcharakter ausdrücken, z. B. DE `"Bitte gib deinen Namen ein – er erscheint auf dem Abholmonitor."`, RU sinngemäß.

## Real-time / broadcast requirements

Keine. Rein clientseitige Validierung vor dem Absenden; kein neuer Server-Write, keine Event-Änderung.

## Acceptance criteria

- Bei leerem Namensfeld ist „Weiter zur Bezahlung“ deaktiviert (Terminal und Kasse).
- Nach Eingabe eines nicht-leeren Namens wird der Button aktiv; führt weiter zu Payment.
- Nur-Leerzeichen-Eingabe gilt als leer (Button bleibt deaktiviert).
- Kein „(optional)“ mehr im Placeholder; Hinweistext signalisiert Pflicht (DE + RU).
- Übermittelter `guestName` ist immer gesetzt.

## Checks to run

- `npm run lint`
- `npm run build`

## Manual test steps

1. `npm run dev`, am Terminal (`http://<pi-ip>:3000/terminal`) eine Bestellung bauen → zum Warenkorb.
2. Namensfeld leer lassen: „Weiter zur Bezahlung“ ist ausgegraut/deaktiviert.
3. Nur Leerzeichen eingeben: Button bleibt deaktiviert.
4. Namen eingeben: Button aktiv, Weiter zu Payment funktioniert.
5. Gleicher Test an der Kasse (`/kasse`, Bestellung im Namen eines Gastes).
6. Sprache auf RU umschalten und Placeholder/Hinweis prüfen.
