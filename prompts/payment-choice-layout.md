# Prompt: Bezahl-Kacheln (Bar / PayPal) sauberes Layout

## Ziel

Im Bestellterminal-Bezahlvorgang (`/terminal`, Schritt „payment") sehen die beiden
Auswahl-Kacheln **Bar** und **PayPal** unschön aus: Sie werden über die **gesamte
verfügbare Bildschirmhöhe** vom Header bis zum unteren Rand auseinandergezogen und
wirken dadurch wie überlange, leere Spalten. Ziel ist ein ruhiges, ausgewogenes
Layout mit natürlich proportionierten Kacheln, die vertikal zentriert stehen.

Rein visuell/Layout — **keine** Änderung an Logik, Datenfluss, Zahlungsmethoden,
Messages oder dem Order-Flow.

## Untersuchter Code

- [src/components/terminal/payment-choice.tsx](src/components/terminal/payment-choice.tsx)
  - Root: `flex h-dvh w-full max-w-2xl flex-col`.
  - Kachel-Grid (Zeile 57): `grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2`.
    → Das `flex-1` ist die Ursache: das Grid füllt die gesamte Resthöhe, also
      strecken sich die beiden `motion.button`-Kacheln vertikal maximal.
  - Kacheln (Zeile 59–72): `flex flex-col items-center justify-center gap-4
    rounded-3xl border border-amber-100 bg-white p-8 …`.
- Eingebettet in [src/components/terminal/order-flow.tsx](src/components/terminal/order-flow.tsx#L154)
  (Schritt `payment`, `<PaymentChoice />`). Kein umschließender Höhen-Zwang außer
  dem eigenen `h-dvh`.
- Andere Terminal-Screens (`menu-screen.tsx`, `cart-screen.tsx`) als Stil-Referenz
  für Kartenoptik/Rundungen/Amber-Palette beibehalten — konsistent bleiben.

## Entscheidungen / Annahmen

- Die Kacheln sollen **nicht** die volle Höhe füllen. Stattdessen erhalten sie eine
  natürliche, moderate Höhe und werden im verfügbaren Raum **vertikal zentriert**.
- Auf breiten Terminals stehen die zwei Kacheln nebeneinander (`sm:grid-cols-2`),
  auf schmalen untereinander — dieses Verhalten bleibt.
- Touch-Tauglichkeit bleibt Pflicht: große Trefferflächen, aber ausgewogene Höhe
  (kein Voll-Screen-Stretch). Ziel-Kachelhöhe ca. 220–320 px, quadratisch-ish.
- Bestehende Amber/Stone-Palette, `rounded-3xl`, Icon-Kreis und `whileTap`-Feedback
  bleiben erhalten.

## Umzusetzen

In [payment-choice.tsx](src/components/terminal/payment-choice.tsx):

1. **Grid nicht mehr full-height strecken.** Das `flex-1` am Grid-Container so
   ersetzen, dass die Kacheln nicht mehr über die ganze Höhe gezogen werden:
   - Den Rest-Raum weiterhin per `flex-1` einnehmen, aber den Inhalt darin
     **vertikal zentrieren** (z. B. Wrapper `flex flex-1 items-center` und darin
     das Grid ohne eigenes `flex-1`), **oder** das Grid behält `flex-1`, aber die
     Kacheln bekommen eine feste/max. Höhe (`items-*`/`self-*` + `max-h`), sodass
     sie nicht mitwachsen. Bevorzugt: zentrierter Wrapper + natürliche Kachelhöhe.
2. **Kacheln proportionieren.** Den Kacheln eine ausgewogene Höhe geben statt
   `justify-center` in unbegrenzter Höhe — z. B. `aspect-square` oder eine
   `min-h`/`max-h` im Bereich ~220–320 px, so dass Bar- und PayPal-Kachel gleich
   groß und angenehm kompakt wirken.
3. Innenabstände (`p-8`), Icon-Kreis, Typo-Hierarchie (Label `text-xl`, Hint
   `text-sm`) beibehalten; nur so anpassen, dass es in der neuen Höhe stimmig sitzt.
4. Header, Zurück-Button, Gesamtsumme-Zeile und deren Abstände unverändert lassen.
5. Keine neuen Dependencies, keine Änderung an Props, Typen, Messages oder Icons.

## Real-time / Broadcast

Nicht betroffen — reine Präsentationskomponente, keine Mutation, kein Event-Bus.

## Akzeptanzkriterien

- Die beiden Kacheln sind **nicht** mehr über die gesamte Bildschirmhöhe gestreckt,
  sondern kompakt und ausgewogen proportioniert.
- Kacheln stehen im verfügbaren Bereich vertikal zentriert; beide gleich groß.
- Nebeneinander auf breiten, untereinander auf schmalen Screens (unverändertes
  Breakpoint-Verhalten).
- Touch-Targets bleiben groß und gut tippbar; `whileTap`-Feedback funktioniert.
- `disabled`-Zustand (PayPal nicht verfügbar) sieht weiterhin korrekt aus
  (opacity, not-allowed).
- Optik konsistent mit den übrigen Terminal-Screens (Amber/Stone, `rounded-3xl`).

## Checks

- `npm run lint`
- `npm run build` (Layout-only, sollte grün bleiben)

## Manueller Test

1. `npm run dev`, im Browser `http://localhost:3000/terminal` öffnen (bzw. von
   einem iPad im LAN `http://<Pi-IP>:3000/terminal`).
2. Attract-Screen antippen → Kategorie/Produkt wählen → in den Warenkorb → weiter
   zum Bezahlen.
3. Prüfen: Die Kacheln **Bar** und **PayPal** sind kompakt/zentriert, nicht
   vertikal überdehnt.
4. Fenster/Viewport schmal ziehen (Hochformat iPad): Kacheln stapeln sich sauber
   untereinander, ohne Stretch.
5. Falls kein PayPal-Handle in den Settings gesetzt ist: PayPal-Kachel ist korrekt
   ausgegraut/deaktiviert.
