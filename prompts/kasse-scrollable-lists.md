# Kasse: unabhängig scrollbare Bestell-Listen

## Ziel
Auf `/kasse` soll die Seite selbst nicht mehr wachsen/scrollen, wenn viele
Bestellungen anfallen. Stattdessen bleibt das Layout auf Viewport-Höhe fixiert
und **jede der beiden Spalten** (Bar-Warteschlange, Abholbereit) scrollt intern
für sich in einem eigenen scrollbaren Bereich. Der Header bleibt immer sichtbar.

## Inspizierter Code
- `src/components/kasse/kasse-dashboard.tsx` — Root ist aktuell `min-h-dvh`
  (wächst mit Inhalt), `main` ist ein `grid` mit zwei `<section>`. Die `<ul>`-
  Kachellisten haben keinen eigenen Scroll-Container, daher scrollt die ganze
  Seite.
- Header ist bereits `sticky top-0`.

## Entscheidungen / Annahmen
- Nur `kasse-dashboard.tsx` wird angefasst — reine Layout-/Klassen-Änderung,
  keine Logik, keine neuen Komponenten.
- Kein Eingriff in die On-Behalf-`OrderFlow`-Ansicht (die übernimmt weiterhin
  den ganzen Screen).
- Native Scroll (`overflow-y-auto`) genügt für Touch; kein zusätzliches
  ScrollArea-Package nötig.

## Umsetzung
1. Root-`div`: `min-h-dvh` → `flex h-dvh flex-col` (feste Viewport-Höhe).
2. Header bleibt wie er ist (nun als flex-child, nicht mehr sticky nötig —
   `sticky top-0` kann bleiben, schadet nicht).
3. `main`: zusätzlich `min-h-0 flex-1 overflow-hidden`, damit es den Restplatz
   füllt und selbst nicht überläuft.
4. Jede `<section>` behält `flex min-h-0 flex-col`; deren `<header>` bleibt fix.
5. Der scrollbare Teil pro Spalte: den Inhaltsbereich (die `<ul>` bzw. den
   Empty-State) in einen Wrapper `flex-1 min-h-0 overflow-y-auto` setzen —
   oder `overflow-y-auto` direkt an die `<ul>` geben und ein leichtes
   `-mr-2 pr-2` gegen abgeschnittene Fokus-Ringe/Scrollbar-Überlappung.

## Echtzeit / Broadcast
- Keine Änderung: SSE/`useOrders` bleiben unberührt.

## Akzeptanzkriterien
- Bei vielen Bar- bzw. Abholbereit-Bestellungen scrollt **nur** die jeweilige
  Spalte; Header und Seitenrahmen bleiben stehen.
- Bei wenigen Bestellungen sieht es unverändert aus (kein unnötiger Scrollbalken).
- Layout bleibt auf `lg` zweispaltig, auf klein einspaltig; beide Spalten teilen
  sich die Höhe sauber.

## Checks
- `npm run lint`

## Manueller Test
- `npm run dev`, `/kasse` öffnen (bzw. vom LAN-Gerät über Pi-IP).
- Über „Neue Bestellung“ mehrere Bar-Bestellungen anlegen, bis die Liste die
  Höhe übersteigt → nur die Bar-Spalte scrollt, Header bleibt fix.
