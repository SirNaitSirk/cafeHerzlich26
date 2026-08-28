"use client";

import { motion } from "motion/react";
import { Banknote, ChevronLeft, QrCode } from "lucide-react";

import type { PaymentMethod } from "@/lib/db/schema";
import { useTerminalCopy } from "@/hooks/use-terminal-language";
import { formatEuros } from "@/lib/format";

/** Payment method choice: cash (→ Kasse) or PayPal (→ QR). */
export function PaymentChoice({
  totalCents,
  paypalAvailable,
  onSelect,
  onBack,
}: {
  totalCents: number;
  paypalAvailable: boolean;
  onSelect: (method: PaymentMethod) => void;
  onBack: () => void;
}) {
  const t = useTerminalCopy();
  const options: {
    method: PaymentMethod;
    label: string;
    hint: string;
    icon: typeof Banknote;
    disabled?: boolean;
  }[] = [
    { method: "cash", label: t.payment.cash, hint: t.payment.cashHint, icon: Banknote },
    {
      method: "paypal",
      label: t.payment.paypal,
      hint: paypalAvailable ? t.payment.paypalHint : t.paypal.unavailable,
      icon: QrCode,
      disabled: !paypalAvailable,
    },
  ];

  return (
    <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col px-4 py-4">
      <header className="flex items-center gap-3 pb-2">
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-stone-600 shadow-sm"
          aria-label={t.payment.back}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-2xl font-semibold text-stone-800">{t.payment.title}</h1>
      </header>

      <p className="px-1 pb-4 text-stone-500">
        {t.cart.total}: <span className="font-semibold text-stone-800">{formatEuros(totalCents)}</span>
      </p>

      <div className="flex flex-1 items-center">
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
          {options.map((option) => (
            <motion.button
              key={option.method}
              type="button"
              disabled={option.disabled}
              whileTap={option.disabled ? undefined : { scale: 0.97 }}
              onClick={() => onSelect(option.method)}
              className="flex aspect-square max-h-80 min-h-56 flex-col items-center justify-center gap-4 rounded-3xl border border-amber-100 bg-white p-8 text-center shadow-sm transition-shadow hover:shadow-md disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <option.icon className="h-9 w-9" />
              </span>
              <span className="text-xl font-semibold text-stone-800">{option.label}</span>
              <span className="text-sm text-stone-500">{option.hint}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
