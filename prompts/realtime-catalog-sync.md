# Prompt: Katalog-Synchronisation reparieren (Terminal/Kasse) + serverseitige Bestandsprüfung härten

## Ziel

Beim Live-Test am 06.09.2026 hat die Kasse mehrere Produkte auf „heute aus" gestellt.
Das Bestellterminal zeigte diese Produkte weiterhin als bestellbar an — auch nach mehreren
abgeschlossenen Bestellungen. Erst das Schließen und Neuöffnen des Browser-Tabs hat die
Anzeige aktualisiert.

Drei Ursachen (unten belegt), die zusammen behoben werden:

1. Das Terminal hat im Standby **gar keine SSE-Verbindung**, weil der Katalog-State im
   unmountenden `OrderFlow` liegt. `catalog:changed` geht verloren.
2. `OrderFlow` und `useCatalog` laden beim Mounten **nicht nach**, sondern starten mit dem
   SSR-Snapshot vom letzten Vollreload. Nach jeder Bestellung wird der frische State
   weggeworfen und derselbe veraltete Prop erneut verwendet.
3. Nach einem SSE-Reconnect wird nirgends nachgeladen — alle Änderungen aus der Abriss-
   lücke sind dauerhaft verloren.

Zusätzlich wird die serverseitige Bestandsprüfung von „pro Bestellzeile" auf „pro Produkt"
umgestellt (echte Überverkauf-Lücke) und der 409-Pfad im Terminal nutzbar gemacht.

**Nicht** Teil dieses Prompts: das Bündeln mehrerer EventSource-Verbindungen pro Screen
(HTTP/1.1-Limit von 6 Verbindungen pro Origin). Separat, sobald es akut wird.

## Inspizierter Code (Ist-Zustand)

### Sync

- `src/components/terminal/terminal-experience.tsx:50-58` — rendert `OrderFlow` **nur** wenn
  `ordering === true`, sonst `WelcomeScreen`. Reicht das unveränderliche Prop `initialCatalog`
  durch. Im Standby existiert kein Abonnent.
- `src/components/terminal/order-flow.tsx:61` — `useState(initialCatalog)`; `:80-91`
  `refetchCatalog`; `:93` `useEventStream(["catalog:changed"], refetchCatalog)`. **Kein**
  Refetch beim Mounten. State stirbt beim Unmount.
- `src/hooks/use-catalog.ts` — dieselbe Lücke: seedet aus `initial`, refetcht nur auf Event.
- `src/hooks/use-event-stream.ts` — registriert ausschließlich die benannten Event-Listener.
  Kein `open`-/`error`-Handler, also kein Refetch nach Reconnect.
- `src/hooks/use-orders.ts:47-50` — macht es richtig (Refetch beim Mount), der Kommentar
  behauptet aber fälschlich „on (re)connect". Kommentar korrigieren.
- `src/components/kasse/kasse-dashboard.tsx:109-133` — identisches Muster: `OrderFlow` und
  `AvailabilityPanel` bekommen beide den SSR-Prop `catalog` und mounten/unmounten.
- `src/hooks/use-pickup-theme.ts:36`, `src/hooks/use-admin-catalog.ts:45`,
  `src/hooks/use-admin-modifier-groups.ts:46` — nutzen denselben `useEventStream` und
  profitieren automatisch vom Reconnect-Refetch.
- `src/app/api/events/route.ts` — SSE-Endpunkt, sendet `: connected` und alle 25s `: ping`.
  Serverseitig in Ordnung, bleibt unverändert.
- Schreibpfade broadcasten korrekt `catalog:changed` (u.a.
  `src/app/api/admin/products/[id]/route.ts:60`, `src/app/api/orders/route.ts:78`).

### Bestand

- `src/lib/orders.ts:220-315` (`createOrder`) — Prüfung `:241` und Dekrementierung `:303-312`
  laufen **je `input.items`-Eintrag**. Dasselbe Produkt darf mehrfach vorkommen (verschiedene
  Modifier ⇒ verschiedene `lineId`, siehe `use-cart.ts:42-46`); `createOrderSchema:40-50`
  verbietet Duplikate nicht. Bestand 2 + zwei Zeilen à 2 ⇒ beide Prüfungen bestehen,
  abgebucht werden 4, `stockCount` wird **negativ**.
- Über die aktuelle Terminal-UI nicht erreichbar, weil `use-cart.ts:59-65` produktweit
  deckelt — der Server verlässt sich damit aber auf eine Client-Regel.
- Nebenläufigkeit zwischen zwei Terminals ist dagegen **korrekt**: `better-sqlite3` ist
  synchron und `createOrder` enthält kein `await`, die Transaktion läuft ununterbrochen in
  einem Event-Loop-Tick. Diese Garantie ist nirgends dokumentiert.
