"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { OrderFlow } from "@/components/terminal/order-flow";
import { WelcomeScreen } from "@/components/terminal/welcome-screen";
import { Toaster } from "@/components/ui/sonner";
import { useCatalog } from "@/hooks/use-catalog";
import { useIdleTimeout } from "@/hooks/use-idle-timeout";
import { useTerminalLocale } from "@/hooks/use-terminal-language";
import type { CatalogCategory } from "@/lib/catalog";
import { DEFAULT_TERMINAL_LOCALE } from "@/lib/terminal-locale";

/**
 * The public guest terminal: a full-screen welcome/attract screen that, once
 * tapped, hands over to the shared `OrderFlow`. The flow returns here — via idle
 * timeout, cancel, or a completed order — back to the attract screen.
 *
 * The catalog lives HERE, not in `OrderFlow`: this component stays mounted for
 * the life of the kiosk session, so it keeps an SSE subscription open while the
 * terminal sits idle on the attract screen and never hands a guest a stale menu.
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
  const { categories, refetch: refetchCatalog } = useCatalog(initialCatalog);

  // Belt and braces: refetch when a guest starts, so the first menu frame is
  // current even if the SSE connection had been down the whole idle period.
  const startOrdering = useCallback(() => {
    void refetchCatalog();
    setOrdering(true);
  }, [refetchCatalog]);

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
              categories={categories}
              refetchCatalog={refetchCatalog}
              source="terminal"
              onExit={resetToWelcome}
              onComplete={resetToWelcome}
            />
          ) : (
            <WelcomeScreen cafeName={cafeName} onStart={startOrdering} />
          )}
        </motion.div>
      </AnimatePresence>
      <Toaster position="top-center" richColors />
    </>
  );
}
