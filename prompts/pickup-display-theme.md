# Prompt: Abholmonitor-Design per Knopfdruck umschalten (Farb-Themes)

## Ziel

Das Café soll das **Design des Abholmonitors (`/abholung`, TV)** auf Knopfdruck
wechseln können — **ohne dass die Umschalt-Bedienung auf dem Fernseher selbst
sichtbar ist**. Der TV bleibt eine reine Anzeige.

Entscheidungen des Users (bestätigt):

- **Steuerort:** Der Umschalter liegt im **Admin-Dashboard** (`/admin`), nicht auf
  dem TV. Keine versteckte Geste/Tastenkombi am Fernseher.
- **Umfang:** **Nur Farb-/Theme-Varianten.** Layout, Anordnung und Motion des
  Boards bleiben unverändert — es wechseln nur Hintergrund, Akzent- und
  Statusfarben.

Prinzip (passt zur bestehenden Architektur): Das aktive Theme ist **Server-State
in der `settings`-Tabelle** (eine Quelle der Wahrheit, überlebt Reboots). Admin
schreibt es, der Event-Bus broadcastet, der Abholmonitor wechselt **live per SSE**
— kein Reload, offline-tauglich.

## Bereits inspizierter Code (Ist-Zustand)

- `src/app/abholung/page.tsx` — Server Component. Liest `getSettings()`, rendert
  `<div className="dark"><PickupBoard cafeName … initialOrders … /></div>`.
- `src/components/abholung/pickup-board.tsx` — Client Component. Fixe Farben:
  `bg-neutral-950`, `text-white`, `text-emerald-400` (ready), `text-white/85`,
  `text-primary` (Icon). Nutzt `useOrders("pickup", …)`, das nur auf
  `orders:changed` lauscht → reagiert aktuell **nicht** auf Settings-Änderungen.
- `src/lib/settings.ts` — `SETTING_KEYS` Whitelist (`cafe_name`, `paypal_handle`),
  `getSettings()`, `setSettings()`.
- `src/app/api/admin/settings/route.ts` — `GET` (liefert alle Settings, nicht durch
  Proxy gegated), `PATCH` (Zod-validiert, ruft `setSettings` + `broadcast({ type:
  "catalog:changed" })`).
- `src/lib/events.ts` — Event-Typen `orders:changed` | `catalog:changed`.
  Settings-Änderungen laufen bereits über `catalog:changed`.
- `src/hooks/use-event-stream.ts` — `useEventStream(types, onEvent)` SSE-Abo.
- `src/components/admin/settings-form.tsx` — Client-Form (Café-Name, PayPal-Handle),
  `PATCH /api/admin/settings`, Toasts über `adminMessages`.
- `src/lib/messages.ts` — zentrales deutsches Copy-Modul (`adminMessages`,
  `pickupMessages`).
- `src/proxy.ts` — gated nur `/kasse`, `/kueche`, `/admin` **Seiten**; `/api/admin/*`
  ist **nicht** gegated, der TV (`abholung`) darf `GET /api/admin/settings` lesen.

## Entscheidungen / Annahmen

- **Neuer Setting-Key:** `pickup_theme`. Default (leer/unbekannt) ⇒ `"classic"`
  (aktuelles Aussehen, damit nichts kaputt geht).
- **Themes zentral** in neuer Datei `src/lib/pickup-themes.ts` als typisierte,
  eingefrorene Map — **eine Quelle der Wahrheit** für Board + Admin-Selector.
  Kein Farbwert wird im Board oder in der Form hartkodiert dupliziert.
- Jedes Theme definiert Tailwind-Utility-Klassen (statische Strings, damit der
  JIT sie erfasst — **keine dynamisch zusammengesetzten Klassennamen**) für:
  - `page` — Board-Hintergrund + Basistextfarbe (ersetzt `bg-neutral-950 text-white`)
  - `title` — Kopfzeilen-Titelfarbe
  - `icon` — Farbe des Kaffee-Icons in der Kopfzeile
  - `readyHeading` — Überschrift „Abholbereit"
  - `progressHeading` — Überschrift „In Zubereitung"
  - `count` — gedämpfte Zählerfarbe
  - Optional `ready`/`progress`-Akzente, falls `PickupOrder` Farben braucht
    (siehe Schritt 4 — nur anfassen, wenn die Kacheln fixe Farben haben).
- **Theme-Set (5), alle dunkel/hoch-kontrastig für TV-Fernsicht.** Namen sind
  interne Keys (englisch), Labels sind deutsch:
  - `classic` — „Klassisch" (neutral-950 / weiß / emerald-ready — heutiges Bild)
  - `midnight` — „Mitternacht" (slate-/blau-Töne, cyan/sky-Akzent)
  - `warm` — „Warm" (zinc-/stone-950, amber/orange-Akzent, emerald bleibt für ready)
  - `forest` — „Wald" (dunkelgrün, lime/emerald-Akzent)
  - `christmas` — „Weihnachten" (tiefes Rot/Grün, gold/amber-Akzent für ready)
  - Ready-Status muss in **jedem** Theme sofort als „fertig" erkennbar bleiben
    (grün/gold, klar gegen die In-Progress-Farbe abgesetzt) — Glanzbarkeit vor Deko.
