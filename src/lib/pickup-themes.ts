/**
 * Color themes for the public pickup monitor (`/abholung`, TV).
 *
 * Single source of truth for both the board (which applies the classes) and the
 * admin theme selector (which lists them). The active theme is stored as the
 * `pickup_theme` setting and switched live from the admin dashboard — the TV
 * itself never shows any switch UI.
 *
 * IMPORTANT: every class value is a STATIC Tailwind string so the JIT compiler
 * picks it up. Never build these class names dynamically.
 */

export type PickupThemeKey =
  | "classic"
  | "light"
  | "midnight"
  | "warm"
  | "forest"
  | "christmas";

/** Tailwind class fragments a theme paints onto the board. */
export type PickupTheme = {
  /** German display name for the admin selector. */
  label: string;
  /** Small swatch color (hex) for the selector preview. */
  swatch: string;
  /** Board background + base text (replaces `bg-neutral-950 text-white`). */
  page: string;
  /** Header title color. */
  title: string;
  /** Header coffee icon color. */
  icon: string;
  /** "Abholbereit" section heading. */
  readyHeading: string;
  /** "In Zubereitung" section heading. */
  progressHeading: string;
  /** Muted per-section counter. */
  count: string;
  /** Ready order tile (must read clearly as "done" in every theme). */
  readyTile: string;
  /** Ready order tile icon color. */
  readyTileIcon: string;
  /** In-progress order tile. */
  progressTile: string;
  /** Empty-state icon color. */
  emptyIcon: string;
  /** Empty-state muted text. */
  emptyHint: string;
};

export const DEFAULT_PICKUP_THEME: PickupThemeKey = "classic";

export const PICKUP_THEMES: Readonly<Record<PickupThemeKey, PickupTheme>> = {
  // Current look — neutral near-black, white text, emerald "ready".
  classic: {
    label: "Klassisch",
    swatch: "#10b981",
    page: "bg-neutral-950 text-white",
    title: "text-white",
    icon: "text-primary",
    readyHeading: "text-emerald-400",
    progressHeading: "text-white/85",
    count: "text-white/45",
    readyTile: "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30",
    readyTileIcon: "text-white",
    progressTile: "bg-white/[0.06] text-white ring-1 ring-white/15",
    emptyIcon: "text-white/15",
    emptyHint: "text-white/45",
  },
  // Bright — white background, dark text, emerald "ready" for daylight rooms.
  light: {
    label: "Hell",
    swatch: "#ffffff",
    page: "bg-white text-neutral-900",
    title: "text-neutral-900",
    icon: "text-primary",
    readyHeading: "text-emerald-600",
    progressHeading: "text-neutral-700",
    count: "text-neutral-400",
    readyTile: "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25",
    readyTileIcon: "text-white",
    progressTile: "bg-neutral-900/[0.04] text-neutral-900 ring-1 ring-neutral-900/10",
    emptyIcon: "text-neutral-900/15",
    emptyHint: "text-neutral-500",
  },
  // Deep blue night — slate base, sky/cyan accents, emerald stays for "ready".
  midnight: {
    label: "Mitternacht",
    swatch: "#38bdf8",
    page: "bg-slate-950 text-slate-50",
    title: "text-slate-50",
    icon: "text-sky-400",
    readyHeading: "text-emerald-400",
    progressHeading: "text-sky-200/90",
    count: "text-slate-400/60",
    readyTile: "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30",
    readyTileIcon: "text-white",
    progressTile: "bg-sky-400/10 text-slate-50 ring-1 ring-sky-300/20",
    emptyIcon: "text-slate-500/20",
    emptyHint: "text-slate-400/60",
  },
  // Warm dark — zinc base, amber accents, emerald keeps "ready" unmistakable.
  warm: {
    label: "Warm",
    swatch: "#f59e0b",
    page: "bg-zinc-950 text-amber-50",
    title: "text-amber-50",
    icon: "text-amber-400",
    readyHeading: "text-emerald-400",
    progressHeading: "text-amber-200/85",
    count: "text-amber-200/40",
    readyTile: "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30",
    readyTileIcon: "text-white",
    progressTile: "bg-amber-400/10 text-amber-50 ring-1 ring-amber-300/20",
    emptyIcon: "text-amber-200/15",
    emptyHint: "text-amber-200/40",
  },
  // Forest — deep green base, lime accent, bright emerald "ready".
  forest: {
    label: "Wald",
    swatch: "#84cc16",
    page: "bg-green-950 text-green-50",
    title: "text-green-50",
    icon: "text-lime-400",
    readyHeading: "text-lime-300",
    progressHeading: "text-green-100/85",
    count: "text-green-200/45",
    readyTile: "bg-lime-500 text-green-950 shadow-lg shadow-lime-500/30",
    readyTileIcon: "text-green-950",
    progressTile: "bg-green-100/[0.07] text-green-50 ring-1 ring-green-200/15",
    emptyIcon: "text-green-200/15",
    emptyHint: "text-green-200/45",
  },
  // Christmas — deep red base, gold accents, gold "ready" tile.
  christmas: {
    label: "Weihnachten",
    swatch: "#fbbf24",
    page: "bg-red-950 text-red-50",
    title: "text-red-50",
    icon: "text-amber-300",
    readyHeading: "text-amber-300",
    progressHeading: "text-red-100/85",
    count: "text-red-200/45",
    readyTile: "bg-amber-400 text-red-950 shadow-lg shadow-amber-400/30",
    readyTileIcon: "text-red-950",
    progressTile: "bg-red-100/[0.07] text-red-50 ring-1 ring-red-200/15",
    emptyIcon: "text-red-200/15",
    emptyHint: "text-red-200/45",
  },
};

/** Ordered keys for the admin selector and Zod validation. */
export const PICKUP_THEME_KEYS = Object.keys(PICKUP_THEMES) as [
  PickupThemeKey,
  ...PickupThemeKey[],
];

export function isPickupThemeKey(value: unknown): value is PickupThemeKey {
  return typeof value === "string" && value in PICKUP_THEMES;
}

/** Resolves a stored setting value to a theme, falling back to the default. */
export function resolvePickupTheme(value?: string | null): PickupTheme {
  return PICKUP_THEMES[isPickupThemeKey(value) ? value : DEFAULT_PICKUP_THEME];
}

/** Resolves to the theme KEY (for seeding client state), with fallback. */
export function resolvePickupThemeKey(value?: string | null): PickupThemeKey {
  return isPickupThemeKey(value) ? value : DEFAULT_PICKUP_THEME;
}
