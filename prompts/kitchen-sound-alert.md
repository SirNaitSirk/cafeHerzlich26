# Küchenmonitor – Ton bei neuer Bestellung

## Ziel

Der Küchenmonitor (`/kueche`) spielt einen kurzen, unaufdringlichen Signalton, sobald
eine **neue Bestellung** in die Küchen-Warteschlange eintritt. Im Betrieb reicht die rein
visuelle Anzeige nicht immer – ein Ton macht neue Aufträge zuverlässig bemerkbar, auch
wenn niemand direkt auf den Bildschirm schaut.

Ergänzt wird ein **Ton-an/aus-Schalter** in der Kopfzeile, der zugleich die vom Browser
verlangte Nutzer-Geste liefert (Autoplay-Freigabe) und die Präferenz merkt.

## Bestehender Code (inspiziert)

- `src/components/kueche/kitchen-monitor.tsx` – Client-Komponente, hält die Live-Liste über
  `useOrders("kitchen", initialOrders)`. Kopfzeile enthält bereits Verbindungsstatus,
  offene-Anzahl-Badge und den „Verlauf"-Button.
- `src/hooks/use-orders.ts` – `useOrders(scope, initial)` seedet aus SSR-Daten und **refetcht
  die komplette Liste** bei jedem `orders:changed`-Signal. Liefert `{ orders, hasError }`.
- `src/hooks/use-event-stream.ts` – SSE-Abo; Events sind reine **Signale**, keine Payloads.
- `src/lib/events.ts` – In-Process-Bus, Events `orders:changed` / `catalog:changed`.
- `src/lib/orders.ts` – `OrderWithItems = Order & { items: … }`; jede Order hat eine stabile
  numerische `id`.
- `src/lib/messages.ts` – `kitchenMessages` (ab Zeile 180) ist der zentrale deutsche
  Copy-Block für die Küche.
- `public/` – nur SVGs, kein `sounds/`-Ordner bisher.

## Entscheidungen / Annahmen

