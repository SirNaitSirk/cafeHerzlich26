# Bestellterminal — Sprachumschaltung Deutsch / Russisch

## Ziel

Gäste am **Bestellterminal** (`/terminal`) können zwischen **Deutsch** und **Russisch**
umschalten. Übersetzt werden **ausschließlich die festen UI-Texte** (Buttons, Überschriften,
Hinweise, Toasts, Erfolgs-/Bezahltexte). Produkt-, Kategorie- und Optionsnamen bleiben
**deutsch** (sie kommen aus der DB und sind nicht Teil dieses Umfangs).

Der Umschalter ist erreichbar
1. auf dem **Willkommens-/Attract-Screen** und
2. **permanent im Header während der Bestellung**.

Nach Idle-Timeout / abgeschlossener / abgebrochener Bestellung wird das Terminal
**auf Deutsch zurückgesetzt** (Standardsprache).

## Entscheidungen / Annahmen

- **Umfang:** nur feste UI-Copy aus `terminalMessages`. **Keine DB-Migration**, keine
  Übersetzung von Produkt-/Kategorie-/Optionsnamen.
- **Sprachen:** genau zwei — `de` (Default) und `ru`.
- **Scope:** Die Sprache gilt **nur für das Terminal** (`source: "terminal"`).
  Die **Kasse** nutzt dieselbe `OrderFlow`-Komponente, muss aber **immer Deutsch**
  bleiben (Personal-Oberfläche). Daher wird die Sprache über einen React-Context
  bereitgestellt, den nur das Terminal mit `ru`-Fähigkeit mountet; ohne Provider gilt `de`.
- **Kein Persistieren über Bestellungen hinweg:** Reset auf `de` beim Zurückkehren zum
  Welcome-Screen (Idle / Abschluss / Abbruch). Ein öffentliches Terminal soll für den
  nächsten Gast wieder in der Standardsprache starten.
- **Russisch braucht 3 Pluralformen** (1 / 2–4 / 5+). Die funktionswertigen Messages
  (`itemsLabel(count)` etc.) müssen für `ru` korrekt pluralisieren — nicht die deutsche
  1/n-Logik kopieren.
- Reine Offline-App: keine i18n-Library mit Netzwerk/CDN nötig. Eigene, schlanke Lösung
  mit typsicheren Message-Objekten.

## Bestehender Code (inspiziert)

- `src/lib/messages.ts` — zentrale Copy. `terminalMessages` ist ein `as const`-Objekt
  mit verschachtelten Strings **und Funktionen** (`cart.itemsLabel(count)`,
  `success.orderLabel(value)`). Wird per statischem Import
  `import { terminalMessages as t } from "@/lib/messages"` konsumiert von:
  `welcome-screen`, `menu-screen`, `product-card`, `product-options-sheet`,
  `cart-screen`, `payment-choice`, `paypal-screen`, `success-screen`, `order-flow`.
  (Kitchen/Kasse/Admin-Messages im selben File sind **nicht betroffen**.)
- `src/components/terminal/terminal-experience.tsx` — hält `ordering`-State, mountet
  `WelcomeScreen` bzw. `OrderFlow` (`source="terminal"`), `useIdleTimeout(resetToWelcome)`.
  `resetToWelcome` ist die zentrale Rückkehr-Funktion → hier Sprach-Reset einhängen.
- `src/components/terminal/order-flow.tsx` — die geteilte Bestell-Maschine
  (`menu → cart → payment → paypal → success`), genutzt von Terminal **und Kasse**.
  Braucht einen Header-Slot für den Umschalter (nur wenn Sprachwahl aktiv).
- `src/components/terminal/welcome-screen.tsx` — Attract-Screen, importiert `t`.

## Umzusetzen

### 1. Messages nach Locale strukturieren (`src/lib/messages.ts`)
- Neuen Typ `type TerminalLocale = "de" | "ru"` (zentral, exportiert).
- Bestehendes `terminalMessages`-Objekt wird zu `de`. Neues, **strukturgleiches**
  `ru`-Objekt anlegen (russische Übersetzungen aller Strings/Funktionen).
- Export: `terminalMessagesByLocale: Record<TerminalLocale, TerminalMessages>`.
- **Rückwärtskompatibilität:** `terminalMessages` als Alias auf `terminalMessagesByLocale.de`
  bestehen lassen (Kasse/andere Nutzer brechen nicht).
- `TerminalMessages`-Typ aus dem `de`-Objekt ableiten (`typeof`), damit `ru` typgeprüft
  denselben Shape haben **muss** (keine vergessenen/zusätzlichen Keys).
- Russische Pluralisierung: kleine Helper-Funktion `pluralRu(n, [one, few, many])`
  in den `ru`-Funktionsmessages verwenden.

### 2. Sprach-Context + Hook (neue Dateien)
- `src/lib/terminal-locale.ts` — Typ `TerminalLocale`, Default-Konstante, ggf.
  Flag-/Labelmetadaten (`{ de: {label:"Deutsch", flag:"🇩🇪"}, ru: {label:"Русский", flag:"🇷🇺"} }`).
