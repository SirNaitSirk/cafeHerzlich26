# Produktbilder als lokale SVG-Illustrationen

## Ziel

12 Produkte ohne Bild bekommen eine handgezeichnete, flache SVG-Illustration im
Café-Herzlich-Look. Die Dateien liegen lokal im Repo (`public/products/`), sind
komplett offline nutzbar und werden per `products.image_url` referenziert — genau
wie die bereits hochgeladenen Fotos unter `/api/uploads/…`.

## Betroffene Produkte (image_url IS NULL)

| ID | Kategorie       | Produkt                  | Datei                          |
| -- | --------------- | ------------------------ | ------------------------------ |
| 67 | Kaffee          | Kakao                    | `kakao.svg`                    |
| 74 | Kaffee          | Milchkaffee              | `milchkaffee.svg`              |
| 75 | Kaffee          | Tee                      | `tee.svg`                      |
| 66 | Kuchen          | Tiramisu                 | `tiramisu.svg`                 |
| 73 | Kuchen          | Pflaumen-Streuselkuchen  | `pflaumen-streuselkuchen.svg`  |
| 68 | Kalte Getränke  | Stilles Wasser           | `stilles-wasser.svg`           |
| 69 | Kalte Getränke  | Cola                     | `cola.svg`                     |
| 70 | Kalte Getränke  | Fanta                    | `fanta.svg`                    |
| 71 | Kalte Getränke  | Sprite                   | `sprite.svg`                   |
| 72 | Kalte Getränke  | Capri-Sun                | `capri-sun.svg`                |
| 76 | Kalte Getränke  | Cola-Zero                | `cola-zero.svg`                |
| 77 | Herzhaftes      | Pizza-Baguette           | `pizza-baguette.svg`           |

## Inspizierter Code

- `src/lib/db/schema.ts` — `products.imageUrl` ist ein optionaler Pfad-String, kein Zwang zu `/api/uploads`.
- `src/lib/admin-catalog.ts:93` — `imageUrlSchema` ist `z.string().trim().max(200).nullable()`; `/products/x.svg` ist gültig.
- `src/components/terminal/product-image.tsx` — rendert `imageUrl` via `next/image` (`fill`, `object-cover`), sonst Gradient + Initial.
- `next.config.ts` — `images: { unoptimized: true }`, d.h. SVG wird ohne Optimizer direkt ausgeliefert (kein `dangerouslyAllowSVG` nötig).
- `src/lib/uploads.ts` — Upload-Pfad bleibt unangetastet; die Illustrationen sind Repo-Assets, keine Uploads (Uploads sind gitignored und würden auf dem Pi fehlen).

## Entscheidungen / Annahmen

- **SVG statt Foto-Generierung.** Keine Internet-Abhängigkeit, keine Lizenz-/Markenfragen, winzige Dateien, scharf auf jedem Display. Vom Nutzer so bestätigt.
- **Keine Markenlogos.** Cola/Fanta/Sprite/Capri-Sun werden als generische Getränke in der jeweils typischen Farbe gezeichnet (dunkelbraun / orange / hellgrün / gelbe Trinkpackung mit Halm), ohne Schriftzüge oder Logos.
- **Repo-Assets, nicht Uploads.** `public/products/*.svg` wird eingecheckt, damit die Bilder auf dem Pi nach `git pull` sofort da sind.
- **Backfill-Skript statt Migration.** Die Zuordnung Produktname → SVG passiert über ein idempotentes tsx-Skript, das nur `image_url IS NULL` setzt. So kann es auf Mac und Pi gefahrlos mehrfach laufen und überschreibt nie ein vom Personal hochgeladenes Foto.

## Zu ändernde / neue Dateien

- **neu:** `public/products/*.svg` (12 Dateien)
- **neu:** `scripts/assign-product-images.ts` — Name→Datei-Mapping, setzt `image_url` nur wo NULL
- **geändert:** `package.json` — Script `db:product-images`

## Umsetzungsanforderungen

### Illustrationsstil (einheitlich über alle 12)

- Quadratisch, `viewBox="0 0 400 400"`, `preserveAspectRatio` Standard (Kachel ist `aspect-square`, `object-cover`).
- Vollflächiger warmer Hintergrund (kein Transparenz-Loch): weicher Verlauf in der Terminal-Palette, pro Kategorie leicht variierend
  - Kaffee: `#f8ecdb → #f0d9b8`
  - Kuchen: `#fdeadf → #f6d3c4`
  - Kalte Getränke: `#e8f1f7 → #d6e6f2`
  - Herzhaftes: `#fbeddb → #f3d9b0`