- **Auslöser:** Ein Ton erklingt, wenn in der Küchen-Liste eine **Order-`id` erscheint, die
  vorher nicht da war**. Das deckt beide Wege ab, auf denen eine Bestellung neu in die Küche
  kommt (PayPal bestätigt bzw. Kasse „kassiert") – genau das, was die Küche hören soll.
  Änderungen an bestehenden Orders (Edit, Mengenänderung) lösen **keinen** Ton aus.
- **Kein initialer Ton:** Beim ersten Mount werden die vorhandenen `id`s als „bekannt"
  geseedet, ohne zu klingeln. Auch nach SSE-Reconnect entsteht kein Fehl-Ton, weil bereits
  bekannte `id`s nicht erneut auslösen.
- **Ton offline & ohne Binärdatei:** Der Ton wird per **Web Audio API** synthetisiert (kurzer,
  weicher Zwei-Ton-Chime). Das braucht **keine** gebundelte Audiodatei, funktioniert garantiert
  offline auf dem Pi und bleibt versionierbar im Code. (Kein externer CDN, kein Runtime-Fetch –
  konform zu AGENTS.md §11.)
- **Autoplay-Freigabe:** Browser blockieren Audio bis zur ersten Nutzer-Geste. Der Ton-Schalter
  in der Kopfzeile dient als diese Geste: beim ersten Tap wird der `AudioContext` entsperrt
  (`resume()`), danach kann auch ohne weitere Interaktion geklingelt werden.
- **Präferenz merken:** An/aus wird in `localStorage` (`kueche:sound`) gespeichert, Default
  **an**. Ein stummgeschalteter Monitor spielt nichts, zeigt aber weiter alles visuell.
- **Nur diese Surface:** Ausschließlich Küchenmonitor. Abholmonitor/Kasse bleiben unverändert.

## Voraussichtlich geänderte / neue Dateien

- **Neu** `src/lib/sound.ts` – kleiner, framework-freier Chime-Player auf Web-Audio-Basis:
  lazy erzeugter (Singleton-)`AudioContext`, `unlockAudio()` (`resume()` nach Geste) und
  `playNewOrderChime()` (zwei kurze Oszillator-Töne mit sanfter Gain-Hüllkurve). `"use client"`
  bzw. rein clientseitig; defensiv gegen fehlendes `window`/`AudioContext`.
- **Neu** `src/hooks/use-order-chime.ts` – Hook `useOrderChime(orders, enabled)`:
  hält die bekannten `id`s in einem `Set` (per `ref`), seedet beim ersten Lauf ohne Ton, und
  ruft bei neu hinzugekommenen `id`s `playNewOrderChime()` auf, sofern `enabled`. Aktualisiert
  das Set anschließend (inkl. Entfernen abgeschlossener Orders, damit das Set nicht wächst).
- `src/components/kueche/kitchen-monitor.tsx` – Ton-Schalter (Button mit `Volume2` /
  `VolumeOff` aus `lucide-react`) in die Kopfzeile neben „Verlauf"; lokaler `enabled`-State aus
  `localStorage`; `useOrderChime(orders, enabled)` einhängen; Klick toggelt `enabled`, ruft beim
  Einschalten `unlockAudio()` und spielt einmalig einen Test-Chime als Bestätigung.
- `src/lib/messages.ts` – in `kitchenMessages` neue Copy: `sound.on` („Ton an"),
  `sound.off` („Ton aus"), ggf. `sound.enabledToast` / `sound.disabledToast`.

## Umsetzungsanforderungen

- **Erkennung im Hook, nicht in der Komponente** – KitchenMonitor bleibt schlank. Der Hook
  bekommt die bereits gefetchte `orders`-Liste und leitet daraus „neu" ab; **kein** zusätzlicher
  Fetch, **kein** eigenes SSE-Abo (die Liste kommt schon live über `useOrders`).
- **Idempotent / kein Doppelton:** Mehrere neue Orders in einem Refetch lösen **einen** Ton aus
  (nicht pro Order einen). `id`-Set sauber pflegen.
- **Robust bei Autoplay-Block:** Schlägt `play` fehl (kein Unlock), leise abfangen – kein Crash,
  kein Error-Toast-Spam.
- **Typisiert, klein, English-only im Code.** Deutsche Strings ausschließlich über
  `kitchenMessages`. Keine `any`. Konstanten (Frequenzen, Dauer, `localStorage`-Key) benannt.
- **Kein Autoplay auf dem Server:** `sound.ts`/Hook rein clientseitig, SSR-sicher
  (kein Zugriff auf `window`/`AudioContext` außerhalb von Effekten/Handlern).

## Echtzeit / Broadcast

- Keine neue serverseitige Logik nötig. Der Ton reagiert auf die **bereits vorhandene**
  `orders:changed`-getriebene Live-Liste. Es wird **kein** neuer Event-Typ und **keine** neue
  Route eingeführt – die Erkennung passiert clientseitig aus dem Diff der Order-`id`s.

## Akzeptanzkriterien

1. Kommt eine neue Bestellung in die Küche (PayPal bestätigt oder Kasse kassiert), erklingt auf
   dem Küchenmonitor **einmal** ein kurzer Ton – ohne Refresh, live.
2. Edit/Löschen/„Erledigt" an bestehenden Orders löst **keinen** Ton aus.
3. Beim Laden/Refresh des Monitors klingelt es **nicht** für bereits offene Orders.
4. Der Ton-Schalter in der Kopfzeile schaltet hörbar an/aus; der Zustand überlebt einen Reload
   (`localStorage`).
5. Erststart im Kiosk: nach einmaligem Tap auf den Schalter funktioniert der Ton (Autoplay-Freigabe).
6. App funktioniert vollständig offline – kein Runtime-Fetch/CDN für den Ton.
7. Stummgeschaltet bleibt die visuelle Anzeige unverändert vollständig.

## Checks

- `npm run lint`
- `npm run build`

## Manuelle Test-Schritte

1. `npm run dev`, Küchenmonitor öffnen: `http://<pi-ip>:3000/kueche` (auf einem zweiten Gerät im
   LAN). Ton-Schalter einmal antippen → kurzer Bestätigungs-Chime, Icon zeigt „Ton an".
2. Auf einem anderen Gerät `/terminal`: PayPal-Bestellung aufgeben und „Ich habe bezahlt" tippen
   → auf dem Küchenmonitor erscheint die Karte **und** es klingelt einmal.
3. `/kasse`: Bar-Bestellung „kassiert" bestätigen → Karte erscheint auf der Küche + ein Ton.
4. Auf der Küche eine Order „Bearbeiten"/„Erledigt" → **kein** Ton.
5. Ton-Schalter auf „aus", neue Bestellung senden → Karte erscheint, **kein** Ton. Seite neu laden
   → Schalter steht weiter auf „aus".
6. Netzwerk/Server kurz trennen und wieder verbinden (Reconnect) → nach dem automatischen Refetch
   **kein** Fehl-Ton für bereits bekannte Orders.
