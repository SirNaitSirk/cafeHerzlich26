import Link from "next/link";

/** Temporary placeholder for a surface that will be built in its own feature prompt. */
export function SurfacePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
      <p className="text-sm text-muted-foreground">
        Diese Oberfläche folgt in einem eigenen Feature-Schritt.
      </p>
      <Link href="/" className="text-sm underline underline-offset-4">
        Zur Übersicht
      </Link>
    </div>
  );
}
