# Abholmonitor für Samsung Frame (Hochformat) — adaptiv

## Ziel

Den Abholmonitor (`/abholung`) so umbauen, dass er auf einem **Samsung Frame TV im
Hochformat** (43" oder 55", beide 4K/16:9 → gedreht **2160×3840**, 9:16) exzellent
aussieht und aus mehreren Metern lesbar ist — ohne die bestehende Querformat-Ansicht
zu verlieren.

Ergebnis: **ein** Layout, das seine Ausrichtung automatisch erkennt.
- **Hochformat (Frame):** vertikal gestapelt, **„Abholbereit" oben** (auf Augenhöhe), „In Zubereitung" darunter.
- **Querformat:** das bestehende Zwei-Spalten-Layout bleibt unverändert erhalten.

## Bestehender Code (inspiziert)

- `src/app/abholung/page.tsx` — Server Component, lädt `listOrders({ statuses: PICKUP_STATUSES })`
  + Settings, rendert `<PickupBoard>`. `dynamic = "force-dynamic"`.
- `src/components/abholung/pickup-board.tsx` — Client Component. Nutzt `useOrders("pickup", initialOrders)`
  (SSE). Teilt Orders in `inProgress` (`status === "in_kitchen"`, älteste zuerst) und
  `ready` (`status === "ready"`, zuletzt-fertig oben). Aktuell festes `grid grid-cols-2`.
  `Column`-Helfer + `MotionConfig reducedMotion="user"` + `LayoutGroup`.
- `src/components/abholung/pickup-order.tsx` — eine Kachel, `layoutId="pickup-order-<id>"`,
  animiert per Framer/Motion von „in Arbeit" in die grüne „fertig"-Spalte.
- `src/lib/messages.ts` → `pickupMessages`: `inProgress.heading = "In Zubereitung"`,
  `ready.heading = "Abholbereit"`, `empty`, `connectionLost`. **Kein neues Wording nötig**;
  falls doch, hier zentral ergänzen (nur Deutsch).
- Theming: `globals.css` hat `:root` + `.dark` (class-based dark mode). Fonts: Montserrat (sans).

## Entscheidungen / Annahmen

- **Ausrichtungserkennung per CSS** über Tailwinds `portrait:` / `landscape:` Varianten
  (`@media (orientation: …)`) — kein JS-Resize-Listener, kein Hydration-Flicker.