- Der `dark`-Wrapper in `page.tsx` bleibt; Themes setzen ihre Farben explizit,
  sind also unabhängig vom shadcn-Theme.

## Zu ändernde / neue Dateien

- **Neu** `src/lib/pickup-themes.ts` — `PICKUP_THEMES` Map, `PickupThemeKey` Typ,
  `DEFAULT_PICKUP_THEME = "classic"`, `resolvePickupTheme(value?: string)`
  (fällt bei unbekanntem Wert auf Default zurück), Liste für den Admin-Selector.
- `src/lib/settings.ts` — `pickup_theme` in `SETTING_KEYS` aufnehmen.
- `src/app/api/admin/settings/route.ts` — `pickup_theme` ins Zod-`patchSchema`
  (`z.enum(PICKUP_THEME_KEYS).optional()`). PATCH broadcastet weiterhin
  `catalog:changed`. (Keine neue Route, kein neuer Event-Typ nötig.)
- `src/components/admin/settings-form.tsx` — Theme-Auswahl ergänzen (Segmented/
  Select mit den 5 deutschen Labels, evtl. Farb-Swatch-Vorschau). Wert wird beim
  bestehenden Submit mitgeschickt. Sofort speichern ist ok, muss aber zum
  vorhandenen Form-Flow passen.
- `src/components/abholung/pickup-board.tsx` — fixe Farbklassen durch
  `theme.*`-Klassen ersetzen; `theme` als Prop entgegennehmen **und** live auf
  `catalog:changed` reagieren (siehe Real-time unten).
- `src/app/abholung/page.tsx` — `resolvePickupTheme(settings.pickup_theme)`
  bestimmen und als `initialTheme` an `PickupBoard` geben.
- `src/lib/messages.ts` — deutsche Labels: Selector-Überschrift/-Hinweis in
  `adminMessages.settings`, Theme-Anzeigenamen (falls nicht in pickup-themes.ts).

## Real-time / Broadcast-Anforderungen

- **Kein neuer Event-Typ.** Settings-Änderung broadcastet weiterhin
  `catalog:changed` (bereits im PATCH-Handler vorhanden).
- Der Abholmonitor muss **sofort** wechseln: `PickupBoard` hält das Theme als
  Client-State (seeded aus `initialTheme`) und ruft per
  `useEventStream(["catalog:changed"], …)` einen Refetch auf
  `GET /api/admin/settings` (`cache: "no-store"`), liest `pickup_theme`, setzt es
  via `resolvePickupTheme`. Muster analog zu `useOrders` (superseded-request-guard
  nicht zwingend, ein einfacher Refetch reicht).
  - Alternative, falls sauberer: kleiner Hook `usePickupTheme(initial)` in
    `src/hooks/`, der genau das kapselt. Umsetzer entscheidet; kein UI/Logik-Mix
    im Board-Markup.
- Kein Polling, kein manueller Reload. Mehrere TVs bleiben synchron.

## Akzeptanzkriterien

- Admin (`/admin`) zeigt eine Design-Auswahl für den Abholmonitor mit 5 Themes,
  deutsche Labels; Auswahl wird gespeichert (`pickup_theme` in `settings`).
- Wechsel im Admin ändert das TV-Design **live** (< ~1 s), **ohne Reload** und
  ohne dass am TV je eine Bedien-UI sichtbar wird.
- Nach Neustart/Reload des TV bleibt das zuletzt gewählte Theme aktiv.
- Ready-Status ist in jedem Theme klar als „abholbereit" erkennbar.
- Board-Layout/Animationen unverändert; nur Farben wechseln.
- Kein hartkodierter Farbwert dupliziert außerhalb von `pickup-themes.ts`.
- Money/Order-Logik unangetastet. Keine neuen Cloud-/Netzabhängigkeiten.
- Alle sichtbaren Strings deutsch; Code englisch.

## Auszuführende Checks

- `npm run lint`
- `npm run build`

## Manuelle Testschritte

1. `npm run dev`.
2. Als Admin-Gerät `/admin` öffnen (Rolle via `/setup` = `admin` oder `kasse`).
3. In einem zweiten Fenster/Gerät `/abholung` öffnen (öffentliche TV-Ansicht).
   Am besten mit einer offenen Bestellung (ready + in progress), um alle Farben zu
   sehen.
4. Im Admin nacheinander die 5 Themes wählen → der Abholmonitor wechselt jeweils
   **sofort** die Farbwelt, **ohne** Reload. Am TV taucht **keine** Umschalt-UI auf.
5. TV-Tab neu laden → das zuletzt gewählte Theme ist weiterhin aktiv.
6. Zwei `/abholung`-Fenster gleichzeitig → beide wechseln synchron.
7. Ready-Erkennbarkeit in jedem Theme prüfen (Abholbereit klar abgesetzt).

## Betroffene Surfaces öffnen (LAN)

- TV: `http://<pi-ip>:3000/abholung`
- Admin: `http://<pi-ip>:3000/admin` (Gerät zuvor über `/setup` als `admin`/`kasse`).
