"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import { Check } from "lucide-react";

import { useTerminalCopy } from "@/hooks/use-terminal-language";
import type { PaymentMethod } from "@/lib/db/schema";

const AUTO_RETURN_MS = 6_000;

/** Confirmation screen. Shows the order label and auto-returns to welcome. */
export function SuccessScreen({
  method,
  orderLabel,
  onDone,
}: {
  method: PaymentMethod;
  orderLabel: string;
  onDone: () => void;
}) {
  const t = useTerminalCopy();
  useEffect(() => {
    const timer = setTimeout(onDone, AUTO_RETURN_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onDone}
      className="flex h-dvh w-full flex-col items-center justify-center gap-6 bg-emerald-50 px-8 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        className="flex h-28 w-28 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xl"
      >
        <Check className="h-14 w-14" strokeWidth={3} />
      </motion.div>

      <h1 className="text-3xl font-bold text-stone-900">{t.success.title}</h1>
      <p className="text-lg font-medium text-emerald-800">{t.success.orderLabel(orderLabel)}</p>
      <p className="max-w-md text-stone-600">
        {method === "cash" ? t.success.cashInfo : t.success.paypalInfo}
      </p>
      <p className="text-sm text-stone-400">{t.success.autoReturn}</p>
    </motion.div>
  );
}
