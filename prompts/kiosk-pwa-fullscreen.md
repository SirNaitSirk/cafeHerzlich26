# Kiosk / PWA – native App-Feeling auf dem iPad

## Ziel

Das Bestell-Terminal (und die anderen Vollbild-Surfaces) sollen sich auf dem
iPad wie eine **native App** anfühlen: kein Safari-Chrome, keine sichtbare
URL-Leiste, kein versehentliches Zoomen/Scrollen/Textmarkieren, kein
Gummiband-Bounce. Die App wird per „Zum Home-Bildschirm hinzufügen" als
Standalone-PWA gestartet.

> **Abgrenzung / bewusst NICHT Teil dieses Prompts:** Das *harte* Sperren des
> iPads (Gast kann die App nicht verlassen) ist eine reine **Geräte-Einstellung**
> (Guided Access / Single App Mode via MDM) und kein Code. Wird separat am Gerät
> gemacht — siehe „Manuelle Geräte-Einrichtung" am Ende. Dieser Prompt liefert
> die App-Seite: Fullscreen-Darstellung + touch-natives Verhalten.

Alles bleibt lokal/offline auf dem Pi — keine externen Assets, keine CDNs.

## Bestehender Code (inspiziert)

- `src/app/layout.tsx` — Root-Layout, `metadata` (title/description), `<html lang="en">`,
  Fonts self-hosted via `next/font` (offline-tauglich). **Kein `viewport`-Export,
  kein Manifest, keine Apple-Meta-Tags vorhanden.**
- `src/app/icon.png` — bereits vorhandenes App-Icon (20 KB), wird von Next als
  Favicon/Icon ausgeliefert.
- `public/brand/logo-weiss.png` — Markenlogo (weiß).
- `src/app/globals.css` — Tailwind v4 + shadcn Theme (oklch Tokens). **Keine**
  `user-select` / `touch-action` / `overscroll` / `tap-highlight` Regeln bisher.
- Surfaces: `terminal`, `kasse`, `kueche`, `abholung`, `admin` (je `page.tsx`).
- Next.js (App Router, Next 16). Manifest-Konvention: `app/manifest.ts`
  (`MetadataRoute.Manifest`); Viewport-Konvention: `export const viewport` in
  `layout.tsx` (nur Server Components). Belege: lokale Docs
  `node_modules/next/dist/docs/.../metadata/manifest.md` und
  `.../functions/generate-viewport.md`.

## Entscheidungen / Annahmen

- **Ein Manifest für die ganze App**, `display: "standalone"`, `start_url: "/terminal"`
  (das iPad-Terminal ist der primäre Kiosk-Einstieg). `background_color` /
  `theme_color` passend zum Terminal-Hintergrund (dunkles Marken-Theme —
  finalen Hex-Wert aus dem Terminal-Hintergrund übernehmen, nicht raten).
- **Icons** aus dem vorhandenen `src/app/icon.png` referenzieren (bzw. zusätzlich
  512px-Variante unter `public/` ablegen, falls nötig für den Home-Screen-Icon-Look).
  Keine neuen externen Assets.
- **Viewport-Lock:** `initialScale: 1`, `maximumScale: 1`, `userScalable: false`,
  `viewportFit: "cover"` (für randlose Darstellung / Safe-Area am iPad).
- **Touch-Verhalten global** in `globals.css`, aber **gezielt**: Text-Selektion
  und Callout nur im Terminal/Monitor-Kontext unterbinden — **Eingabefelder
  (Gastname, Admin-Formulare) müssen weiter auswählbar/editierbar bleiben.**
- Apple-spezifische Meta-Tags (`apple-mobile-web-app-capable`,
  `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`) über
  `metadata`/`appleWebApp` bzw. `other`-Feld setzen — nötig, weil iOS Safari das
  Web-Manifest für den Standalone-Modus nur teilweise auswertet.

## Zu ändernde / neue Dateien

- **Neu:** `src/app/manifest.ts` — `MetadataRoute.Manifest` (name, short_name,
  description, start_url, display, orientation, background/theme_color, icons, lang "de").
