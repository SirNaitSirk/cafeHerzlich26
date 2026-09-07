# Kasse: Kassieren-Dialog direkt nach einer Bar-Bestellung an der Kasse

## Goal

Wenn Personal an der Kasse eine Bestellung **für einen Gast aufnimmt** und der Gast **bar** zahlt,
soll sofort nach dem Absenden der Bestellung der **Kassieren-Dialog** (Betrag erhalten / Rückgeld /
"Kassiert") erscheinen — mit dem Betrag der gerade erstellten Bestellung. Heute landet die Bestellung
nur still in der Warteschlange "Offene Barzahlungen"; das Personal muss sie dort selbst wiederfinden
und rechnet das Rückgeld im Kopf.

PayPal-Bestellungen an der Kasse bleiben unverändert (QR-Screen → "Ich habe bezahlt" → Erfolgsscreen).
Der Terminal-Flow (`source: "terminal"`) bleibt vollständig unverändert.

## Existing code inspected

- `src/components/kasse/kasse-dashboard.tsx` — mountet `OrderFlow` mit `source="kasse"` als Vollbild,
  `onComplete`/`onExit` schließen den Flow. `patchOrder(id, "cash", …)` (PATCH `/api/orders/:id`,
  `{ action: "cash" }`) gibt die Bestellung an die Küche frei.
- `src/components/kasse/cash-order-card.tsx` — öffnet heute als einzige Stelle
  `CashRegisterDialog`; `handleConfirm` ruft `onConfirm(order.id)` und schließt bei Erfolg.
- `src/components/kasse/cash-register-dialog.tsx` — Keypad + Rückgeld-Anzeige. Nutzt vom `order`-Prop
  ausschließlich `totalCents` sowie `guestName`/`orderNumber` (über `orderDisplayLabel`), obwohl der
  Prop-Typ `OrderWithItems` verlangt.
- `src/components/terminal/order-flow.tsx` — `submitOrder(method)` POSTet `/api/orders` und erhält
  `{ id, orderNumber, totalCents }` (siehe `CreateOrderResult` in `src/lib/orders.ts`); danach
  `setStep("success")`. Der Flow kennt seine Quelle über `source`.
- `src/lib/messages.ts` — `kasseMessages.cash.dialog.*`, `kasseMessages.toasts.cashSuccess`.

## Decisions / assumptions

1. **Kein neuer Endpunkt.** Die Bestellung wird wie bisher mit `paymentMethod: "cash"` angelegt
   (Status `awaiting_cash`) und anschließend über den bestehenden PATCH `{ action: "cash" }`
   freigegeben. Bricht das Personal den Dialog ab, bleibt die Bestellung ganz normal in der
   Barzahlungs-Warteschlange — nichts geht verloren.
2. **Der Dialog gehört dem Kasse-Dashboard**, nicht dem `OrderFlow`. `OrderFlow` bekommt lediglich
   einen optionalen Callback `onOrderCreated(result)`; das hält die Terminal-Nutzung unberührt und
   den Flow frei von Kassen-Logik.
3. **Der Erfolgsscreen bleibt.** Der Dialog legt sich darüber; nach "Kassiert" wird der Dialog
   geschlossen und der Bestell-Flow beendet (zurück zum Kassen-Dashboard). Der Erfolgsscreen läuft
   sonst nach 6 s ohnehin automatisch zurück — der Dialog wird im Dashboard (außerhalb des Flows)
   gerendert und überlebt das.
4. **`CashRegisterDialog` wird auf ein Minimal-Prop entkoppelt**
   (`{ id?, orderNumber, guestName, totalCents }`), damit er sowohl mit `OrderWithItems` als auch mit
   dem `CreateOrderResult` + Gastname aus dem Flow funktioniert. Keine Änderung am Aussehen.

## Files likely to change

- `src/components/terminal/order-flow.tsx` — optionaler Prop `onOrderCreated?: (order: CreatedOrder) => void`,
  aufgerufen nach erfolgreichem POST (mit `id`, `orderNumber`, `totalCents`, `guestName`, `method`).
- `src/components/kasse/kasse-dashboard.tsx` — State `pendingCashOrder`, `OrderFlow`-Callback,
  Rendern des `CashRegisterDialog` in beiden Render-Zweigen (Flow aktiv / Dashboard), Confirm-Handler.
