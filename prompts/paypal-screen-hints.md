# Prompt: PayPal-Screen — F&F-Hinweis + Verwendungszweck-Vorschlag

## Goal

Dem Gast auf dem PayPal-QR-Screen zwei Hinweise anzeigen, die er beim Bezahlen
selbst umsetzt (PayPal.Me kann beides NICHT per Link erzwingen/vorbefüllen):

1. Hinweis: **„An Freunde & Familie senden"** auswählen.
2. Ein **vorgeschlagener Verwendungszweck** zum Abtippen: `<Café-Name> – <Gastname>`
   (ohne Gastname nur `<Café-Name>`).

Trust-based, offline, keine PayPal-API (AGENTS.md §2, §12). Reine Anzeige.

## Existing code inspected

- `src/components/terminal/paypal-screen.tsx` — QR (`paypal.me/<handle>/<amount>`),
  Betragsanzeige, Instruktionstext, „Ich habe bezahlt". Bekommt aktuell nur
  `handle`, `totalCents`, `submitting`, `onPaid`, `onBack`.
- `src/components/terminal/order-flow.tsx` — hält `name` (Gastname, verfügbar am
  paypal-Step, Zeile ~48), rendert `<PaypalScreen …>` (Zeile ~160). Bekommt
  `paypalHandle`; **kein** `cafeName` bisher.
- `src/components/terminal/terminal-experience.tsx` — hat `cafeName`, gibt es
  aber nicht an `OrderFlow` weiter (Zeile ~44).
- `src/components/kasse/kasse-dashboard.tsx` — rendert `OrderFlow` (Zeile ~67),
  hat aktuell kein `cafeName`.
- `src/app/terminal/page.tsx` — `cafeName={settings.cafe_name ?? "Cafe Herzlich"}`.
- `src/app/kasse/page.tsx` — liest `settings`, gibt aber nur `paypalHandle` an
  `KasseDashboard`.
- `src/lib/messages.ts` — `terminalMessages.paypal.*` (title, instructions,
  amountLabel, paid, back).

## Decisions / assumptions (vom Nutzer bestätigt)

- Verwendungszweck-Format: **`<Café-Name> – <Gastname>`**; ohne Gastname nur
  `<Café-Name>`. Trenner: „ – " (Leerzeichen–Gedankenstrich–Leerzeichen).
  Bestellnummer NICHT enthalten (existiert vor „Ich habe bezahlt" noch nicht).
- **F&F-Hinweis anzeigen: ja.**
- PayPal.Me unterstützt weder F&F-Erzwingung noch Notiz-Prefill → beides bleibt
  reiner Anzeigetext, keine URL-Parameter.

## Files likely to change

- `src/components/terminal/paypal-screen.tsx` — neue Props `cafeName`,
  `guestName`; F&F-Hinweis + Verwendungszweck-Block rendern.
- `src/components/terminal/order-flow.tsx` — `cafeName` Prop annehmen und an
  `PaypalScreen` (mit `guestName={name}`) durchreichen.
- `src/components/terminal/terminal-experience.tsx` — `cafeName` an `OrderFlow`.
- `src/components/kasse/kasse-dashboard.tsx` — `cafeName` Prop + an `OrderFlow`.
- `src/app/kasse/page.tsx` — `cafeName={settings.cafe_name ?? "Cafe Herzlich"}`
  an `KasseDashboard`.
- `src/lib/messages.ts` — neue deutsche Keys unter `terminalMessages.paypal`.

## Implementation requirements

1. **Prop-Threading:** `cafeName: string` von `page → TerminalExperience /
   KassePage → KasseDashboard → OrderFlow → PaypalScreen`. `guestName` aus dem
   vorhandenen `name`-State in OrderFlow an PaypalScreen.

2. **Verwendungszweck bauen** (in PaypalScreen, reine Anzeige):
   ```ts
   const reference = guestName.trim()
     ? `${cafeName} – ${guestName.trim()}`
     : cafeName;
   ```

3. **UI (PaypalScreen):** Unter/neben QR + Betrag zwei klar getrennte Hinweise
   in der bestehenden zentrierten Spalte:
   - **F&F-Hinweis:** kurzer Satz (siehe messages), gut lesbar, nicht als Fehler.
   - **Verwendungszweck:** Label + der `reference`-Text in einem hervorgehobenen
     Feld (z. B. gerundeter Chip/Box `bg-stone-100`, gut ablesbar). Optional
     dezenter Zusatz „bitte als Verwendungszweck angeben".
   - Touch-tauglich, große Schrift, im Stil der bestehenden Komponente
     (stone/emerald-Palette, `rounded-3xl`, motion). Kein Layout-Bruch auf der
     iPad-Höhe; bei Bedarf Abstände/`gap` anpassen, Footer-Button sichtbar
     lassen. Impeccable-Skill für Hierarchie/Abstände beachten.

4. **Messages (messages.ts, `terminalMessages.paypal`):** neue Keys, 100 %
   Deutsch, z. B.:
   - `friendsFamily`: "Bitte **„An Freunde & Familie"** senden — so fallen keine
     Gebühren an."
   - `referenceLabel`: "Verwendungszweck"
   - `referenceHint`: "Bitte als Verwendungszweck angeben"
   (Markdown-Fettung nur, wenn simpel darstellbar; sonst Klartext.)

## Real-time / broadcast requirements

Keine. Reine Terminal-Anzeige, keine Mutation, kein Event.

## Acceptance criteria

- PayPal-Screen zeigt QR + Betrag (unverändert) + F&F-Hinweis + Verwendungszweck.
- Verwendungszweck = `<Café-Name> – <Gastname>`; ohne Gastname nur `<Café-Name>`.
- Funktioniert im Terminal UND in der Kasse (on-behalf), beide mit korrektem
  Café-Namen aus den Settings.
- Alle Strings deutsch, Code englisch, keine `any`.
- Footer-Button „Ich habe bezahlt" bleibt sichtbar/erreichbar.

## Checks to run

- `npm run lint`
- `npm run build`

## Manual test steps

1. `npm run dev` → `/terminal`. Bestellung, im Warenkorb **Namen eingeben**,
   PayPal wählen → Screen zeigt F&F-Hinweis + Verwendungszweck „Cafe Herzlich –
   <Name>".
2. Ohne Namen wiederholen → Verwendungszweck zeigt nur „Cafe Herzlich".
3. Café-Name im `/admin` ändern → am Terminal erscheint der neue Name im
   Verwendungszweck.
4. `/kasse` → „Bestellung aufnehmen" → PayPal → gleiche Hinweise sichtbar.
5. Layout auf iPad-Größe prüfen: nichts abgeschnitten, Button erreichbar.
