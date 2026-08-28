/**
 * Terminal display languages. The guest terminal offers a switch between these;
 * German is the default and every staff surface (Kasse) always uses it.
 */
export type TerminalLocale = "de" | "ru";

export const DEFAULT_TERMINAL_LOCALE: TerminalLocale = "de";

/** Locales offered to guests, in display order. */
export const TERMINAL_LOCALES: TerminalLocale[] = ["de", "ru"];

/** Flag + native label for each locale, shown on the language switcher. */
export const TERMINAL_LOCALE_META: Record<TerminalLocale, { label: string; flag: string }> = {
  de: { label: "Deutsch", flag: "🇩🇪" },
  ru: { label: "Русский", flag: "🇷🇺" },
};