- Hochformat-Reihenfolge: **Abholbereit (grün) oben**, In Zubereitung unten (User bestätigt).
- **Mattes Frame-Panel:** kräftigerer Kontrast als der Theme-Default. Diese öffentliche
  TV-Fläche bekommt eine **feste, dunkle High-Contrast-Darstellung** (dunkler Hintergrund,
  leuchtend grüne „fertig"-Kacheln), unabhängig vom sonstigen Theme — reduziert Glare auf
  matt und lässt „fertig" knallen. Umsetzung: Wrapper der Seite mit `dark` + solidem Dark-BG
  (nicht `bg-muted/30`, das ist zu flau).
- **Safe-Margins gegen Overscan/Art-Mode-Rahmen:** großzügiges Padding, per Orientierung
  abgestuft (Hochformat mehr vertikaler Innenabstand).
- Kein Eingriff in Datenfluss/Status-Logik/Sortierung — nur Layout, Größen, Kontrast.

## Zu ändernde Dateien

- `src/components/abholung/pickup-board.tsx` — Kernumbau (adaptiver Container + Reihenfolge).
- `src/components/abholung/pickup-order.tsx` — Kachel-Größen pro Orientierung.
- `src/app/abholung/page.tsx` — Wrapper auf feste dunkle High-Contrast-Darstellung setzen
  (z. B. `className="dark"` am äußersten Element bzw. an `PickupBoard` durchreichen).
- `src/lib/messages.ts` — nur falls neue Copy gebraucht wird (voraussichtlich nicht).

## Umsetzungs-Anforderungen

1. **Adaptiver Container** in `PickupBoard`:
   - Landscape: bestehendes `grid grid-cols-2 gap-8 lg:gap-10` beibehalten, Reihenfolge
     wie bisher (In Zubereitung links, Abholbereit rechts).
   - Portrait: `flex flex-col`, **Abholbereit-Sektion zuerst (oben)**, dann In Zubereitung.
   - Beide Sektionen teilen sich die Höhe sinnvoll (`flex-1`, `min-h-0`), jede Sektion
     scrollt intern (`overflow-y-auto`) bei Überlauf. Die „Abholbereit"-Sektion darf im
     Hochformat etwas mehr Platz bekommen (z. B. großzügigerer Anteil), da sie priorisiert ist.
   - Umsetzung via `portrait:`/`landscape:`-Utilities auf **einem** Markup, nicht zwei
     dupliziert gerenderte Bäume (sonst brechen `layoutId`-Animationen). Reihenfolge im
     Hochformat über `order-*`-Utilities oder Flex `portrait:flex-col` + `order`.
2. **Typografie / Touch-Ziele → hier Distanz-Lesbarkeit:** Schriftgrößen für 2160×3840
   deutlich hochziehen. `clamp()`-Werte auf `vmin`/`vh` umstellen, damit sie im Hochformat
   (schmale Breite, große Höhe) nicht zu klein werden. Namen der Bestellungen sind das
   dominante Element — sehr groß, fett, `truncate`.
3. **Kontrast (mattes Panel):** dunkler Vollflächen-Hintergrund; „fertig"-Kacheln in
   sattem Emerald mit weißer Schrift; „in Arbeit"-Kacheln als klar abgesetzte Karten mit
   sichtbarem Rahmen. Kein zartes Grau-in-Grau.
4. **Safe-Margins:** äußeres Padding erhöhen (Hochformat vertikal spürbar), damit Kopf und
   letzte Zeile nicht am Overscan-Rand kleben.
5. **Animationen erhalten:** `layoutId`-Übergang von „in Arbeit" → „abholbereit" muss in
   **beiden** Ausrichtungen weiter flüssig laufen. `MotionConfig reducedMotion="user"`,
   `LayoutGroup`, `AnimatePresence mode="popLayout"` beibehalten.
6. **States:** Empty-State (`t.empty`) und Fehler-/Reconnect-Hinweis (`t.connectionLost`)
   bleiben funktional und im Hochformat lesbar/zentriert.
7. Kein `any`, getippt, kleine Funktionen. Deutsche Copy nur aus `messages.ts`.

## Echtzeit / Broadcast

- **Keine Änderung am Realtime-Pfad.** `useOrders("pickup", initialOrders)` (SSE) bleibt die
  einzige Datenquelle; keine neuen Fetches, keine Mutationen auf dieser Fläche (reines
  Read-/Anzeige-Surface). Live-Updates müssen weiterhin ohne Reload erscheinen — nur
  visuell verifizieren, dass „mark done" die Kachel weiterhin sofort nach grün/oben bewegt.

## Akzeptanzkriterien

- [ ] Im Hochformat (2160×3840): „Abholbereit" oben, „In Zubereitung" darunter, beide gut
      gefüllt lesbar aus ~3–4 m.
- [ ] Im Querformat: unverändert zwei Spalten wie zuvor.
- [ ] Übergang einer Bestellung von „in Arbeit" → „abholbereit" animiert in beiden
      Ausrichtungen flüssig (kein Sprung, kein doppeltes Element).
- [ ] Empty- und Connection-Lost-State in beiden Ausrichtungen korrekt.
- [ ] Hoher Kontrast, dunkler Hintergrund, leuchtende „fertig"-Kacheln.
- [ ] `npm run lint` sauber; `npm run build` erfolgreich.

## Checks

- `npm run lint`
- `npm run build`

## Manuelle Testschritte

1. `npm run dev`.
2. **Hochformat simulieren:** Browser-DevTools → Responsive-Modus auf **2160×3840** setzen
   (oder 1080×1920 für kleineren Screen, gleiches Seitenverhältnis) → `http://localhost:3000/abholung`.
   Prüfen: „Abholbereit" oben, große Schrift, dunkler Kontrast, sichere Ränder.
3. **Querformat gegenprüfen:** DevTools auf 3840×2160 → gleiche Route → zwei Spalten wie bisher.
4. **Live-Übergang testen:** zweites Tab `http://localhost:3000/kueche` (Küchenmonitor,
   ggf. Geräterolle via `/setup` setzen). Eine offene Bestellung auf **fertig** setzen →
   im `/abholung`-Tab muss sie **ohne Reload** sofort nach grün/oben wandern (animiert).
5. **Am Frame (LAN):** Frame in den Hochformat-Modus/gedrehte Wandmontage, Kiosk-Browser
   (bzw. das an den Frame angeschlossene Kiosk-Gerät) auf `http://<PI-IP>:3000/abholung`
   öffnen. Prüfen: keine abgeschnittenen Ränder (Overscan), Helligkeit ausreichend, Namen
   aus Distanz lesbar.
