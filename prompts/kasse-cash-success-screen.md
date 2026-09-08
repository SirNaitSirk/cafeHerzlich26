# Kasse: kein Gast-Success-Screen hinter dem Abrechnungs-Dialog

## Ziel

Nimmt die Kasse eine Barbestellung im eigenen Bestellablauf auf, öffnet sich der
Abrechnungs-Dialog (`CashRegisterDialog`) über dem grünen Terminal-Success-Screen
("Bestellung aufgenommen — bitte an der Kasse bezahlen"). Diese Anweisung richtet
sich an Gäste am Terminal und ist an der Kasse sinnlos. Hinter dem Dialog sollen
stattdessen die normalen Kasse-Warteschlangen stehen.

## Inspizierter Code

- `src/components/kasse/kasse-dashboard.tsx`
  - `handleOrderCreated` (Z. ~120): setzt bei `method === "cash"` nur `pendingCashOrder`.
  - `cashRegister` (Z. ~142) wird sowohl über dem `OrderFlow` (Z. 168) als auch
    über dem Dashboard (Z. 330) gerendert — der Dialog überlebt das Unmounten
    des Bestellablaufs also bereits.
  - `settlePendingCashOrder` setzt nach Erfolg ohnehin `setOrdering(false)`.
- `src/components/terminal/order-flow.tsx`
  - `submitOrder` ruft `onOrderCreated?.(...)` und danach `setStep("success")`.
- `src/components/terminal/success-screen.tsx`
  - Auto-Return nach 6 s über `onDone` → `onComplete` → `setOrdering(false)`.

## Entscheidungen

- Nur der **Bar**-Fall an der Kasse ändert sich. PayPal an der Kasse behält den
  Success-Screen (Bestätigung nach dem QR-Code), Terminal bleibt komplett unberührt.
- Umgesetzt wird das ausschließlich in `kasse-dashboard.tsx`: `handleOrderCreated`
  setzt zusätzlich `setOrdering(false)`. Der `OrderFlow` unmountet damit im selben
  Render, sein `setStep("success")` wird nie sichtbar. `order-flow.tsx` bleibt
  unverändert — keine neue Prop, keine Sonderfall-Logik im Terminal-Code.

## Betroffene Dateien

- `src/components/kasse/kasse-dashboard.tsx` (einzige Änderung, wenige Zeilen + Kommentar)

## Anforderungen

1. `handleOrderCreated`: bei `order.method === "cash"` → `setPendingCashOrder(order)`
   **und** `setOrdering(false)`.
2. Kommentar oben an der Funktion anpassen: Bar-Bestellung springt direkt zurück
   aufs Dashboard, der Register-Dialog liegt darüber.
3. Abbrechen im Dialog lässt die Bestellung wie bisher in der Bar-Warteschlange
   stehen — sie ist dann direkt auf dem Dashboard dahinter sichtbar.

## Echtzeit

Keine Änderung: es werden keine Mutationen, Routen oder Events angefasst. Die
bestehende `PATCH { action: "cash" }` beim Bestätigen bleibt unverändert.

## Akzeptanzkriterien

- Bar-Bestellung an der Kasse: Abrechnungs-Dialog über den Warteschlangen, kein
  grüner Bildschirm, keine Gast-Anweisung.
- Bestätigen: Dialog schließt, Bestellung ist in der Küche, Toast erscheint.
- Abbrechen: Dialog schließt, Bestellung steht in der Bar-Warteschlange.
- PayPal an der Kasse und der gesamte Terminal-Ablauf verhalten sich wie vorher.

## Checks

- `npm run lint`
- `npm run build`

## Manueller Test

1. `npm run dev`, `/kasse` öffnen.
2. "Bestellung aufnehmen" → Artikel wählen → Name → **Bar**.
3. Prüfen: Abrechnungs-Dialog, dahinter die Warteschlangen (kein Grün).
4. Betrag eingeben, "Bar kassiert" → Dialog zu, Bestellung erscheint auf `/kueche`.
5. Gleicher Ablauf mit **PayPal**: QR-Screen und danach der grüne Success-Screen
   erscheinen weiterhin.
6. Am Terminal (`/terminal`) eine Bar-Bestellung aufgeben: grüner Success-Screen
   mit "an der Kasse bezahlen" ist unverändert da.
