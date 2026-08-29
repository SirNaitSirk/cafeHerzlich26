# Kasse: Eigener Ziffernblock im Kassier-Dialog (iPad-Querformat-Fix)

## Ziel

Im Kassier-Dialog (`CashRegisterDialog`) den Betrag „Erhalten" über einen
**eigenen On-Screen-Ziffernblock** eingeben, statt die iOS-System-Tastatur zu
öffnen. Damit wird nichts mehr verdeckt: Auf dem iPad im Querformat schob die
System-Tastatur bisher über die untere Dialoghälfte und verdeckte
Rückgeld-Anzeige und „Kassiert"-Button, sodass der Vorgang nicht abschließbar war.

## Ursache (inspiziert)

- `src/components/kasse/cash-register-dialog.tsx`
  - `<Input autoFocus inputMode="decimal">` → beim Öffnen springt sofort die
    iOS-System-Tastatur hoch.
- `src/components/ui/dialog.tsx`
  - `DialogContent` ist vertikal zentriert (`top-1/2 -translate-y-1/2`). Im
    Querformat ist der Bereich über der Tastatur flach → untere Dialoghälfte
    (Rückgeld + Footer-Buttons) liegt hinter der Tastatur.

## Entscheidung

Gewählter Ansatz (mit User abgestimmt): **eigener Ziffernblock im Dialog**.
Die System-Tastatur wird komplett unterdrückt; Eingabe erfolgt ausschließlich
über große Touch-Buttons. Das ist kiosk-typisch, robust im Querformat und bietet
größere Touch-Targets.

## Dateien, die sich ändern

- `src/components/kasse/cash-register-dialog.tsx` — Input auf Anzeige-Feld
  umstellen, Ziffernblock ergänzen, Layout an flache Querformat-Höhe anpassen.
- `src/lib/messages.ts` — evtl. Label für „Löschen"/„Zurück"-Taste (nur falls
  Text nötig; ein `⌫`-Icon braucht keinen String). Keine unnötigen Keys.

Kein neuer API-/DB-/Event-Code. Der Bestätigen-Pfad (`onConfirm`, PATCH
`{ action: "cash" }`) bleibt unverändert — nur die Betragseingabe ändert sich.

## Implementierungsanforderungen

1. **Keine System-Tastatur mehr.**
   - Das „Erhalten"-Feld wird zu einem reinen Anzeige-Feld: `readOnly`,
     `inputMode="none"`, **kein** `autoFocus`. Es darf beim Tippen keine
     OS-Tastatur öffnen (readOnly reicht auf iOS; zusätzlich `inputMode="none"`).
   - Alternativ ein `<div role="textbox">`/Anzeige-Element statt `<Input>` —
     Hauptsache: kein Fokus, der die Tastatur triggert. Bevorzugt weiter das
     vorhandene `Input`-Styling nutzen, damit die Optik konsistent bleibt.

2. **Ziffernblock (Client-Logik, in derselben Datei).**
   - Tasten: `1 2 3 / 4 5 6 / 7 8 9 / , 0 ⌫` (3×4-Grid, `⌫` = letzte Stelle
     löschen).
   - Eingabe-Regeln (an bestehende `parseEurosToCents`-Semantik angelehnt):
     - Max. **eine** Komma-Stelle; nach dem Komma max. **2** Nachkommastellen.
     - Führende Nullen sinnvoll behandeln (z. B. `0` dann `5` → `5`, aber `0`
       dann `,` → `0,`). Kein leeres/kaputtes Zwischenformat, das
       `parseEurosToCents` auf `null` wirft, während sichtbar Ziffern stehen.
     - `⌫` entfernt genau ein Zeichen; leerer String zeigt Placeholder `0,00`.
   - Die bestehenden Schnellwahl-Chips („Passend" + Nennwerte) bleiben und
     setzen den Text wie bisher.
   - `receivedCents` / `changeCents` weiter aus dem Textwert ableiten
     (vorhandene `parseEurosToCents` wiederverwenden, nicht duplizieren).

3. **Layout für flaches Querformat.**
   - Dialog muss auf iPad-Querformat ( nutzbare Höhe ~700–820 px, ohne
     System-Tastatur nun voll verfügbar) komplett sichtbar sein.
   - Falls die Höhe knapp wird: `DialogContent` mit `max-h-[…]` +
     `overflow-y-auto` absichern, ODER Ziffernblock und Rückgeld/Buttons in ein
     zweispaltiges Layout ab `sm:`/Querformat legen (Zahlenpad links,
     Rückgeld + Aktion rechts — siehe Mock in der Chat-Frage).
   - „Kassiert"-Button und Rückgeld-Zeile müssen **immer ohne Scrollen**
     erreichbar sein.
   - Touch-Targets der Zifferntasten: mind. `h-14` (≥ 56 px), gut lesbar
     (`text-2xl tabular-nums`).

4. **Reset-Verhalten** wie bisher: beim (erneuten) Öffnen `receivedText`
   zurücksetzen (bestehende adjust-state-during-render-Logik beibehalten).

5. **Sprache/Code-Konventionen:** UI-Strings deutsch, aus `messages.ts`.
   Code englisch. Money bleibt integer cents. Keine `any`, kleine typisierte
   Funktionen. Keine unrelated Refactors.

## Real-time / Broadcast

Unverändert — reine Client-UI-Änderung. `onConfirm` löst weiterhin die
bestehende Mutation samt Broadcast aus. Keine neue Event-Logik.

## Akzeptanzkriterien

- Öffnen des Kassier-Dialogs blendet **keine** iOS-System-Tastatur ein.
- Betrag lässt sich vollständig über den Ziffernblock eingeben (inkl. Komma,
  Nachkommastellen, Löschen).
- Rückgeld-Anzeige aktualisiert live und korrekt (grün = Rückgeld, rot =
  fehlt, neutral = passend/leer) — Logik identisch zu vorher.
- Auf iPad-Querformat sind Rückgeld-Zeile und „Kassiert"-Button jederzeit
  sichtbar und bedienbar, ohne Verdeckung, ohne Scrollen.
- Schnellwahl-Chips funktionieren weiter.
- Bestätigen kassiert die Bestellung wie zuvor (Status → in_kitchen, Toast).

## Checks

- `npm run lint`
- `npm run build`

## Manuelle Testschritte

1. `npm run dev`, Kasse öffnen: `http://<Pi-IP>:3000/kasse` (Gerät mit Kasse-Rolle).
2. Auf einem iPad **im Querformat** im Kiosk-Browser öffnen (oder Desktop-Browser
   im iPad-Querformat-Simulator, z. B. 1080×810).
3. Bei einer offenen Barzahlung „Kassieren" tippen → Dialog öffnet, **keine**
   System-Tastatur erscheint.
4. Über den Ziffernblock z. B. `10,00` eingeben → Rückgeld erscheint grün,
   korrekt berechnet. `⌫` testen, Komma-Regeln testen (`,` nur einmal, max. 2
   Nachkommastellen).
5. Prüfen: „Kassiert"-Button und Rückgeld sind sichtbar/erreichbar, nichts
   verdeckt.
6. „Kassiert" → Bestellung verschwindet aus der Barzahlungs-Liste und erscheint
   in der Küche (`/kueche`), Toast „Bestellung an die Küche übergeben."
7. Schnellwahl-Chips (Passend / Nennwerte) gegenprüfen.
