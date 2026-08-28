"use client";

import { createContext, useContext, useMemo, useState } from "react";

import {
  type TerminalMessages,
  terminalMessagesByLocale,
} from "@/lib/messages";
import {
  DEFAULT_TERMINAL_LOCALE,
  TERMINAL_LOCALES,
  type TerminalLocale,
} from "@/lib/terminal-locale";

type TerminalLanguageValue = {
  locale: TerminalLocale;
  setLocale: (locale: TerminalLocale) => void;
  available: TerminalLocale[];
};

const TerminalLanguageContext = createContext<TerminalLanguageValue | null>(null);

/**
 * Provides the terminal display language to its subtree. Only the public guest
 * terminal mounts this; staff surfaces (Kasse) render the OrderFlow without a
 * provider and therefore always fall back to the default (German).
 */
export function TerminalLanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<TerminalLocale>(DEFAULT_TERMINAL_LOCALE);

  const value = useMemo<TerminalLanguageValue>(
    () => ({ locale, setLocale, available: TERMINAL_LOCALES }),
    [locale],
  );

  return (
    <TerminalLanguageContext.Provider value={value}>
      {children}
    </TerminalLanguageContext.Provider>
  );
}

/**
 * Reads the current locale and switcher. Without a provider (Kasse), reports the
 * default locale, a no-op setter, and a single available language — so the
 * language switcher hides itself and everything stays German.
 */
export function useTerminalLocale(): TerminalLanguageValue {
  const context = useContext(TerminalLanguageContext);
  if (context) return context;
  return {
    locale: DEFAULT_TERMINAL_LOCALE,
    setLocale: () => {},
    available: [DEFAULT_TERMINAL_LOCALE],
  };
}

/** Terminal UI copy for the active locale. */
export function useTerminalCopy(): TerminalMessages {
  const { locale } = useTerminalLocale();
  return terminalMessagesByLocale[locale];
}