- Motiv zentriert, ca. 60–70 % der Fläche, damit `object-cover`-Beschnitt nichts Wichtiges abschneidet; **mindestens 12 % Randabstand** an allen Seiten.
- Flache Formen, keine Filter/Blur (Pi-Performance), maximal lineare Verläufe. Konturen: warmes Braun `#7c5a3f` bei ~2–3 px, oder konturlos mit klaren Farbflächen — aber **konsistent über alle 12**.
- Keine Schrift, keine Logos, keine externen Fonts (Offline-Regel).
- Jede Datei mit `<title>` für Barrierefreiheit; `role="img"`.

### Motive

- **Kakao** — Becher mit dunkelbrauner Schokolade, Sahnehaube, Kakaostreusel.
- **Milchkaffee** — hohes Glas, Kaffee-/Milch-Schichtung, hellbraune Krone.
- **Tee** — helle Tasse mit bernsteinfarbenem Tee, Teebeutel-Fähnchen am Rand, Dampf.
- **Tiramisu** — rechteckiges Stück, Creme-/Biskuit-Schichten, Kakaopuder oben.
- **Pflaumen-Streuselkuchen** — Blechkuchenstück, violette Pflaumenhälften, goldene Streusel.
- **Stilles Wasser** — klares Glas mit Wasser, dezente Blasen, Wasserlinie.
- **Cola** — Glas mit dunkelbrauner Limonade, Eiswürfel, Blasen, Strohhalm.
- **Cola-Zero** — wie Cola, aber Glas/Strohhalm in kühlem Anthrazit/Silber statt Rot-Warm, klar unterscheidbar.
- **Fanta** — Glas mit oranger Limonade, Orangenscheibe am Rand.
- **Sprite** — Glas mit hellgrün-klarer Limonade, Limettenscheibe, Blasen.
- **Capri-Sun** — silbrig-gelbe Trinkpackung mit rotem Halm, generisch (kein Schriftzug).
- **Pizza-Baguette** — halbes Baguette mit Tomatensauce, geschmolzenem Käse, Kräutern.

### Backfill-Skript

- `scripts/assign-product-images.ts`, ausführbar mit `npm run db:product-images` (`tsx scripts/assign-product-images.ts`).
- Nutzt den bestehenden Drizzle-Client (`src/lib/db`), kein eigener DB-Zugriff.
- Mapping als `Record<string, string>` von exaktem Produktnamen → `/products/<datei>.svg`.
- Update nur, wenn `image_url IS NULL` und der Name im Mapping steht.
- Loggt pro Produkt „gesetzt“ / „übersprungen (hat bereits ein Bild)“ und am Ende eine Summe.
- Bricht nicht ab, wenn ein Produkt nicht existiert (die IDs können auf dem Pi anders sein — deshalb Name als Schlüssel).

### Echtzeit

Kein SSE-Event nötig: das Skript ist ein einmaliger Offline-Batch außerhalb des laufenden
Prozesses. Nach dem Lauf reicht ein Reload der Terminal-Seite (bzw. der nächste
Katalog-Refetch). Der reguläre Admin-Weg über `PATCH /api/admin/products/[id]`
broadcastet weiterhin wie gehabt — daran wird nichts geändert.

## Akzeptanzkriterien

- Alle 12 Produkte zeigen auf `/terminal` eine Illustration statt Gradient + Buchstabe.
- Die 12 SVGs wirken als **eine Serie** (gleiche Strichstärke, gleiche Palette, gleiche Motivgröße) — nicht wie 12 einzeln gesammelte Cliparts.
- Kein Motiv wird durch `object-cover` in der quadratischen Kachel angeschnitten.
- Keine Marken-Logos oder -Schriftzüge in den Getränkebildern.
- Bereits hochgeladene Fotos (IDs 57–65) bleiben unverändert.
- Ein zweiter Lauf des Skripts ändert nichts (idempotent).
- Bilder laden auch bei getrenntem Internet (reine lokale Assets).

## Checks

- `npm run lint`
- `npm run build`
- Skript-Lauf: `npm run db:product-images` (zweimal, zum Nachweis der Idempotenz)

## Manuelle Tests

1. `npm run db:product-images` ausführen — Ausgabe listet 12 gesetzte Bilder.
2. `npm run dev`, auf dem iPad `http://192.168.32.70:3000/terminal` öffnen.
3. Kategorien Kaffee / Kuchen / Kalte Getränke / Herzhaftes durchgehen — jede Kachel hat ein Bild, aus ~1,5 m Abstand erkennbar.
4. `/admin` öffnen, bei einem der 12 Produkte ein echtes Foto hochladen → Foto ersetzt die Illustration; Skript erneut laufen lassen → Foto bleibt erhalten.
5. WLAN-Router vom Internet trennen (oder Mac offline) → Terminal neu laden, alle Bilder erscheinen weiterhin.