- **`src/app/layout.tsx`** — `export const viewport: Viewport` (Lock + viewportFit),
  `metadata.appleWebApp` (capable, title, statusBarStyle) ergänzen. `<html lang>`
  ggf. auf `"de"` (UI ist 100 % Deutsch — kurz mit bestehender i18n abgleichen;
  Terminal hat RU-Sprachoption, daher lang evtl. bewusst neutral lassen → im
  Zweifel `lang` unangetastet lassen und nur Meta ergänzen).
- **`src/app/globals.css`** — touch-native Basisregeln:
  - `html, body { overscroll-behavior: none; }` (kein Bounce)
  - `-webkit-tap-highlight-color: transparent`
  - `-webkit-touch-callout: none`
  - `user-select: none` als Default, mit `input, textarea, [contenteditable] { user-select: text; }`
    als Ausnahme
  - `touch-action: manipulation` (killt Doppel-Tap-Zoom) global; scrollbare
    Bereiche behalten normales Scrollen.
  - Safe-Area-Padding-Utility (`env(safe-area-inset-*)`) bereitstellen, falls
    Layouts es brauchen (nicht erzwingen).

## Real-time / Broadcast

Keine — reine Client-/Darstellungs-Schicht. Kein Event-Bus, keine DB, keine
Route-Handler-Mutation betroffen.

## Akzeptanzkriterien

1. `app/manifest.ts` liefert unter `/manifest.webmanifest` gültiges JSON mit
   `display: "standalone"` und `start_url: "/terminal"`.
2. Auf dem iPad via „Zum Home-Bildschirm" gestartet: **keine Safari-URL-Leiste,
   keine Navigations-Buttons** — echter Fullscreen.
3. Kein Pinch-Zoom, kein Doppel-Tap-Zoom, kein Gummiband-Bounce am Rand.
4. Kein Text lässt sich im Terminal per Longpress markieren; **Eingabefelder
   (Gastname, Admin) funktionieren normal** (Tippen, Auswahl, Tastatur).
5. Kein Callout-Menü / kein blauer Tap-Highlight beim Antippen von Buttons/Karten.
6. Statusleiste/Notch-Bereich sauber (kein abgeschnittener Content dank
   `viewportFit: cover` + Safe-Area).
7. Alle bestehenden Surfaces funktionieren unverändert; keine Regression an
   Formularen.

## Checks

- `npm run lint`
- `npm run build` (Metadata/Viewport/Manifest werden zur Build-Zeit ausgewertet —
  bestätigt, dass die Konventionen korrekt sind).

## Manuelle Testschritte

**Im Browser (Desktop, schnelle Vorprüfung):**
1. `npm run dev` → `http://<pi-ip>:3000/manifest.webmanifest` öffnen → gültiges
   JSON mit standalone/start_url prüfen.
2. `/terminal` öffnen → Doppel-Tap zoomt nicht; Text nicht markierbar; Gastname-Feld
   normal nutzbar.

**Auf dem iPad (der eigentliche Test):**
3. Safari auf dem iPad → `http://<pi-ip>:3000/terminal` öffnen.
4. Teilen-Menü → **„Zum Home-Bildschirm"** → Icon/Name prüfen → hinzufügen.
5. App vom Home-Bildschirm starten → **muss randlos ohne Safari-Leiste** öffnen.
6. Zoom/Scroll/Longpress-Gesten testen (Kriterien 3–6).

**Manuelle Geräte-Einrichtung (kein Code — separat am iPad):**
7. **Guided Access:** Einstellungen → Bedienungshilfen → Geführter Zugriff → an;
   Home-App öffnen → 3× Seitentaste → Code setzen. Sperrt das iPad auf genau diese
   App (Gast kann nicht raus). — Für ein einzelnes Terminal ausreichend.
8. **Alternativ (mehrere iPads / Auto-Start nach Neustart):** iPad via Apple
   Configurator *supervised* setzen und **Autonomous Single App Mode** aktivieren —
   startet automatisch in der App, auch nach Stromausfall am Pi/Gerät.
