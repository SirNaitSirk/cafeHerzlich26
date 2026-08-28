"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Minus, Plus, X } from "lucide-react";

import type { CartModifier } from "@/hooks/use-cart";
import { toCartModifier } from "@/hooks/use-cart";
import type { CatalogModifierGroup, CatalogProduct } from "@/lib/catalog";
import { useTerminalCopy } from "@/hooks/use-terminal-language";
import { formatEuros } from "@/lib/format";

/**
 * Full-screen options step for a product with modifier groups. `single` groups
 * render as radios, `multi` as checkboxes. Required groups block "Hinzufügen"
 * until a choice is made. Big touch targets, live price preview.
 */
export function ProductOptionsSheet({
  product,
  onConfirm,
  onCancel,
}: {
  product: CatalogProduct;
  onConfirm: (modifiers: CartModifier[], quantity: number) => void;
  onCancel: () => void;
}) {
  const t = useTerminalCopy();
  // Selected option ids per group id.
  const [selected, setSelected] = useState<Record<number, number[]>>({});
  const [quantity, setQuantity] = useState(1);
  const MAX_QUANTITY = 99;

  const toggle = (group: CatalogModifierGroup, modifierId: number) => {
    setSelected((current) => {
      const groupSelection = current[group.id] ?? [];
      if (group.selectionType === "single") {
        // Radio: tapping the active option keeps it (unless not required, allow clear).
        const isActive = groupSelection.includes(modifierId);
        if (isActive && !group.required) return { ...current, [group.id]: [] };
        return { ...current, [group.id]: [modifierId] };
      }
      // Checkbox: toggle membership.
      const next = groupSelection.includes(modifierId)
        ? groupSelection.filter((id) => id !== modifierId)
        : [...groupSelection, modifierId];
      return { ...current, [group.id]: next };
    });
  };

  const chosen = useMemo<CartModifier[]>(() => {
    const byId = new Map(
      product.modifierGroups.flatMap((group) =>
        group.modifiers.map((mod) => [mod.id, mod] as const),
      ),
    );
    return Object.values(selected)
      .flat()
      .map((id) => byId.get(id))
      .filter((mod): mod is NonNullable<typeof mod> => mod != null)
      .map(toCartModifier);
  }, [selected, product.modifierGroups]);

  const missingRequired = product.modifierGroups.some(
    (group) => group.required && (selected[group.id]?.length ?? 0) === 0,
  );

  const deltaSum = chosen.reduce((sum, mod) => sum + mod.priceDeltaCents, 0);
  const previewPrice = (product.priceCents + deltaSum) * quantity;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 flex items-end justify-center bg-stone-900/40 p-0 sm:items-center sm:p-6"
      onClick={onCancel}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-amber-50 shadow-2xl sm:rounded-3xl"
      >
        <header className="flex items-center justify-between gap-3 px-6 pb-3 pt-5">
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-semibold text-stone-800">{product.name}</h2>
            <p className="text-sm text-stone-500">{t.options.title}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-stone-500 shadow-sm"
            aria-label={t.options.cancel}
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pb-4 pt-2">
          {product.modifierGroups.map((group) => {
            const groupSelection = selected[group.id] ?? [];
            const unmet = group.required && groupSelection.length === 0;
            return (
              <section key={group.id}>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-stone-700">{group.name}</h3>
                  {group.required ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        unmet ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {t.options.required}
                    </span>
                  ) : null}
                </div>
                <ul className="grid gap-2">
                  {group.modifiers.map((mod) => {
                    const active = groupSelection.includes(mod.id);
                    return (
                      <li key={mod.id}>
                        <button
                          type="button"
                          onClick={() => toggle(group, mod.id)}
                          className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left transition-colors ${
                            active
                              ? "border-amber-600 bg-white shadow-sm"
                              : "border-transparent bg-white/70"
                          }`}
                        >
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center border-2 transition-colors ${
                              group.selectionType === "single" ? "rounded-full" : "rounded-lg"
                            } ${active ? "border-amber-600 bg-amber-600 text-white" : "border-stone-300"}`}
                          >
                            {active ? <Check className="h-4 w-4" /> : null}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-base font-medium text-stone-800">
                            {mod.name}
                          </span>
                          {mod.priceDeltaCents > 0 ? (
                            <span className="shrink-0 text-sm font-medium text-amber-700">
                              +{formatEuros(mod.priceDeltaCents)}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {unmet ? (
                  <p className="mt-1.5 text-sm text-red-600">{t.options.requiredHint}</p>
                ) : null}
              </section>
            );
          })}
        </div>

        <footer className="flex items-center gap-3 border-t border-amber-100 bg-amber-50 p-4">
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              disabled={quantity === 1}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-800 disabled:opacity-40"
              aria-label={t.options.less}
            >
              <Minus className="h-5 w-5" />
            </button>
            <span className="w-10 text-center text-xl font-semibold tabular-nums text-stone-800">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.min(MAX_QUANTITY, value + 1))}
              disabled={quantity >= MAX_QUANTITY}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-600 text-white disabled:opacity-40"
              aria-label={t.options.more}
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => onConfirm(chosen, quantity)}
            disabled={missingRequired}
            className="flex min-w-0 flex-1 items-center justify-between gap-4 rounded-full bg-amber-600 px-6 py-5 text-lg font-semibold text-white shadow-lg disabled:opacity-50"
          >
            <span>{t.options.add}</span>
            <AnimatePresence mode="wait">
              <motion.span
                key={previewPrice}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
              >
                {formatEuros(previewPrice)}
              </motion.span>
            </AnimatePresence>
          </button>
        </footer>
      </motion.div>
    </motion.div>
  );
}
