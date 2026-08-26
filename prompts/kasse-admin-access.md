# Kasse darf auch Admin — Zugang + Button

## Ziel

Das **Kassenterminal** (Rolle `kasse`) soll zusätzlich zum Admin-Dashboard Zugriff haben:
ein Kasse-Gerät darf **beide** Surfaces öffnen, `/kasse` **und** `/admin`. Dafür gibt es auf
der Kasse einen sichtbaren **Button zur Verwaltung** und im Admin einen **Zurück-zur-Kasse**-Button
(nur auf Kasse-Geräten). Ein reines Admin-Gerät (Rolle `admin`) bleibt wie bisher admin-only.

## Inspizierter Bestand (real gelesen)

- [src/proxy.ts](src/proxy.ts) — Device-Role-Gate. Aktuell `STAFF_PREFIXES: Record<StaffRole, string>`
  (Rolle → Pfad) und die Regel „`role === staffRole`": ein Gerät darf **nur** die Surface seiner
  eigenen Rolle. Genau das muss aufgeweicht werden (pro Pfad **mehrere** erlaubte Rollen).
  Matcher: `["/kasse/:path*", "/kueche/:path*", "/admin/:path*"]`.
- [src/lib/roles.ts](src/lib/roles.ts) — `DEVICE_ROLES` (terminal, kasse, kueche, abholung, admin),
  `STAFF_ROLES` (kasse, kueche, admin), `DEVICE_ROLE_COOKIE = "device_role"`, `isStaffRole`.
- [src/app/setup/page.tsx](src/app/setup/page.tsx) — setzt das Rollen-Cookie (Server Action).
  **Keine Änderung nötig**: eine Kasse behält Rolle `kasse` und darf künftig zusätzlich `/admin`.
- [src/components/kasse/kasse-dashboard.tsx](src/components/kasse/kasse-dashboard.tsx) — Client.
  Header (Zeilen ~82–96) mit Titel links und rechts einem `Button` „Neue Bestellung" (`PlusIcon`).
  Hier kommt der Verwaltung-Button daneben. `OrderFlow` übernimmt beim Bestellen den ganzen Screen —
  der Header-Button ist nur im normalen Kassen-View sichtbar (passt, dort gehört er hin).
- [src/components/admin/admin-dashboard.tsx](src/components/admin/admin-dashboard.tsx) — Client,
  Header mit Titel + Tab-Leiste. Bekommt einen optionalen „Zur Kasse"-Link im Header.
- [src/app/admin/page.tsx](src/app/admin/page.tsx) — Server Component. Kann das Rollen-Cookie via
  `cookies()` (aus `next/headers`) lesen und dem Dashboard `showKasseLink` übergeben.
- [src/lib/messages.ts](src/lib/messages.ts) — zentrale deutsche Copy (`kasseMessages`, `adminMessages`).
  Neue Strings hier ergänzen (kein hartkodierter Text in Komponenten).
- Es gibt **keinen** `useDeviceRole`-Hook; die Rolle wird nur im Proxy und in `/setup` genutzt.
  Für den bedingten Admin-Button reicht serverseitiges Cookie-Lesen — **kein** neuer Hook nötig.

## Entscheidungen / Annahmen (bitte im Review bestätigen)

- **Zugriffsmodell:** pro geschütztem Pfad eine Liste erlaubter Rollen statt 1:1:
  - `/kasse`  → `["kasse"]`
  - `/kueche` → `["kueche"]`
  - `/admin`  → `["admin", "kasse"]`  ← neu: Kasse zusätzlich erlaubt
  Kein neues „Super-Rollen"-Konzept, keine Rechte-Matrix — nur diese Map. (Bleibt Trusted-LAN,
  Device-Role-Cookie, kein Login.)
- **Kasse → Admin:** Button im Kasse-Header, `next/link` auf `/admin`, sekundär gestylt
  (z. B. `variant="outline"`, `SlidersHorizontalIcon`/`Settings2Icon`), links neben „Neue Bestellung".
- **Admin → Kasse:** „Zur Kasse"-Link im Admin-Header, **nur** wenn das Gerät Rolle `kasse` hat
  (Admin-Geräte sehen ihn nicht — sie kämen ohnehin nicht durchs Gate). `admin/page.tsx` liest die
  Rolle serverseitig und übergibt `showKasseLink` als Prop.
- **Kein Datenmodell-, kein API-, kein Echtzeit-Impact.** Reine Navigations-/Gating-Änderung.
- Die `/api/admin/*`-Routen bleiben (wie `/api/orders/*`) proxy-ungegatet — konsistent mit dem
  bestehenden Trusted-LAN-Ansatz; hier nicht ändern.

## Dateien, die geändert werden

- [src/proxy.ts](src/proxy.ts) — Gate von „Rolle→Pfad + Gleichheit" auf „Pfad→erlaubte Rollen +
  `includes`" umstellen. Redirect-Verhalten (→ `/setup?next=…`) unverändert.