- `src/lib/orders.ts:70-75` — `OrderStockError` trägt den `productName`, der Client zeigt ihn
  nicht an.
- `src/components/terminal/order-flow.tsx:113-117` — bei 409: Toast `t.errors.stock`, Refetch,
  zurück ins Menü. Der Warenkorb bleibt **unverändert**, inklusive der nicht lieferbaren Position.
- `src/lib/orders.ts:568-635` (`updateOrder`, Küchen-Edit) — prüft und bucht sequenziell je
  Position mit frischem SELECT. Korrekt, bleibt unverändert.

## Entscheidungen / Annahmen

- Der Katalog-State zieht in die **dauerhaft gemountete** Ebene: `TerminalExperience` bzw.
  `KasseDashboard`. Beide nutzen künftig `useCatalog` und reichen `categories` als Prop nach
  unten. `OrderFlow` und `AvailabilityPanel` besitzen **keinen** eigenen Katalog-State mehr.
- `OrderFlow` bekommt damit ein Prop `categories: CatalogCategory[]` statt
  `initialCatalog` — Umbenennung ist gewollt, weil der Wert nicht mehr nur initial ist.
  Analog `AvailabilityPanel`.
- `useCatalog` refetcht zusätzlich beim Mounten (Muster von `use-orders.ts:47-50`
  übernehmen, inklusive `requestId`-Guard, damit nichts überholt).
- `useEventStream` refetcht zusätzlich bei jedem `open` der `EventSource`. Der Browser
  feuert `open` auch beim ersten Verbindungsaufbau — das ist gewollt und ersetzt den
  Mount-Refetch nicht (die Verbindung kann dauerhaft scheitern), sondern ergänzt ihn.
  Doppel-Fetches beim Start sind durch den `requestId`-Guard unschädlich.
- Zusätzlich refetcht das Terminal beim **Start einer Bestellung** (Tap auf dem Welcome-Screen),
  damit der erste Menü-Frame garantiert aktuell ist, auch wenn die SSE-Verbindung tot war.
- Serverseitig: `input.items` vor Prüfung und Abbuchung nach `productId` aggregieren. Geprüft
  und abgebucht wird die **Summe** pro Produkt. Die Bestellpositionen selbst bleiben getrennt
  (Modifier-Snapshots).
- Der 409-Toast nennt künftig den Produktnamen. Der Server liefert ihn bereits im
  `error`-Feld; das Terminal ist aber mehrsprachig (DE/RU) — deshalb **nicht** die Servermeldung
  anzeigen, sondern das Feld `productName` zusätzlich im 409-JSON zurückgeben und in die
  lokalisierte Copy einsetzen.
- Beim 409 wird die betroffene Warenkorb-Position auf den real verfügbaren Rest gekürzt
  (0 ⇒ Position entfernen), basierend auf dem frisch geladenen Katalog. Danach wie bisher
  zurück ins Menü.
- Keine Bestandsreservierung beim Legen in den Warenkorb — bewusst nicht: das würde Ware
  durch stehengelassene Warenkörbe blockieren und Timeout-/Aufräumlogik erzwingen, die dieses
  Café nicht braucht. Prüfen-und-abbuchen beim Absenden bleibt der richtige Ansatz.

## Betroffene Dateien

- `src/hooks/use-event-stream.ts` — `open`-Listener, der `onEventRef.current()` aufruft.
- `src/hooks/use-catalog.ts` — Refetch beim Mounten (Muster aus `use-orders.ts`).
- `src/hooks/use-orders.ts` — nur der irreführende Kommentar bei `:47`.
- `src/components/terminal/terminal-experience.tsx` — `useCatalog(initialCatalog)`;
  `categories` an `OrderFlow` durchreichen; im `onStart`-Handler `refetch()` auslösen.
- `src/components/terminal/order-flow.tsx` — eigener Katalog-State, `refetchCatalog` und
  `useEventStream` entfernen; `categories` als Prop; neues Prop `onStockConflict` **oder**
  (bevorzugt) ein von oben gereichtes `refetchCatalog: () => Promise<void>`, damit der
  409-Pfad weiterhin sofort nachladen kann. Warenkorb-Kürzung im 409-Zweig.
- `src/components/kasse/kasse-dashboard.tsx` — `useCatalog(catalog)`; `categories` +
  `refetchCatalog` an `OrderFlow` und `AvailabilityPanel` durchreichen.
- `src/components/kasse/availability-panel.tsx` — `useCatalog` entfernen, `categories`,
  `hasError`, `refetch` als Props entgegennehmen.