- `src/components/kasse/cash-register-dialog.tsx` — Prop-Typ lockern (`CashRegisterOrder`).
- `src/components/kasse/cash-order-card.tsx` — unverändert, außer der Typ passt weiterhin.
- ggf. `src/lib/messages.ts` — nur falls ein zusätzlicher Text nötig wird (voraussichtlich nicht).

## Implementation requirements

- `OrderFlow` ruft `onOrderCreated` **nach** erfolgreichem POST und **vor/parallel zu**
  `setStep("success")` auf; ohne den Prop verhält er sich exakt wie heute (Terminal).
- Das Kasse-Dashboard öffnet den Dialog nur, wenn `method === "cash"`.
- "Kassiert" im Dialog ruft den bestehenden `confirmCash(id)` auf; bei Erfolg: Dialog zu, Flow
  beenden (`setOrdering(false)`), bestehender Toast `cashSuccess`.
- "Abbrechen": Dialog zu, Bestellung bleibt in der Warteschlange; der Flow läuft normal weiter/zurück.
- Fehlerfall (PATCH schlägt fehl / 409): bestehender Toast, Dialog bleibt offen, Buttons wieder aktiv.
- TypeScript sauber, keine `any`, deutsche UI-Texte nur aus `messages.ts`.

## Real-time / broadcast requirements

Keine neuen Events: POST `/api/orders` und PATCH `/api/orders/:id` broadcasten bereits
`orders:changed` bzw. `catalog:changed`. Wichtig ist nur, dass die Bestellung bei Abbruch weiterhin
über `useOrders("cash", …)` live in der Warteschlange auftaucht.

## Acceptance criteria

1. Kasse → "Neue Bestellung" → Artikel wählen → Name → "Bar bezahlen" ⇒ der Kassieren-Dialog
   erscheint sofort mit dem korrekten Betrag und dem Bestell-Label.
2. Betrag eintippen ⇒ Rückgeld wird live berechnet (wie bei bestehenden Bar-Bestellungen).
3. "Kassiert" ⇒ Bestellung erscheint auf dem Küchenmonitor, verschwindet aus der Kassen-Warteschlange,
   Dashboard ist wieder sichtbar.
4. "Abbrechen" ⇒ Bestellung liegt in "Offene Barzahlungen" und kann dort wie gewohnt kassiert werden.
5. Kasse + PayPal ⇒ unverändert, kein Dialog.
6. Terminal (Bar und PayPal) ⇒ unverändert.

## Checks to run

- `npm run lint`
- `npm run build`

## Manual test steps

1. `npm run dev`, am Kassen-Gerät (Rolle `kasse`) `http://<pi-ip>:3000/kasse` öffnen.
2. Zweites Fenster/Gerät: `http://<pi-ip>:3000/kueche` (Küchenmonitor) offen halten.
3. Kasse: "Neue Bestellung" → Artikel → Name → "Bar bezahlen".
4. Prüfen: Kassieren-Dialog erscheint. 20,00 € eingeben, Rückgeld prüfen, "Kassiert".
5. Prüfen: Bestellung erscheint sofort auf `/kueche`, Kassen-Warteschlange ist leer.
6. Wiederholen und im Dialog "Abbrechen" → Bestellung steht unter "Offene Barzahlungen".
7. Gegenprobe Terminal: `http://<pi-ip>:3000/terminal`, Bar-Bestellung → unverändert Erfolgsscreen,
   Bestellung landet in der Kassen-Warteschlange.

## Nachtrag (Fix nach dem ersten Test)

Der Dialog erschien, ließ sich aber nicht abschließen: `initialStatus()` in `src/lib/orders.ts`
setzte eine **Bar-Bestellung mit `source: "kasse"` sofort auf `in_kitchen`** (Annahme: das Geld wird
im selben Moment am Tresen kassiert). Damit war die Bestellung schon in Zubereitung und der PATCH
`{ action: "cash" }` scheiterte an `OrderTransitionError` (409, Toast "nicht mehr offen").

Fix: `initialStatus()` hängt nur noch von der Zahlungsart ab — **jede** Bar-Bestellung startet in
`awaiting_cash`, egal ob Terminal oder Kasse. Freigegeben wird sie ausschließlich über
`confirmCashCollected` (Kassieren-Dialog bzw. Warteschlange), das auch `paidConfirmedAt` stempelt.
Folge: bricht das Personal den Dialog ab, liegt die Bestellung in "Offene Barzahlungen" statt
unbezahlt in der Küche — das ist das gewünschte Verhalten.
