"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ShoppingCart, X } from "lucide-react";

import { ProductCard } from "@/components/terminal/product-card";
import type { Cart } from "@/hooks/use-cart";
import type { CatalogCategory, CatalogProduct } from "@/lib/catalog";
import { formatEuros } from "@/lib/format";
import { terminalMessages as t } from "@/lib/messages";

/**
 * Menu step: left category rail, scrollable product grid, persistent cart bar.
 * Structure mirrors the kiosk references; visuals are the café's own warm style.
 */
export function MenuScreen({
  categories,
  cart,
  onCheckout,
  onCancel,
}: {
  categories: CatalogCategory[];
  cart: Cart;
  onCheckout: () => void;
  onCancel: () => void;
}) {
  const [activeId, setActiveId] = useState<number | null>(categories[0]?.id ?? null);
  const active = categories.find((category) => category.id === activeId) ?? categories[0];

  const handleAdd = (product: CatalogProduct) => cart.add(product);

  return (
    <div className="flex h-dvh w-full flex-col bg-amber-50/40">
      <header className="flex items-center justify-between px-6 py-4">
        <h1 className="text-2xl font-semibold text-stone-800">{t.menu.title}</h1>
        <button
          type="button"
          onClick={onCancel}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-stone-500 shadow-sm"
          aria-label={t.payment.back}
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Category rail */}
        <nav className="w-40 shrink-0 overflow-y-auto px-3 py-2 sm:w-48">
          <ul className="flex flex-col gap-2">
            {categories.map((category) => {
              const isActive = category.id === active?.id;
              return (
                <li key={category.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(category.id)}
                    className={`relative w-full rounded-2xl px-4 py-4 text-left text-base font-medium transition-colors ${
                      isActive
                        ? "bg-amber-600 text-white shadow-md"
                        : "bg-white text-stone-600 hover:bg-amber-100"
                    }`}
                  >
                    {category.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Product grid */}
        <main className="min-w-0 flex-1 overflow-y-auto px-4 pb-32 pt-2 sm:px-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={active?.id ?? "none"}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {active && active.products.length > 0 ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                  {active.products.map((product) => (
                    <ProductCard key={product.id} product={product} onAdd={handleAdd} />
                  ))}
                </div>
              ) : (
                <p className="mt-16 text-center text-stone-500">{t.menu.emptyCategory}</p>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Cart bar */}
      <AnimatePresence>
        {cart.itemCount > 0 ? (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="absolute inset-x-0 bottom-0 z-20 p-4"
          >
            <button
              type="button"
              onClick={onCheckout}
              className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 rounded-full bg-amber-600 px-6 py-5 text-white shadow-2xl shadow-amber-900/30"
            >
              <span className="flex items-center gap-3">
                <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/20">
                  <ShoppingCart className="h-5 w-5" />
                  <motion.span
                    key={cart.itemCount}
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1 text-xs font-bold text-amber-700"
                  >
                    {cart.itemCount}
                  </motion.span>
                </span>
                <span className="text-lg font-medium">{t.cart.continue}</span>
              </span>
              <span className="text-xl font-semibold">{formatEuros(cart.totalCents)}</span>
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
