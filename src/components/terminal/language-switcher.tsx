"use client";

import { motion } from "motion/react";

import { useTerminalLocale } from "@/hooks/use-terminal-language";
import { TERMINAL_LOCALE_META, type TerminalLocale } from "@/lib/terminal-locale";
import { cn } from "@/lib/utils";

/**
 * Guest language switcher (🇩🇪 / 🇷🇺). Renders nothing when only one language is
 * available (e.g. the Kasse, which has no language provider). Two variants:
 * `full` for the welcome screen, `compact` for the order-flow header.
 */
export function LanguageSwitcher({
  variant = "full",
  className,
}: {
  variant?: "full" | "compact";
  className?: string;
}) {
  const { locale, setLocale, available } = useTerminalLocale();

  if (available.length < 2) return null;

  const compact = variant === "compact";

  return (
    <div
      role="group"
      aria-label="Sprache"
      className={cn(
        "flex items-center gap-1 rounded-full border border-amber-100/20 bg-stone-900/60 p-1 backdrop-blur-sm",
        className,
      )}
    >
      {available.map((code: TerminalLocale) => {
        const meta = TERMINAL_LOCALE_META[code];
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setLocale(code);
            }}
            aria-pressed={active}
            className={cn(
              "relative flex items-center gap-2 rounded-full font-medium transition-colors",
              compact ? "px-3 py-2 text-sm" : "px-5 py-3 text-lg",
              active ? "text-stone-900" : "text-amber-100/70",
            )}
          >
            {active && (
              <motion.span
                layoutId={`lang-active-${variant}`}
                className="absolute inset-0 rounded-full bg-amber-500"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative z-10" aria-hidden>
              {meta.flag}
            </span>
            <span className="relative z-10">{compact ? code.toUpperCase() : meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}
