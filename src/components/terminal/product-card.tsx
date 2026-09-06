"use client";

import { motion } from "motion/react";
import { Plus } from "lucide-react";

import { ProductImage } from "@/components/terminal/product-image";
import type { CatalogProduct } from "@/lib/catalog";
import { useTerminalCopy } from "@/hooks/use-terminal-language";
import { formatEuros } from "@/lib/format";
import { isLowStock } from "@/lib/stock";

/**
 * A single product tile. Greyed-out and unselectable when sold out — either the
 * product's tracked stock is 0 or the guest already holds all remaining units in
 * the cart (`available === 0`). Shows a "Nur noch X" hint when stock runs low.
 */
export function ProductCard({
  product,
  available,
  onAdd,
}: {
  product: CatalogProduct;
  /** Units still addable given tracked stock minus what's already in the cart. */
  available: number;
  onAdd: (product: CatalogProduct) => void;
}) {
  const t = useTerminalCopy();
  const soldOut = product.soldOut || product.stockCount === 0 || available === 0;
  const showRemaining = isLowStock(product.stockCount) && !soldOut;

  return (
    <motion.button
      type="button"
      disabled={soldOut}
      onClick={() => onAdd(product)}
      whileTap={soldOut ? undefined : { scale: 0.96 }}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-amber-100 bg-white text-left shadow-sm transition-shadow hover:shadow-md disabled:cursor-not-allowed disabled:opacity-45"
    >
      <div className="relative aspect-square w-full overflow-hidden">
        <ProductImage name={product.name} imageUrl={product.imageUrl} />
        {soldOut ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60">
            <span className="rounded-full bg-black/70 px-4 py-1.5 text-sm font-medium text-white">
              {t.menu.soldOut}
            </span>
          </div>
        ) : null}
        {showRemaining ? (
          <span className="absolute right-2 top-2 rounded-full bg-amber-600/95 px-3 py-1 text-xs font-semibold text-white shadow-sm">
            {t.menu.remaining(available)}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 items-end justify-between gap-2 p-4">
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold text-stone-800">{product.name}</div>
          <div className="text-base font-medium text-amber-700">
            {formatEuros(product.priceCents)}
          </div>
        </div>
        {!soldOut ? (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-600 text-white shadow-md transition-colors group-hover:bg-amber-700">
            <Plus className="h-6 w-6" />
          </span>
        ) : null}
      </div>
    </motion.button>
  );
}