- `src/hooks/use-terminal-language.tsx` — `TerminalLanguageProvider` (hält `locale`-State
  + `setLocale`) und Hooks:
  - `useTerminalLocale()` → `{ locale, setLocale, available }`.
  - `useTerminalCopy()` → gibt `terminalMessagesByLocale[locale]` zurück.
  - **Ohne Provider** (z. B. Kasse): `useTerminalCopy()` fällt auf `de` zurück,
    `setLocale` ist ein No-op / Umschalter wird nicht angezeigt.

### 3. Terminal-Komponenten auf Hook umstellen
- In allen 9 Terminal-Komponenten den statischen Import
  `terminalMessages as t` ersetzen durch `const t = useTerminalCopy()` im Komponentenbody.
  API (`t.cart.title`, `t.cart.itemsLabel(n)` …) bleibt **identisch** → minimaler Diff.
- **Kasse bleibt unangetastet**: Sie mountet `OrderFlow` ohne `TerminalLanguageProvider`,
  bekommt also automatisch `de`.

### 4. Provider + Reset im Terminal (`terminal-experience.tsx`)
- Gesamten Terminal-Baum in `TerminalLanguageProvider` wrappen.
- `resetToWelcome` erweitern: zusätzlich `setLocale("de")` (Reset für nächsten Gast).
  Gilt für Idle-Timeout, `onExit`, `onComplete`.

### 5. Sprachumschalter-Komponente (neu)
- `src/components/terminal/language-switcher.tsx` — zwei große, touch-freundliche
  Flag-/Label-Buttons (🇩🇪 Deutsch / 🇷🇺 Русский), aktive Sprache hervorgehoben.
  Nutzt `useTerminalLocale()`. Rendert **nichts**, wenn nur eine Sprache verfügbar
  (Kasse). Mindest-Touchziel 44×44 px, eher größer (Terminal-Touchscreen).
- Platzierung:
  - **Welcome-Screen:** dezent oben/ecke, klar sichtbar.
  - **Order-Flow-Header:** kompakte Variante, permanent während aller Schritte sichtbar.

## Echtzeit / Broadcast

- **Keine** Server-/DB-/Event-Bus-Änderung. Reine Client-UI-Sprache. Keine neuen
  Route-Handler, keine SSE-Änderung. (Bestellungen laufen unverändert; die russische
  Ansicht ist rein präsentativ.)

## Sprach-Konventionen (AGENTS.md)

- Code bleibt **englisch** (`TerminalLocale`, `useTerminalCopy`, `setLocale`,
  `LanguageSwitcher`) — kein Denglisch.
- Sichtbare Copy 100 % in der jeweiligen Zielsprache; deutsche Copy bleibt der Default.
- Alle Texte weiterhin **zentral** in `messages.ts` — keine hardcodierten Strings in
  Komponenten (auch nicht die russischen).

## Akzeptanzkriterien

- [ ] Am Welcome-Screen und im Bestell-Header ist ein DE/RU-Umschalter sichtbar.
- [ ] Umschalten auf Russisch übersetzt **alle** festen UI-Texte des Terminals
      (Menü-Chrome, Warenkorb, Bezahlung, PayPal, Erfolg, Fehler-Toasts).
- [ ] Produkt-/Kategorie-/Optionsnamen bleiben deutsch (aus DB).
- [ ] Russische Mengenangaben pluralisieren korrekt (1 артикул / 2 артикула / 5 артикулов o. ä.).
- [ ] Nach Idle / Abschluss / Abbruch startet das Terminal wieder auf **Deutsch**.
- [ ] **Kasse** (`/kasse`, `OrderFlow` mit `source="kasse"`) zeigt **keinen** Umschalter
      und bleibt vollständig deutsch.
- [ ] TypeScript erzwingt Struktur-Gleichheit von `de` und `ru` (kein Key fehlt).

## Checks

- `npm run lint`
- `npm run build` (Terminal-Komponenten + Typprüfung de/ru)

## Manuelle Testschritte

1. `npm run dev`, im Browser `http://<pi-ip>:3000/terminal` öffnen.
2. Auf dem Welcome-Screen 🇷🇺 wählen → CTA/Hinweis russisch. Bestellung starten.
3. Durch Menü → Warenkorb → Bezahlung → PayPal & Erfolg klicken: alle Chrome-Texte
   russisch, Produktnamen deutsch. Umschalter im Header testet Live-Wechsel DE↔RU.
4. Mengen prüfen: 1, 2 und 5 Artikel in den Warenkorb → korrekte russische Pluralform.
5. Idle abwarten (bzw. Bestellung abschließen) → Terminal ist wieder auf Deutsch.
6. `http://<pi-ip>:3000/kasse` → „Neue Bestellung": **kein** Sprachumschalter, alles deutsch.
