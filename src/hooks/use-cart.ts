"use client";

import { useCallback, useMemo, useState } from "react";

import type { CatalogProduct } from "@/lib/catalog";

export type CartLine = {
  productId: number;
  name: string;
  priceCents: number;
  quantity: number;
};

export type Cart = {
  lines: CartLine[];
  itemCount: number;
  totalCents: number;
  add: (product: CatalogProduct) => void;
  setQuantity: (productId: number, quantity: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
};

/** Terminal cart state: add/remove/adjust quantities with derived totals. */
export function useCart(): Cart {
  const [lines, setLines] = useState<CartLine[]>([]);

  const add = useCallback((product: CatalogProduct) => {
    setLines((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (existing) {
        return current.map((line) =>
          line.productId === product.id
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        );
      }
      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          priceCents: product.priceCents,
          quantity: 1,
        },
      ];
    });
  }, []);

  const setQuantity = useCallback((productId: number, quantity: number) => {
    setLines((current) =>
      quantity <= 0
        ? current.filter((line) => line.productId !== productId)
        : current.map((line) =>
            line.productId === productId ? { ...line, quantity } : line,
          ),
    );
  }, []);

  const remove = useCallback((productId: number) => {
    setLines((current) => current.filter((line) => line.productId !== productId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const { itemCount, totalCents } = useMemo(() => {
    return lines.reduce(
      (acc, line) => ({
        itemCount: acc.itemCount + line.quantity,
        totalCents: acc.totalCents + line.priceCents * line.quantity,
      }),
      { itemCount: 0, totalCents: 0 },
    );
  }, [lines]);

  return { lines, itemCount, totalCents, add, setQuantity, remove, clear };
}
