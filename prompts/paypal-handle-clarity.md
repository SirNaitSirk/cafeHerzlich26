# Prompt: PayPal-Handle klarer machen + kompakteres QR-Format

## Goal

Verhindern, dass Nutzer versehentlich den Café-Namen statt des echten
PayPal.Me-Handles eintragen (führt zu einem QR-Code, der nur auf paypal.com
umleitet). Dazu im Admin einen deutlicheren Hinweis + einen "Testen"-Link
anbieten und das erzeugte QR-Link-Format auf das kürzere `paypal.me/…`
umstellen.

Keine Payment-Verifikation, keine externen APIs — QR bleibt statisch,
trust-based (AGENTS.md §2, §12).

## Existing code inspected

- `src/components/terminal/paypal-screen.tsx` — `paypalUrl()` baut aktuell
  `https://www.paypal.com/paypalme/<handle>/<amount>EUR`. QR via `qrcode`.
- `src/components/admin/settings-form.tsx` — Eingabefeld für `paypal_handle`,
  strippt bereits alles außer `[a-zA-Z0-9]`. Zeigt `paypalHandleHint`.
- `src/lib/messages.ts` (Zeilen ~354–363) — `adminMessages.settings.*` Copy.
- `src/app/api/admin/settings/route.ts` — Zod-Validierung `^[a-zA-Z0-9]*$`,
  bleibt unverändert.
- DB aktuell: `paypal_handle = CafeHerzlich` (nicht registrierter Handle →
  Ursache des gemeldeten Problems).

## Decisions / assumptions

- `paypal.me/<handle>/<amount>EUR` ist funktional identisch zu der langen
  `paypal.com/paypalme/…`-Form, erzeugt aber einen kompakteren QR-Code. Wir
  wechseln auf die kurze Form.
- Betragsformat bleibt `<amount>EUR` (z. B. `6.40EUR`), zwei Nachkommastellen,
  Punkt als Dezimaltrenner (PayPal.Me erwartet Punkt, nicht Komma).
- Der "Testen"-Link im Admin öffnet `https://www.paypal.me/<handle>` (ohne
  Betrag) in neuem Tab — nur zum Prüfen, ob der Handle existiert. Er ist nur
  aktiv, wenn ein Handle eingetragen ist. Kein Auto-Öffnen, kein Fetch (LAN
  bleibt offline-fähig; Link ist reine Nutzeraktion).
- Copy bleibt 100 % Deutsch, Code englisch (AGENTS.md §11).

## Files likely to change

- `src/components/terminal/paypal-screen.tsx` — `paypalUrl()` auf kurze Form.
- `src/components/admin/settings-form.tsx` — deutlicherer Hinweis + "Testen"-Link.
- `src/lib/messages.ts` — `settings.paypalHandleHint` präzisieren, neue Keys
  `paypalHandleTest` (Link-Label) und ggf. `paypalHandleWarning`.

## Implementation requirements

1. **QR-Format (paypal-screen.tsx):**
   ```ts
   function paypalUrl(handle: string, totalCents: number): string {
     const amount = (totalCents / 100).toFixed(2);
     return `https://www.paypal.me/${encodeURIComponent(handle)}/${amount}EUR`;
   }
   ```
   Rest der Komponente unverändert.

2. **Admin-Hinweis (settings-form.tsx):**
   - Hint-Text verschärfen: klar machen, dass hier der **PayPal.Me-Benutzername**
     erwartet wird (der Teil nach `paypal.me/`), **nicht** der Café-Name.
   - Unter dem Feld ein "Testen"-Link/Button (nur `target="_blank"
     rel="noopener noreferrer"`), aktiv nur wenn `paypalHandle.trim()` nicht
     leer — öffnet `https://www.paypal.me/<handle>`. Als dezenter Link stylen,
     kein primärer Button. Bei leerem Handle ausblenden oder disabled.

3. **Messages (messages.ts):** Neuen/präziseren deutschen Text ergänzen, z. B.:
   - `paypalHandleHint`: "Nur der PayPal.Me-Benutzername (der Teil nach
     paypal.me/) — nicht der Café-Name. Beispiel: paypal.me/**cafeherzlich** →
     Eingabe: cafeherzlich."
   - `paypalHandleTest`: "Handle testen ↗"
   Keys zentral im `adminMessages.settings`-Objekt.

## Real-time / broadcast requirements

Keine Änderung. Settings-PATCH broadcastet bereits `catalog:changed`
(`route.ts` unverändert). Kein neuer Event nötig.

## Acceptance criteria

- QR-Code auf dem Terminal kodiert `https://www.paypal.me/<handle>/<amount>EUR`.
- Admin-Feld erklärt eindeutig, dass der PayPal.Me-Handle (nicht der Café-Name)
  gemeint ist.
- "Testen"-Link öffnet `paypal.me/<handle>` in neuem Tab, nur bei gesetztem
  Handle.
- Keine neuen externen Laufzeit-Requests im App-Betrieb (Link = Nutzeraktion).
- Alle sichtbaren Strings deutsch, Code englisch.

## Checks to run

- `npm run lint`
- `npm run build`

## Manual test steps

1. `npm run dev`, `/admin` → Einstellungen öffnen.
2. Handle leeren → "Testen"-Link ist inaktiv/ausgeblendet. Handle `cafeherzlich`
   eintragen, speichern → Toast "Einstellungen gespeichert."
3. "Testen ↗" klicken → neuer Tab öffnet `paypal.me/cafeherzlich`.
4. `/terminal` (anderes Gerät im LAN via Pi-IP oder localhost) → Bestellung →
   PayPal wählen. QR mit einem Handy scannen → Ziel ist
   `paypal.me/cafeherzlich/<Betrag>EUR` mit vorbefülltem Betrag (sofern der
   Handle real registriert ist).
