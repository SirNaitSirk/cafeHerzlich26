import Link from "next/link";

/**
 * Dev launcher / index. Not a final surface — links to every screen for local
 * development. On real devices each screen is opened directly in kiosk mode.
 */
const SURFACES: { href: string; title: string; description: string }[] = [
  { href: "/terminal", title: "Bestellterminal", description: "Öffentliches Bestellen (iPad/Touch)" },
  { href: "/kasse", title: "Kasse", description: "Barzahlungen bestätigen & selbst bestellen" },
  { href: "/kueche", title: "Küchenmonitor", description: "Offene Bestellungen bearbeiten" },
  { href: "/abholung", title: "Abholmonitor", description: "Öffentliche Anzeige (TV)" },
  { href: "/admin", title: "Admin", description: "Produkte, Kategorien, Bestände" },
];

export default function Home() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-8 p-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Cafe Herzlich</h1>
        <p className="text-muted-foreground">Bestell-Terminal — Übersicht der Oberflächen</p>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2">
        {SURFACES.map((surface) => (
          <li key={surface.href}>
            <Link
              href={surface.href}
              className="block rounded-xl border p-5 transition-colors hover:bg-accent"
            >
              <div className="font-medium">{surface.title}</div>
              <div className="text-sm text-muted-foreground">{surface.description}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