- [src/components/kasse/kasse-dashboard.tsx](src/components/kasse/kasse-dashboard.tsx) —
  Verwaltung-Button im Header (`<Button asChild><Link href="/admin">…</Link></Button>`).
- [src/app/admin/page.tsx](src/app/admin/page.tsx) — Rollen-Cookie lesen, `showKasseLink` setzen.
- [src/components/admin/admin-dashboard.tsx](src/components/admin/admin-dashboard.tsx) —
  Prop `showKasseLink?: boolean`; wenn true, „Zur Kasse"-Link im Header rendern.
- [src/lib/messages.ts](src/lib/messages.ts) — `kasseMessages.admin` (z. B. „Verwaltung") und
  `adminMessages.backToKasse` (z. B. „Zur Kasse").

## Implementierungs-Anforderungen

- **Proxy:** eine typsichere Map `ROUTE_ROLES: { prefix: string; roles: readonly DeviceRole[] }[]`
  (oder `Record<prefix, DeviceRole[]>`). Für jeden Prefix, der auf `pathname` passt (`===` oder
  `startsWith(prefix + "/")`): wenn `role` **nicht** in der erlaubten Liste → Redirect nach
  `/setup?next=<pathname>`. Sonst `NextResponse.next()`. Matcher bleibt gleich. Keine Logik in
  Komponenten duplizieren — der Proxy ist die einzige Gate-Stelle.
- **Kein Aufweichen anderer Rollen:** `/kueche` und `/kasse` bleiben strikt bei ihrer Rolle;
  nur `/admin` erhält zusätzlich `kasse`.
- **Buttons** nutzen die bestehenden `Button`-Varianten und `next/link` (`<Button asChild>`),
  große Touch-Targets (Höhe ~44px, `h-11`/`h-12` wie im vorhandenen Header), Icon + Label.
- **Copy** ausschließlich in `messages.ts`, deutsch. Code englisch.
- Der Admin-„Zur Kasse"-Link erscheint **nur** bei `showKasseLink` (Kasse-Gerät).

## Echtzeit / Broadcast

Nicht betroffen — keine Mutationen, keine Events. (Nur erwähnen, dass bewusst nichts zu tun ist.)

## UI / UX

- **Kasse-Header:** rechts nebeneinander „Verwaltung" (outline/sekundär) und „Neue Bestellung"
  (primär). Auf schmaleren Touchscreens nicht umbrechen lassen (Icons + kurze Labels).
- **Admin-Header:** „Zur Kasse" dezent links vom Titel oder als sekundärer Button rechts oben;
  mit Zurück-Pfeil-Icon (`ArrowLeftIcon`). Nur sichtbar auf Kasse-Geräten.
- Konsistent mit den bestehenden Headern (sticky, `backdrop-blur`, gleiche Button-Größen).

## Akzeptanzkriterien

- [ ] Ein Gerät mit Rolle `kasse` kann `/kasse` **und** `/admin` öffnen (kein Redirect).
- [ ] Ein Gerät mit Rolle `admin` kann `/admin` öffnen, wird bei `/kasse` weiter nach `/setup` geleitet.
- [ ] Ein Gerät mit Rolle `kueche` wird bei `/admin` **und** `/kasse` nach `/setup` geleitet.
- [ ] Ein Gerät ohne Rolle wird bei `/admin` und `/kasse` nach `/setup?next=…` geleitet.
- [ ] Kasse-Header zeigt einen „Verwaltung"-Button, der nach `/admin` navigiert.
- [ ] Admin zeigt auf einem Kasse-Gerät einen „Zur Kasse"-Button (auf reinem Admin-Gerät **nicht**).
- [ ] UI 100% deutsch, Code englisch; keine hartkodierten Strings außerhalb `messages.ts`.

## Checks

- `npm run lint`
- `npm run build`
(Keine Migration, keine Tests betroffen.)

## Manuelle Test-Schritte

1. `npm run dev`.
2. **Kasse-Gerät:** `/setup` → Rolle „Kasse". `/kasse` öffnet. Button „Verwaltung" tippen →
   landet auf `/admin`, kann Kategorien/Produkte/Einstellungen bearbeiten. „Zur Kasse" tippen →
   zurück auf `/kasse`.
3. Direkt `/admin` in die Adresszeile (immer noch Kasse-Cookie) → öffnet ohne Redirect.
4. **Admin-Gerät:** `/setup` → Rolle „Admin". `/admin` öffnet, **kein** „Zur Kasse"-Button.
   `/kasse` aufrufen → Redirect nach `/setup`.
5. **Küche-Gerät:** Rolle „Küche" → `/admin` und `/kasse` beide → Redirect nach `/setup`.
6. Cookie löschen (neues Gerät) → `/admin` → Redirect nach `/setup?next=/admin`.
