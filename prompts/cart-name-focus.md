# Prompt: Namenseingabe im Warenkorb offensichtlich machen + iPad-Autofokus

## Ziel
Beim Öffnen des Warenkorbs (`/terminal` → Warenkorb, auch Kasse) ist heute nicht
erkennbar, dass der Name zwingend nötig ist, um weiterzukommen. Der
"Weiter zur Bezahlung"-Button ist stumm deaktiviert. Zusätzlich soll auf dem iPad
sofort das Tastaturfeld fokussiert sein.

## Inspizierter Code
- `src/components/terminal/cart-screen.tsx` — Warenkorb-UI; `Input` ohne Label,
  Hinweistext klein/grau; Continue-Button `disabled` bei leerem Namen ohne Erklärung.
- `src/components/terminal/order-flow.tsx` — hält `name`-State, rendert `CartScreen`.
- `src/lib/messages.ts` — `cart.*` Copy für `de` und `ru` (beide müssen gepflegt werden).

## Entscheidungen
- Name bleibt Pflichtfeld (bestehendes Verhalten, siehe `da251c7 Name - Pflichtfeld`).
- Das Namensfeld wird als eigene, hervorgehobene Karte über dem Footer dargestellt
  (nicht mehr als unscheinbarer Input am Ende der Liste): Label + „Pflicht"-Badge,
  Amber-Akzentrahmen, große Touch-Höhe (h-16).
- Solange kein Name eingegeben ist, zeigt der Continue-Button die Handlungsaufforderung
  („Bitte Namen eingeben") statt „Weiter zur Bezahlung" — er bleibt deaktiviert.
- Autofokus: `useLayoutEffect` beim Mount des CartScreen, `input.focus()`.
  Auf iOS/iPadOS öffnet sich die Tastatur nur innerhalb der User-Geste; da der
  Warenkorb per Tap geöffnet wird und React den Commit für diskrete Events synchron
  flusht, ist das der bestmögliche Weg. Kein `setTimeout`-Hack, kein Fake-Input.
  Autofokus nur beim ersten Mount (nicht bei jedem Re-Render).
- Keine Änderung an Validierung/Server, nur UI-Klarheit.

## Dateien
- `src/components/terminal/cart-screen.tsx`
- `src/lib/messages.ts` (`cart.nameLabel`, `cart.nameRequired`, `cart.continueNeedsName` in `de` + `ru`)

## Umsetzung
1. Messages ergänzen (beide Locales):
   - `nameLabel`: „Dein Name" / „Ваше имя"
   - `nameRequired`: „Pflichtfeld" / „Обязательно"
   - `continueNeedsName`: „Bitte Namen eingeben" / „Пожалуйста, введите имя"
   - `nameHint` bleibt als Erklärung (Abholmonitor).
2. `CartScreen`:
   - `useRef<HTMLInputElement>` + `useLayoutEffect(() => ref.current?.focus(), [])`.
   - Namensblock als Karte: `rounded-2xl border-2 border-amber-300 bg-white p-4`,
     Kopfzeile mit Label (font-semibold) + Pflicht-Badge (`bg-amber-100 text-amber-800`),
     Input `h-16 text-lg`, `autoComplete="name"`, `enterKeyHint="done"`,
     `aria-required`, Hinweistext darunter.
   - Der Block wandert ans Ende des scrollbaren Bereichs, bleibt aber optisch
     als Pflichtschritt erkennbar; bei leerem Namen leichte Betonung
     (Rahmen amber-400), bei ausgefülltem Namen ruhiger (border-stone-200).
   - Button-Label: `name.trim() ? t.cart.continue : t.cart.continueNeedsName`.
3. Kein Echtzeit-/Broadcast-Anteil — reine Client-UI.

## Akzeptanzkriterien
- Warenkorb öffnen → Namensfeld ist sofort sichtbar hervorgehoben und fokussiert;
  auf dem iPad erscheint die Tastatur ohne zusätzlichen Tap.
- Ohne Namen zeigt der Button „Bitte Namen eingeben" und ist deaktiviert.
- Mit Namen wechselt der Button zu „Weiter zur Bezahlung" und ist aktiv.
- Russische Oberfläche zeigt die neuen Texte auf Russisch.
- Kasse (`/kasse`, gleiche `OrderFlow`) verhält sich identisch.

## Checks
- `npm run lint`
- `npm run build`

## Manuelle Tests
1. `npm run dev`, vom iPad im LAN `http://<pi-ip>:3000/terminal` öffnen.
2. Artikel hinzufügen → Warenkorb antippen → Tastatur muss offen und Cursor im Namensfeld sein.
3. Button-Text ohne/mit Name prüfen.
4. Sprache auf Russisch umschalten, Schritte 2–3 wiederholen.
5. `http://<pi-ip>:3000/kasse` → Bestellung aufnehmen → gleiche Prüfung.
