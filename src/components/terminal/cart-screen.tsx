"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, Minus, Plus, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { Cart } from "@/hooks/use-cart";
import { useTerminalCopy } from "@/hooks/use-terminal-language";
import { formatEuros } from "@/lib/format";

/** Cart review: quantities, optional name, continue to payment. */
export function CartScreen({
  cart,
  stockByProduct,
  name,
  onNameChange,
  onBack,
  onContinue,
}: {
  cart: Cart;
  /** Tracked stock per product id (null = unlimited). Caps the per-line "+". */
  stockByProduct: Map<number, number | null>;
  name: string;
  onNameChange: (value: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const t = useTerminalCopy();

  return (
    <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col px-4 py-4">
      <header className="flex items-center gap-3 pb-2">
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-stone-600 shadow-sm"
          aria-label={t.cart.back}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-2xl font-semibold text-stone-800">{t.cart.title}</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        <ul className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {cart.lines.map((line) => {
              const stock = stockByProduct.get(line.productId) ?? null;
              // Product-wide count across all its variants caps the "+".
              const atStockLimit = stock !== null && cart.quantityForProduct(line.productId) >= stock;
              return (
              <motion.li
                key={line.lineId}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-stone-800">{line.name}</div>
                  {line.modifiers.length > 0 ? (
                    <ul className="mt-0.5 space-y-0.5">
                      {line.modifiers.map((mod) => (
                        <li key={mod.modifierId} className="truncate text-sm text-stone-500">
                          + {mod.name}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="text-sm text-amber-700">{formatEuros(line.priceCents)}</div>
                  {atStockLimit ? (
                    <div className="mt-0.5 text-xs font-medium text-amber-700">{t.cart.maxReached}</div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => cart.setQuantity(line.lineId, line.quantity - 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-800"
                    aria-label={t.cart.remove}
                  >
                    {line.quantity === 1 ? <Trash2 className="h-5 w-5" /> : <Minus className="h-5 w-5" />}
                  </button>
                  <span className="w-6 text-center text-lg font-semibold text-stone-800">
                    {line.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => cart.setQuantity(line.lineId, line.quantity + 1, stock ?? undefined)}
                    disabled={atStockLimit}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-600 text-white disabled:opacity-40"
                    aria-label={t.menu.add}
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>

                <div className="w-20 shrink-0 text-right font-semibold text-stone-800">
                  {formatEuros(line.priceCents * line.quantity)}
                </div>
              </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>

        <div className="mt-6">
          <Input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder={t.cart.namePlaceholder}
            maxLength={40}
            className="h-14 rounded-2xl bg-white text-base"
          />
          <p className="mt-1.5 px-1 text-sm text-stone-500">{t.cart.nameHint}</p>
        </div>
      </div>

      <footer className="border-t border-amber-100 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-stone-500">{t.cart.total}</span>
          <span className="text-2xl font-semibold text-stone-900">
            {formatEuros(cart.totalCents)}
          </span>
        </div>
        <button
          type="button"
          onClick={onContinue}
          disabled={cart.itemCount === 0}
          className="w-full rounded-full bg-amber-600 py-5 text-lg font-semibold text-white shadow-lg disabled:opacity-50"
        >
          {t.cart.continue}
        </button>
      </footer>
    </div>
  );
}