- `src/lib/orders.ts` — `createOrder`: Aggregation nach `productId` für Prüfung und
  Abbuchung; Kommentar, der die Synchronitäts-Garantie festhält (kein `await` in dieser
  Transaktion, sonst bricht die Atomarität).
- `src/app/api/orders/route.ts` — 409-Antwort um `productName` ergänzen.
- `src/lib/messages.ts` — `errors.stock` als Funktion/Template mit Produktnamen, DE **und** RU.
  Ein neutraler Fallback bleibt für den Fall ohne `productName`.

## Real-time-/Broadcast-Anforderungen

- Keine neuen Events und keine Änderung am SSE-Endpunkt. Der bestehende
  `catalog:changed`-Broadcast ist korrekt; repariert wird ausschließlich die Empfängerseite.
- Nach dem Umbau gilt: **jede** dauerhaft geöffnete Oberfläche (Terminal im Standby, Kasse,
  Küche, Abholung, Admin) hat durchgehend eine offene SSE-Verbindung und lädt nach
  Mount **und** nach jedem Reconnect nach. Kein manueller Reload darf je nötig sein.

## Akzeptanzkriterien

1. Terminal steht auf dem Willkommensbildschirm. Kasse stellt ein Produkt auf „aus".
   Der Gast tippt auf Start → das Produkt ist im Menü sofort ausgegraut. Kein Reload.
2. Dasselbe gilt, wenn die Umstellung passiert, während der Gast im Menü steht.
3. Nach einer abgeschlossenen Bestellung und Rückkehr zum Welcome-Screen bleibt der Katalog
   aktuell — die nächste Bestellung startet nicht mit alten Daten.
4. Netzwerk kurz trennen (DevTools offline → wieder online), währenddessen ein Produkt
   umstellen: nach dem Reconnect zeigt das Terminal den neuen Stand ohne Reload.
5. Bestand 2, zwei Bestellpositionen desselben Produkts mit verschiedenen Modifiern à 2:
   der Server antwortet 409, `stockCount` bleibt bei 2 und wird nie negativ.
6. Zwei Terminals bestellen gleichzeitig das letzte Stück: eines bekommt 201, das andere 409.
   `stockCount` landet bei 0, nie darunter.
7. Der 409-Toast nennt den Produktnamen, die betroffene Warenkorb-Position ist auf den
   verfügbaren Rest gekürzt bzw. entfernt, und der Gast landet im Menü.
8. Die Kasse-Verfügbarkeitsliste zeigt nach langem offenem Tab denselben Stand wie das Terminal.
9. `npm run lint` und `npm run build` laufen sauber; keine `any`, alle UI-Strings DE **und** RU.

## Checks

- `npm run lint`
- `npm run build`
- (kein Testrunner konfiguriert — entfällt)

## Manuelle Tests

Voraussetzung: `npm run dev`, zwei Geräte/Tabs im LAN auf der Pi-IP.

1. Tab A: `http://<pi-ip>:3000/terminal` — auf dem Willkommensbildschirm stehen lassen.
   Tab B: `http://<pi-ip>:3000/kasse` → „Verfügbarkeit" → ein Produkt auf „aus" tippen.
   In Tab A auf Start tippen: Produkt muss ausgegraut sein.
2. Tab A ins Menü, Tab B ein weiteres Produkt umstellen → Tab A grau ohne Interaktion.
3. In Tab A eine Bestellung komplett durchlaufen (PayPal → „Ich habe bezahlt"), zurück zum
   Welcome. Tab B ein drittes Produkt umstellen. Tab A erneut starten → aktuell.
4. Tab A DevTools → Network → Offline, Tab B ein Produkt wieder auf „verfügbar" stellen,
   Tab A wieder online → Anzeige aktualisiert sich innerhalb weniger Sekunden von selbst.
5. Admin (`/admin`) → ein Produkt mit `stockCount = 2` anlegen. Zwei Terminal-Tabs öffnen,
   in beiden je 2 Stück in den Warenkorb legen und **möglichst gleichzeitig** absenden:
   einer bekommt die Erfolgsseite, der andere den Bestands-Toast mit Produktnamen.
   Im Admin prüfen: `stockCount` = 0, nicht negativ.
6. Produkt mit `stockCount = 2` und einer Modifier-Gruppe: 2× Variante A und 2× Variante B in
   denselben Warenkorb, absenden → 409, Bestand bleibt 2.
7. `/kueche` und `/abholung` parallel offen lassen und bestätigen, dass beide weiterhin live
   aktualisieren (Regressionsprüfung des `useEventStream`-Umbaus).
