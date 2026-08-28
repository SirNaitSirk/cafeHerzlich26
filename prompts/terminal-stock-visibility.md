# Prompt: Bestand im Bestellterminal früher sichtbar machen & Mengen begrenzen

## Ziel

Im Bestellterminal (`/terminal`, auch von der Kasse genutzt) kann ein Gast aktuell
beliebig viele Einheiten eines Artikels in den Warenkorb legen, obwohl nur begrenzter
Bestand da ist. Erst beim Absenden der Bestellung meldet der Server per HTTP 409 „Leider
ist ein Artikel nicht mehr verfügbar." — also viel zu spät (nach dem Zahlungs-Schritt).

Der Restbestand soll **früher sichtbar** und die Mengenauswahl **hart begrenzt** werden,
sodass der 409 im Normalfall gar nicht mehr auftritt. Der 409 bleibt als Sicherheitsnetz
(z.B. paralleler Verkauf an einem zweiten Terminal) erhalten.

## Inspizierter Code (Ist-Zustand)

- `src/hooks/use-cart.ts` — Cart-Hook. Kennt Bestand **nicht**. `add()` und `setQuantity()`
  begrenzen nur nach unten (min 1 bzw. Entfernen bei ≤0), nicht nach oben. Cart-Lines werden
  je Produkt **und** gewählter Modifier-Kombination getrennt geführt (`makeLineId`).
- `src/components/terminal/product-card.tsx` — Produktkachel. `soldOut = product.stockCount === 0`
  ⇒ ausgegraut/deaktiviert. Kein Hinweis auf knappen Bestand.
- `src/components/terminal/product-options-sheet.tsx` — Options-Schritt mit Mengen-Stepper,
  hart auf `MAX_QUANTITY = 99` gedeckelt, ohne Bestandsbezug.
- `src/components/terminal/menu-screen.tsx` — `handleAdd` öffnet entweder das Options-Sheet
  oder legt direkt `cart.add(product)` ab. Kein Bestandscheck.
- `src/components/terminal/cart-screen.tsx` — Mengen-Stepper je Line (`+` unbegrenzt).
- `src/components/terminal/order-flow.tsx` — bei 409 Toast `t.errors.stock`, Refetch, zurück ins Menü.
- `src/lib/catalog.ts` — `CatalogProduct.stockCount: number | null` (null = unbegrenzt, 0 = ausverkauft).
- `src/lib/messages.ts` — Terminal-Copy je Locale (`terminalDe`, `terminalRu`), Struktur via
  `TerminalMessages`-Typ erzwungen. Relevante Zweige: `menu`, `options`, `cart`, `errors`.

Server-seitige Bestandsprüfung/-dekrementierung in `src/lib/orders.ts` (`createOrder`, 409 via
Stock-Fehler) bleibt **unverändert** — sie ist die Quelle der Wahrheit und das Sicherheitsnetz.

## Entscheidungen / Annahmen

- **Anzeige-Schwelle:** Restmenge nur bei **knappem** getracktem Bestand anzeigen, d.h.
  `stockCount !== null && stockCount <= LOW_STOCK_THRESHOLD` mit `LOW_STOCK_THRESHOLD = 10`
  (zentrale Konstante). Unbegrenzte Artikel (`null`) und gut gefüllte (> 10) zeigen keinen Hinweis.
