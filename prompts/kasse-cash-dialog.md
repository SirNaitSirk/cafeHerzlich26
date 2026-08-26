# Prompt: Kassier-Dialog mit Wechselgeld-Rechner (Kasse)

## Goal

Auf der **Kasse** (`/kasse`) soll das Kassieren einer Barzahlung sich wie an einer echten
Registrierkasse anfühlen. Heute hat jede offene Barzahlung eine große **„Kassiert"**-Taste,
die die Bestellung sofort in die Küche freigibt.

Neu: Beim Antippen der Bar-**Kachel** (bzw. der „Kassieren"-Taste darauf) öffnet sich ein
**Pop-up (Dialog)**, in dem die Kraft eingibt, **wie viel Bargeld sie erhalten hat**, und das
**automatisch das Rückgeld** anzeigt („zu zahlen 3,20 € · erhalten 5,00 € · **Rückgeld 1,80 €**").
Erst **„Kassiert"** im Dialog gibt die Bestellung frei (unverändert `awaiting_cash → in_kitchen`).

Der Rechner ist eine reine **Bedien-Hilfe an der Kasse** — er hilft der Kraft beim
Herausgeben und ist **nicht** Teil der Datenpersistenz.

## Existing code inspected

- `src/components/kasse/cash-order-card.tsx` — eine `awaiting_cash`-Karte: Label, Item-Liste,
  Summe (`formatEuros`), Badges, **„Kassiert"**-Button, der direkt `onConfirm(order.id)` ruft
  (`patchOrder(id, "cash", …)`), plus optimistisches Ausblenden via `AnimatePresence`.
- `src/components/kasse/kasse-dashboard.tsx` — `confirmCash = patchOrder(id, "cash", …)`
  (PATCH `{ action: "cash" }`), Toaster, Fehler-/409-Behandlung. **Bleibt unverändert** —
  die neue Bestätigung läuft über denselben `onConfirm`.
- `src/components/ui/dialog.tsx` — shadcn/Radix-Dialog (`Dialog`, `DialogContent`,
  `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`). Vorhanden, wiederverwenden.
- `src/components/ui/{button,input}.tsx` — Primitive für Tasten/Feld.
- `src/lib/format.ts` — `formatEuros(cents)` → „3,20 €" (de-DE). **Einzige** Geld-Formatierung.
- `src/lib/messages.ts` — `kasseMessages` (Zeilen 137–169). Enthält `cash.action = "Kassiert"`,
  `total = "Summe"`, Toasts. Hier kommen die neuen deutschen Strings dazu.
- `src/lib/orders.ts` — `confirmCashPayment(id)` (Server) bleibt unverändert; es gibt **keine**
  Felder für „erhalten"/„Rückgeld" im Schema (`orders`), und dieser Prompt fügt keine hinzu.

## Decisions / assumptions

1. **Kein Server-Change, keine Migration.** Erhaltener Betrag und Rückgeld werden **nur im
   Client** berechnet und angezeigt; sie werden **nicht** gespeichert und **nicht** ans Backend
   gesendet. Der Freigabe-Aufruf bleibt exakt `PATCH { action: "cash" }` (bestehendes `onConfirm`).
   → Bar-Kassieren ist Registrierkassen-Mathematik im Moment des Kassierens, nicht Bestellhistorie
   (passt zu AGENTS §4 „out of scope: receipt printing / verification"; Schema unangetastet).
2. **Dialog statt Sofort-Aktion.** Die „Kassiert"-Taste auf der Karte öffnet künftig den Dialog,
   statt sofort freizugeben. Die **finale** Freigabe passiert im Dialog. Damit kann die Kraft
   Rückgeld nachschauen und den Vorgang abbrechen, ohne die Bestellung zu verändern.
3. **Rückgeld optional.** Passt der Betrag genau oder gibt die Kraft nichts ein, ist „Kassiert"
   trotzdem möglich (Feld leer ⇒ kein Rückgeld angezeigt, Freigabe erlaubt). Der Rechner blockiert
   nie das Kassieren — er ist Hilfe, kein Zwang.
4. **Zu wenig Geld** (erhalten < Summe): Rückgeld-Zeile zeigt einen **Fehlbetrag** deutlich
   (z. B. „Es fehlen 1,20 €", rot) statt eines negativen Rückgelds; „Kassiert" bleibt möglich
   (Kulanz/Teilzahlung sind Café-interne Entscheidung, kein System-Block).

## Files likely to change / add

- `src/components/kasse/cash-order-card.tsx` (**ändern**) — die „Kassiert"-Taste öffnet den neuen
  `CashRegisterDialog` (kontrollierter `open`-State in der Karte). Bei erfolgreicher Freigabe im
  Dialog läuft weiterhin `onConfirm(order.id)`; das bestehende `pending`/AnimatePresence-Ausblenden
  bleibt erhalten. Keine Änderung an Props-Signatur nötig (weiterhin `{ order, onConfirm }`).
- `src/components/kasse/cash-register-dialog.tsx` (**neu**) — der Kassier-Dialog:
  - Zeigt **Bestell-Label**, **zu zahlen** = `formatEuros(order.totalCents)`.
  - **Eingabe „Erhalten"**: großes, touch-freundliches Euro-Feld (Cent-genau), plus
    **Schnellwahl-Chips** für gängige Scheine/Beträge: **passend** (= Summe), **5 €, 10 €,
    20 €, 50 €** (nur sinnvolle anzeigen — z. B. Beträge ≥ Summe; „passend" immer).
  - **Rückgeld** groß und live berechnet: `erhalten - totalCents` (in Cents rechnen, nie Floats).
    ≥ 0 ⇒ „Rückgeld X" (positiv/grün); < 0 ⇒ „Es fehlen X" (rot). = 0 ⇒ „Passend, kein Rückgeld".
  - **Footer:** „Abbrechen" (schließt, keine Mutation) und **„Kassiert"** (löst `onConfirm` aus;
    disabled während `pending`; schließt bei Erfolg). Der Erfolg-/409-/Fehler-Toast kommt weiterhin
    aus `patchOrder` im Dashboard.
- `src/lib/messages.ts` (**ändern**) — `kasseMessages.cash` um einen `dialog`-Block erweitern
  (alle deutschen Strings, single source): Titel („Kassieren"), `toPay` („Zu zahlen"),
  `received` („Erhalten"), `change` („Rückgeld"), `exact` („Passend"), `exactHint`
  („Passend, kein Rückgeld"), `missing(amount)` („Es fehlen …"), `quickExact` („Passend"),
  `cancel` („Abbrechen"), `confirm` (bestehendes „Kassiert" wiederverwenden). Beträge über
  `formatEuros` im Component, nicht in den Strings hartkodieren.

## Implementation requirements

- **Sprache:** alle sichtbaren Texte Deutsch aus `messages.ts`; Bezeichner/Kommentare Englisch.
  Kein gemischt­sprachiger Code (kein `berechneRueckgeld` o. Ä.) — z. B. `changeCents`,
  `receivedCents`, `CashRegisterDialog`.
- **Geld in Cent, Ende zu Ende.** Eingabe (Euro-String mit Komma/Punkt) → **Cent-Integer**
  parsen; Rückgeld = `receivedCents - order.totalCents` als Integer. Formatierung nur am
  UI-Rand mit `formatEuros`. Keine Float-Arithmetik auf Euro-Werten.
- **Eingabe robust:** deutsches Komma **und** Punkt als Dezimaltrenner akzeptieren, führende/
  hintere Leerzeichen ignorieren, ungültige/leere Eingabe ⇒ kein Rückgeld (nicht crashen).
  Ziffern-Tastatur auf Touch (`inputMode="decimal"`).
- **Keine neue Server-/DB-Logik, keine Migration, kein Schema-Feld.** Ausschließlich Client-UI.
- **Wiederverwenden, nicht forken:** vorhandener `Dialog`, `Button`, `Input`, `formatEuros`,
  `orderDisplayLabel`, `kasseMessages`. Keine parallele Formatierung/Label-Logik.
- **Kleine, typisierte Komponente**; kein `any`. Klarer lokaler State (`receivedText`,
  abgeleitet `receivedCents`/`changeCents`).

## Real-time / broadcast requirements

- **Unverändert.** Die einzige Mutation bleibt die bestehende `PATCH { action: "cash" }` über
  `onConfirm`, die serverseitig `orders:changed` broadcastet. Der Dialog fügt **keine** neue
  Mutation und **keinen** neuen Broadcast hinzu.
- Verhalten wie bisher live prüfbar: nach „Kassiert" verlässt die Bestellung die
  **Offene Barzahlungen**-Liste und erscheint auf **/kueche** — ohne manuelles Neuladen,
  auch auf einem zweiten `/kasse`-Tab. Ein Doppel-Tap-Verlierer bekommt weiterhin den
  409-„nicht mehr offen"-Toast.

## UI / design requirements

- **Kontext:** Staff-Touchscreen an der Theke — **große** Touch-Ziele, glanceable, schnell.
  Dialog breit genug für Zahlen (`sm:max-w-md`), Zahlen in `tabular-nums`.
- **Hierarchie im Dialog:** oben Bestell-Label; darunter drei klare Zeilen/Blöcke
  **Zu zahlen · Erhalten (Eingabe) · Rückgeld**. Das **Rückgeld** ist das größte, dominanteste
  Element (die Kraft liest hier ab, was sie herausgibt) — große Ziffern, farbcodiert
  (grün positiv, rot Fehlbetrag, neutral „passend").
- **Schnellwahl-Chips** als große Tasten in einer Reihe/Grid; Tippen füllt „Erhalten". „Passend"
  setzt exakt die Summe. Chips ≥ h-12, klarer aktiver Zustand.
- **Eingabefeld** groß (Text ≥ `text-2xl`, h ≥ 14), Euro-Kontext sichtbar, fokussiert beim Öffnen.
- **Footer-Tasten:** „Kassiert" dominant (bestehendes Amber/„success"-Muster der Karte),
  „Abbrechen" sekundär. Beide ≥ h-14.
- **Motion:** Dialog nutzt die vorhandenen Radix-Open/Close-Animationen; Rückgeld-Wert-Wechsel
  darf dezent animieren; `prefers-reduced-motion` respektieren. Smooth auf Pi-Hardware.
- Konsistent mit den übrigen Kasse-/Küche-Flächen (Montserrat, Card-Radius, Amber-Akzent Bar).
  Für Feinschliff die Skills **impeccable**, **ui-ux-pro-max**, **ui-styling** heranziehen.
- **Zustände:** Eingabe leer (Rückgeld ausgeblendet/„—"), exakt (Passend-Hinweis), zu wenig
  (Fehlbetrag rot), `pending` (Kassiert-Taste disabled + Spinner/Deaktivierung).

## Security / constraints

- `/kasse` bleibt **staff-only** (Rolle `kasse` in `src/proxy.ts`) — Gate nicht anfassen.
- Keine Netz-Abhängigkeit, keine externen Assets. Reine lokale Berechnung.
- Keine Geheimnisse, keine DB-Schreibzugriffe aus dem Browser (es gibt hier ohnehin keinen neuen).

## Acceptance criteria

- Antippen der „Kassiert"-Taste einer Bar-Bestellung öffnet einen **Dialog** mit **Zu zahlen**,
  **Erhalten**-Eingabe und live berechnetem **Rückgeld** — statt sofort freizugeben.
- Eingabe „5,00" bei Summe „3,20 €" zeigt **Rückgeld 1,80 €** (grün). „passend" zeigt
  „Passend, kein Rückgeld". Ein zu kleiner Betrag zeigt den **Fehlbetrag** (rot).
- Schnellwahl-Chips (Passend, 5/10/20/50 €) füllen „Erhalten" korrekt.
- **„Kassiert"** im Dialog gibt die Bestellung frei (bestehendes Verhalten): sie verlässt
  **Offene Barzahlungen** und erscheint live auf **/kueche**; Erfolg-Toast erscheint;
  Doppel-Tap-Verlierer bekommt den 409-Toast. **„Abbrechen"** schließt ohne jede Änderung.
- Alle Cent-genau (Integer), alle sichtbaren Texte Deutsch, keine Schema-/Server-Änderung.
- `npm run lint` und `npm run build` sind grün.

## Checks to run

- `npm run lint`
- `npm run build`
- Manuelle Testschritte unten (kein Test-Runner konfiguriert).

## Exact manual test steps

1. `npm run dev`. Gerät einmalig via `/setup` als **Kasse** einrichten, `/kasse` öffnen.
2. Auf `/terminal` eine **Bar**-Bestellung aufgeben (z. B. Summe 3,20 €) → sie erscheint live
   unter **Offene Barzahlungen** auf `/kasse`.
3. „Kassiert" auf der Kachel tippen → **Dialog** öffnet sich, „Zu zahlen 3,20 €".
4. „Erhalten" = **5,00** (oder Chip **5 €**) → **Rückgeld 1,80 €** grün. Chip **passend** →
   „Passend, kein Rückgeld". Betrag **2,00** → Fehlbetrag „Es fehlen 1,20 €" rot.
5. „Abbrechen" → Dialog schließt, Bestellung bleibt in **Offene Barzahlungen** (keine Änderung).
6. Erneut öffnen, „Kassiert" → Bestellung verschwindet aus **Offene Barzahlungen** und erscheint
   auf `/kueche`; Erfolg-Toast. Zweiter `/kasse`-Tab aktualisiert live ohne Reload.
7. Doppel-Tap-Test: Dialog auf zwei `/kasse`-Tabs öffnen, beide „Kassiert" → der zweite bekommt
   den „nicht mehr offen"-Toast (409), kein Crash.
8. Touch-Check: Ziffern-Tastatur (`inputMode="decimal"`), Komma **und** Punkt funktionieren.
9. `npm run lint` und `npm run build` sind grün.
