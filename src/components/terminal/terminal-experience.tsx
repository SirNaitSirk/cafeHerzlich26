"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { OrderFlow } from "@/components/terminal/order-flow";
import { WelcomeScreen } from "@/components/terminal/welcome-screen";
import { Toaster } from "@/components/ui/sonner";
import { useIdleTimeout } from "@/hooks/use-idle-timeout";
import { useTerminalLocale } from "@/hooks/use-terminal-language";
import type { CatalogCategory } from "@/lib/catalog";
import { DEFAULT_TERMINAL_LOCALE } from "@/lib/terminal-locale";

/**
 * The public guest terminal: a full-screen welcome/attract screen that, once
 * tapped, hands over to the shared `OrderFlow`. The flow returns here — via idle
 * timeout, cancel, or a completed order — back to the attract screen.
 */
export function TerminalExperience({
  cafeName,
  paypalHandle,
  initialCatalog,
}: {
  cafeName: string;
  paypalHandle: string | null;
  initialCatalog: CatalogCategory[];
}) {
  const [ordering, setOrdering] = useState(false);
  const { setLocale } = useTerminalLocale();

  // Returning to the attract screen (idle, cancel, or completed order) resets the
  // language to the default so the next guest starts in German.
  const resetToWelcome = useCallback(() => {
    setOrdering(false);
    setLocale(DEFAULT_TERMINAL_LOCALE);
  }, [setLocale]);

  useIdleTimeout(resetToWelcome, { enabled: ordering });

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={ordering ? "ordering" : "welcome"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="h-dvh w-full"
        >
          {ordering ? (
            <OrderFlow
              paypalHandle={paypalHandle}
              cafeName={cafeName}
              initialCatalog={initialCatalog}
              source="terminal"
              onExit={resetToWelcome}
              onComplete={resetToWelcome}
            />
          ) : (
            <WelcomeScreen cafeName={cafeName} onStart={() => setOrdering(true)} />
          )}
        </motion.div>
      </AnimatePresence>
      <Toaster position="top-center" richColors />
    </>
  );
}