- **„Verfügbar zum Hinzufügen"** eines Produkts = `stockCount - (bereits im Warenkorb liegende
  Gesamtmenge dieses Produkts über alle Lines/Modifier-Kombis)`. Bei `stockCount === null` unbegrenzt.
- Die Begrenzung wirkt an **allen** Stellen, an denen Menge wächst: Produktkachel-Tap,
  Options-Sheet-Stepper und „Hinzufügen", Warenkorb-`+`.
- 409-Fallback + Toast bleiben unangetastet.
- Nur Deutsch **und** Russisch pflegen (beide Locales im `TerminalMessages`-Typ).

## Betroffene Dateien

- `src/lib/catalog.ts` *(oder neue kleine Helferdatei)* — `LOW_STOCK_THRESHOLD`-Konstante zentral.
- `src/hooks/use-cart.ts` — Helper `quantityForProduct(productId): number` auf dem `Cart`-Typ;
  `add()` und `setQuantity()` akzeptieren optional ein `max` und klemmen dagegen.
- `src/components/terminal/product-card.tsx` — „Nur noch X"-Badge bei knappem Bestand; Kachel
  deaktivieren, wenn verfügbare Restmenge (unter Berücksichtigung Warenkorb) 0 erreicht.
- `src/components/terminal/menu-screen.tsx` — verfügbare Restmenge je Produkt an `ProductCard`
  und `ProductOptionsSheet` durchreichen; `handleAdd`/`handleConfirmOptions` klemmen.
- `src/components/terminal/product-options-sheet.tsx` — Stepper-Obergrenze = min(99, verfügbar);
  Hinweiszeile „Nur noch X verfügbar" wenn knapp; „Hinzufügen" bei 0 verfügbar deaktiviert.
- `src/components/terminal/cart-screen.tsx` — `+` je Line gegen produktweite Restmenge klemmen
  (Restmenge einer Line = `stockCount - Summe der übrigen Lines desselben Produkts`); `+`
  deaktivieren + dezenter „Maximum erreicht"/„Nur noch X"-Hinweis, wenn Grenze erreicht.
- `src/lib/messages.ts` — neue Copy-Schlüssel in `menu`/`options`/`cart` für DE und RU.

## Implementierungs-Anforderungen

1. **Konstante:** `LOW_STOCK_THRESHOLD = 10` an einer zentralen Stelle (z.B. `src/lib/catalog.ts`),
   exportiert und überall importiert — keine Magic Numbers verstreut.
2. **Cart-Hook:**
   - `quantityForProduct(productId: number): number` — Summe der `quantity` aller Lines mit dem
     Produkt (über Modifier-Kombis hinweg).
   - `add(product, modifiers?, quantity?, max?)` und `setQuantity(lineId, quantity, max?)` klemmen
     die resultierende **produktweite** Menge gegen `max` (falls übergeben). Bestehende Aufrufer
     ohne `max` verhalten sich unverändert. Klemmen defensiv (nie über `max`, nie unter 0/1-Regel).
   - Types sauber, kein `any`.
3. **Verfügbarkeit berechnen** (in `menu-screen.tsx` / `cart-screen.tsx`):
   - `available(product) = product.stockCount === null ? Infinity : max(0, stockCount - quantityForProduct(id))`.
   - Kachel deaktiviert, wenn `available === 0` (zusätzlich zum bestehenden `stockCount === 0`).
4. **Anzeige-Logik (nur bei knappem Bestand):** Badge/Hinweis „Nur noch {n}" nur wenn
   `stockCount !== null && stockCount <= LOW_STOCK_THRESHOLD`. Der angezeigte Wert ist der
   **noch verfügbare** Rest (also inkl. Warenkorb-Abzug), nicht der Roh-`stockCount`, damit die
   Zahl mit dem übereinstimmt, was der Gast noch tun kann. Bei 0 greift der bestehende
   „Ausverkauft"-Zustand.
5. **Options-Sheet:** `MAX_QUANTITY` bleibt Obergrenze, effektive Obergrenze = `min(MAX_QUANTITY, available)`.
   `+` deaktiviert bei Erreichen; „Hinzufügen" deaktiviert wenn `available === 0`. Knapp-Hinweis anzeigen.
6. **Warenkorb-Screen:** `+` je Line klemmt gegen produktweite Restmenge; deaktivieren + Hinweis
   bei Grenze. `−`/Entfernen unverändert.
7. Keine Server-/Schema-Änderung. Kein neuer API-Aufruf. Live-Bestandsupdates laufen weiterhin über
   den bestehenden `catalog:changed`-SSE-Refetch in `order-flow.tsx` — nach Refetch müssen die
   neuen Grenzen automatisch greifen (Ableitung aus `stockCount`, kein eigener State nötig).

## Real-time / Broadcast

Keine neue Mutation, kein neuer Broadcast. Vorhandenes Verhalten reicht: Ändert Admin/Kasse den
Bestand, kommt `catalog:changed`, `order-flow.tsx` refetcht den Katalog, `stockCount` aktualisiert
sich, und alle abgeleiteten Grenzen/Badges ziehen automatisch nach. Sicherstellen, dass keine
Bestandszahl in lokalem Component-State „einfriert".

## Akzeptanzkriterien

- Ein Artikel mit Bestand 10 zeigt auf der Produktkachel „Nur noch 10" (bzw. den verbleibenden Rest).
- Legt der Gast Einheiten in den Warenkorb, sinkt die angezeigte Restmenge entsprechend.
- Der Gast kann **nicht** mehr Einheiten wählen als verfügbar — weder per Kachel, Options-Stepper
  noch Warenkorb-`+`; die jeweiligen Buttons sind bei Erreichen der Grenze deaktiviert.
- Bei Erreichen der Grenze erscheint ein verständlicher deutscher Hinweis; UI bleibt konsistent
  und ruhig (kein Rot-Alarm, sondern dezenter Hinweis).
- Artikel mit unbegrenztem Bestand (`stockCount === null`) verhalten sich exakt wie bisher.
- Der 409-Toast tritt im normalen Ablauf nicht mehr auf, bleibt aber als Sicherheitsnetz bestehen.
- Deutsch und Russisch beide gepflegt; keine englischen Strings im UI.

## Checks

- `npm run lint`
- `npm run build` (UI-Änderung, Build absichern)

## Manuelle Testschritte

1. `npm run dev`, im Admin (`/admin`) bei einem Kuchen `Bestand = 10` setzen.
2. Am Terminal (`/terminal`, oder von einem zweiten LAN-Gerät via Pi-IP) diese Kategorie öffnen:
   Kachel zeigt „Nur noch 10".
3. Produkt hinzufügen / Menge im Options-Sheet hochzählen: bei 10 stoppt der `+`, „Hinzufügen"
   respektiert die Grenze; die Restanzeige sinkt.
4. Im Warenkorb `+` weiter drücken: bei 10 deaktiviert, Hinweis erscheint.
5. Zur Zahlung gehen und abschließen — **kein** 409-Toast.
6. Bestand im Admin auf 0 setzen: Kachel wird „Ausverkauft"/deaktiviert (Live über SSE, ohne Reload).
7. Sprache auf Russisch umschalten: Hinweise sind übersetzt.
