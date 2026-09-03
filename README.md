# Cafe Herzlich – Bestell-Terminal

> Ein lokales, offline-fähiges Selbstbestell- und Küchen-System für ein Café.
> Fünf aufeinander abgestimmte Bildschirme (Terminal, Kasse, Küche, Abholmonitor, Admin),
> die in Echtzeit synchron bleiben – alles auf **einem einzigen Raspberry Pi** im lokalen WLAN,
> **ohne jede Internet-Abhängigkeit**.

Dieses Repository ist ein reales, produktiv eingesetztes Projekt und dient gleichzeitig als
**Bewerbungs- und Arbeitsreferenz**. Es zeigt nicht nur den Code, sondern auch die
**Arbeitsweise**: prompt-getriebene, spezifikationsbasierte Full-Stack-Entwicklung mit klarer
Architektur, festen Konventionen und einem durchgängigen Echtzeit-Konzept.

---

## Inhalt

- [Das Produkt in einem Satz](#das-produkt-in-einem-satz)
- [Die fünf Bildschirme](#die-fünf-bildschirme)
- [Bestell- und Bezahlablauf](#bestell--und-bezahlablauf)
- [Tech-Stack](#tech-stack)
- [Architektur](#architektur)
- [Datenmodell](#datenmodell)
- [Echtzeit über Server-Sent Events](#echtzeit-über-server-sent-events)
- [Projektstruktur](#projektstruktur)
- [Lokal starten](#lokal-starten)
- [Deployment auf dem Raspberry Pi](#deployment-auf-dem-raspberry-pi)
- [Arbeitsweise: prompt-getriebene Entwicklung](#arbeitsweise-prompt-getriebene-entwicklung)
- [Bewusste Design-Entscheidungen](#bewusste-design-entscheidungen)

---

## Das Produkt in einem Satz

Gäste bestellen selbstständig an einem Touchscreen, das Personal bekommt eigene Screens für
**Kasse, Küche und Abholung**, und der Chef pflegt Produkte, Kategorien und Bestände im
**Admin-Dashboard** – alles serviert von einem Raspberry Pi im Café-LAN, alle anderen Geräte
(iPads, Touchscreen, Fernseher) sind nur Browser im Kiosk-Modus.

## Die fünf Bildschirme

| Surface | Route | Zweck | Gerät |
|---|---|---|---|
| **Bestellterminal** | `/terminal` | Gäste bestellen selbst; Standby-/Attract-Screen im Leerlauf | iPad / Touchscreen (öffentlich) |
| **Kasse** | `/kasse` | Bar-Bestellungen kassieren + Bestellungen für Gäste aufnehmen | Personal-Touchscreen |
| **Küchenmonitor** | `/kueche` | Offene Bestellungen mit Live-Wartezeit, bearbeiten / fertig melden | Küchen-Bildschirm |
| **Abholmonitor** | `/abholung` | Öffentliche Anzeige: in Arbeit vs. **abholbereit (grün)** | Großer Fernseher |
| **Admin-Dashboard** | `/admin` | Produkte, Kategorien, Modifier, Bestände, Einstellungen | Personal-Gerät |

Jeder Personal-Bildschirm wird über eine **Geräte-Rolle** (signiertes Cookie, gesetzt einmalig
unter `/setup`) freigeschaltet – kein Login, keine Benutzerkonten. Das Terminal und der
Abholmonitor sind öffentlich und brauchen keine Rolle.

## Bestell- und Bezahlablauf

Der Kern des Produkts ist ein sauberer, trust-basierter Bezahl- und Freigabe-Fluss:

- **PayPal:** Es wird ein **QR-Code mit vorbelegtem Bestellbetrag** angezeigt. Bezahlung ist
  vertrauensbasiert (Friends & Family) – das System **prüft nichts**. Die Bestellung geht erst
  in die Küche, wenn der Gast auf **„Ich habe bezahlt"** tippt.
- **Bar:** Die Bestellung landet in der **Kasse**-Warteschlange (für die Küche unsichtbar) und
  wird erst in die Küche freigegeben, wenn das Personal das Kassieren bestätigt.

Jede Bestellung kann einen **optionalen Gastnamen** tragen (angezeigt auf Kasse, Küche und
Abholmonitor). Produkte mit **Bestandszählung** werden auf dem Terminal automatisch ausgegraut
und unauswählbar, sobald der Bestand 0 erreicht.

Der Bestell-Status ist die **einzige Wahrheitsquelle** und wird überall wiederverwendet:

```
awaiting_payment  → PayPal gewählt, noch nicht bestätigt   (Küche sieht nichts)
awaiting_cash     → Bar gewählt, wartet in der Kasse        (Küche sieht nichts)
in_kitchen        → freigegeben (PayPal bestätigt / kassiert)
ready             → Küche fertig  → grün auf dem Abholmonitor
collected         → abgeholt (archiviert)
cancelled         → storniert
```

## Tech-Stack

| Bereich | Technologie |
|---|---|
| Framework | **Next.js 16** (App Router) als langlaufender Node-Server (`next start`, kein Serverless) |
| Sprache | **TypeScript** durchgängig |
| Datenbank | **SQLite** (better-sqlite3) via **Drizzle ORM** – eine einzige Datei auf dem Pi |
| Echtzeit | **Server-Sent Events** + in-process Event-Bus |
| Styling | **Tailwind CSS v4** + **shadcn/ui** (Radix + CVA) |
| Animation | **Motion** (Framer Motion) |
| Formulare | **react-hook-form** + **Zod** (Zod validiert auch jeden Server-Input) |
| QR-Codes | **qrcode** (lokal generiert, kein externer Dienst) |
| Prozess | **pm2** hält den Node-Prozess auf dem Pi am Leben |

**Bewusst nicht verwendet** (weil cloud-/online-abhängig und damit für dieses Projekt falsch):
Cloud-Auth (Clerk/Supabase), gehostete Datenbanken, Payment-Gateways (Stripe/PayPal-API),
Cloud-Hosting (Vercel), externe Fonts/CDNs zur Laufzeit. Die App läuft vollständig offline.

## Architektur

Klare Schichten-Trennung im App Router (`src/`):

- **App-Routen** (`src/app/<surface>/`) – eine Route pro Bildschirm. Server Components für
  datenbasierte Reads, Client Components dort, wo Interaktivität, Live-Timer oder
  SSE-Subscriptions gebraucht werden.
- **Route Handlers** (`src/app/api/*`) – alle DB-Schreibzugriffe und der SSE-Stream. Dünn,
  einzweckig, Zod-validiert. Jede Mutation **broadcastet** anschließend ein Event.
- **Echtzeit** (`src/app/api/events/route.ts` + `src/lib/events.ts`) – SSE-Endpunkt plus
  typisierter in-process Event-Bus.
- **Proxy** (`src/proxy.ts`, Next-16-Nachfolger von `middleware.ts`) – liest das
  Geräte-Rollen-Cookie und schützt die Routen (Küche kann nicht ins Admin usw.).
- **Komponenten** (`src/components/<surface>/`) – UI pro Bildschirm; Primitives in
  `components/ui/` (shadcn).
- **Hooks** (`src/hooks/`) – geteilte Client-Logik: `use-orders`, `use-cart`,
  `use-event-stream`, `use-wait-timer`, `use-idle-timeout` u. a.
- **lib** (`src/lib/`) – Drizzle-Client + Schema, Event-Bus, Formatierung, Order-Helper,
  zentrales **Messages-Modul** für die gesamte deutsche UI-Sprache.
- **Migrationen** (`drizzle/`) – Drizzle-Migrationen sind die Schema-Wahrheitsquelle; das
  SQLite-File wird nie von Hand geändert.

**Kernregeln:** Alle Schreibzugriffe laufen über Server-Route-Handler; der Browser schreibt nie
direkt in die DB. Keine Mutation ohne Broadcast – kein Bildschirm braucht je einen manuellen
Reload. Geld wird **durchgängig in Integer-Cents** gespeichert und nur an der UI-Kante
(deutsches Format, `€`) formatiert.

## Datenmodell

SQLite via Drizzle (`src/lib/db/schema.ts`), Kern-Tabellen:

- **`categories`** – Name, Sortierung, aktiv.
- **`products`** – Kategorie, Name, `price_cents`, Bild/Icon, `stock_count` (NULL = unbegrenzt),
  aktiv, Sortierung.
- **`orders`** – kurze Bestellnummer, optionaler `guest_name`, `payment_method`, `status`,
  `source`, Zeitstempel, Gesamtbetrag in Cents.
- **`order_items`** – Bestellung, Produkt, **Snapshot** von Produktname und Einzelpreis zum
  Bestellzeitpunkt (damit spätere Preisänderungen die Historie nicht verfälschen), Menge.
- **Modifier / Modifier-Gruppen** – optionale Produktvarianten (z. B. Größen, Extras).
- **`settings`** – café-weite Konfiguration (PayPal-Handle für den QR, Café-Name u. a.).

Geld immer als Integer-Cents. Name und Preis werden auf `order_items` gesnapshottet. Jede
Änderung löst ein Echtzeit-Event aus.

## Echtzeit über Server-Sent Events

Echtzeit-Synchronität ist die zentrale Anforderung: Eine am Terminal aufgegebene Bestellung muss
**sofort** auf Kasse/Küche erscheinen, und „fertig" muss den Abholmonitor **sofort** grün färben.

- Ein **in-process Event-Bus** (`src/lib/events.ts`) – ein einfacher typisierter Emitter. Jede
  Order-/Produkt-Mutation published ein Event (`order:created`, `order:updated`, `product:*` …).
- Der **SSE-Endpunkt** streamt diese Events an jeden verbundenen Bildschirm. Clients
  reconnecten automatisch und holen bei (Re-)Connect den aktuellen Stand, danach Live-Patches.
- Da die App ein **einziger, langlaufender Node-Prozess** ist, ist in-memory Pub/Sub hier
  bewusst korrekt – kein serverless, kein Multi-Instance-Overhead.

## Projektstruktur

```
src/
  app/
    terminal/  kasse/  kueche/  abholung/  admin/   # die fünf Surfaces
    setup/                                          # einmalige Geräte-Rollen-Zuweisung
    api/
      events/route.ts                               # SSE-Stream
      orders/…  admin/…  catalog/…  uploads/…       # Zod-validierte Mutationen
  components/  <surface>/  ui/                       # UI pro Surface + shadcn-Primitives
  hooks/                                             # use-orders, use-cart, use-event-stream …
  lib/
    db/  (schema, index, migrate, seed)             # Drizzle
    events.ts  messages.ts  format.ts  orders.ts …  # Bus, deutsche Texte, Helper
  proxy.ts                                           # Geräte-Rollen-Gate
drizzle/                                             # Migrationen (Schema-Wahrheitsquelle)
prompts/                                             # Spezifikations-Prompts pro Feature
AGENTS.md                                            # verbindliche Projekt-Spezifikation
ANLEITUNG.md                                         # Personal-Handbuch (nicht-technisch, DE)
```

## Lokal starten

Voraussetzungen: Node.js (aktuelle LTS) und npm.

```bash
npm install
npm run db:generate   # Drizzle-Migrationen aus dem Schema erzeugen (bei Schemaänderung)
npm run db:migrate    # Migrationen auf die lokale SQLite-DB anwenden
npm run db:seed       # Beispiel-Kategorien/-Produkte laden
npm run dev           # http://localhost:3000
```

Danach die Surfaces öffnen: `/terminal`, `/kasse`, `/kueche`, `/abholung`, `/admin`.
Personal-Geräte einmalig über `/setup` mit einer Rolle versehen.

Weitere Skripte:

```bash
npm run build     # Produktions-Build (standalone output für den Pi)
npm run start     # Produktionsserver
npm run lint      # ESLint
npm run db:studio # Drizzle Studio
```

## Deployment auf dem Raspberry Pi

Die App läuft als ein einziger Node-Prozess, gehalten von **pm2** (`ecosystem.config.cjs`):

1. Repo auf den Pi klonen, `npm ci`, `npm run build`.
2. `npm run db:migrate` und (einmalig) `npm run db:seed`.
3. `pm2 start ecosystem.config.cjs` und `pm2 save` für Autostart.
4. Alle Kiosk-Geräte (iPads, Touchscreen, TV) im Browser auf `http://<Pi-IP>:3000/<surface>`
   zeigen lassen.

Die SQLite-Datei und hochgeladene Bilder liegen unter `data/` (per `.gitignore` ausgeschlossen –
Daten gehören auf den Pi, nie ins Repo).

## Arbeitsweise: prompt-getriebene Entwicklung

Dieses Projekt wurde nach einem strikten, dokumentierten Prozess gebaut – jedes Feature ist
nachvollziehbar spezifiziert, bevor eine Zeile Code entsteht:

1. **`AGENTS.md`** ist die verbindliche Projekt-Spezifikation: Produkt, Scope, Stack,
   Architektur-Schichten, Datenmodell, Konventionen und Leitprinzipien. Sie definiert das Ziel
   und die Leitplanken.
2. Für **jedes Feature** entsteht zuerst ein **Prompt-File** in [`prompts/`](prompts/) – mit
   Ziel, inspiziertem Bestandscode, Entscheidungen/Annahmen, betroffenen Dateien,
   Umsetzungs- und **Echtzeit-/Broadcast-Anforderungen**, Akzeptanzkriterien und exakten
   manuellen Testschritten. Erst nach Freigabe wird implementiert.
3. Umgesetzt wird **klein, typisiert und im Scope** – keine ungefragten Features, keine
   Vermischung von UI und Business-Logik, keine langen Handler.
4. Nach jeder Umsetzung laufen **Checks** (mindestens Lint, Build wo relevant).

Die [`prompts/`](prompts/)-Historie liest sich damit wie ein Feature-Changelog: von
`order-flow-terminal` und `kitchen-monitor` über `pickup-monitor`, `kasse` und `admin-dashboard`
bis zu Detail-Verbesserungen wie `terminal-stock-visibility`, `product-modifiers` oder
`kiosk-pwa-fullscreen`.

**Sprach-Konvention (bewusst durchgezogen):** Die gesamte sichtbare **UI ist zu 100 % Deutsch**
(zentral im Messages-Modul), der **Code ist ausschließlich Englisch** (Bezeichner, Dateinamen,
Kommentare, DB-Spalten). Kein Sprach-Mix im Code.

## Bewusste Design-Entscheidungen

- **Local-first, offline-always.** Ein Pi, ein LAN, keine Cloud. Jede Lösung, die das Internet
  bräuchte, wäre für dieses Projekt falsch.
- **Echtzeit oder kaputt.** Kasse, Küche und Abholmonitor spiegeln jede Änderung sofort per SSE –
  nie ist ein manueller Reload nötig.
- **Trust-basierte Bezahlung.** PayPal = QR + „Ich habe bezahlt"; Bar = Kassen-Bestätigung.
  Keine Verifizierung, kein Gateway, keine Secrets im Browser.
- **Schnell und angenehm auf Touch.** Große Touch-Targets, flüssige Animationen, aus der Distanz
  lesbarer TV-Monitor – auch auf Pi-Klasse-Hardware.
- **Eine Wahrheitsquelle pro Konzept.** Ein Produktkatalog, ein Status-Modell, ein
  Messages-Modul.

---

*Cafe Herzlich Bestell-Terminal · lokales Café-Bestellsystem · Next.js · TypeScript · SQLite ·
Drizzle · SSE. Entwickelt als reales Café-Projekt und als Referenz für spezifikationsbasierte,
prompt-getriebene Full-Stack-Entwicklung.*
