"use client";

import { useCallback, useMemo, useState } from "react";

import type { CatalogModifier, CatalogProduct } from "@/lib/catalog";

/** A chosen option on a cart line, with its price delta snapshotted for display. */
export type CartModifier = {
  modifierId: number;
  name: string;
  priceDeltaCents: number;
};

export type CartLine = {
  /** Stable identity: product id + the sorted chosen modifier ids. */
  lineId: string;
  productId: number;
  name: string;
  /** Effective unit price: product base price + chosen modifier deltas. */
  priceCents: number;
  quantity: number;
  modifiers: CartModifier[];
};

export type Cart = {
  lines: CartLine[];
  itemCount: number;
  totalCents: number;
  add: (product: CatalogProduct, modifiers?: CartModifier[], quantity?: number) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  remove: (lineId: string) => void;
  clear: () => void;
};

/** Builds the stable line identity from a product and its chosen modifier ids. */
function makeLineId(productId: number, modifiers: CartModifier[]): string {
  const ids = modifiers.map((mod) => mod.modifierId).sort((a, b) => a - b);
  return ids.length === 0 ? `${productId}` : `${productId}:${ids.join(",")}`;
}

/** Terminal cart state: add/remove/adjust quantities with derived totals. */
export function useCart(): Cart {
  const [lines, setLines] = useState<CartLine[]>([]);

  const add = useCallback(
    (product: CatalogProduct, modifiers: CartModifier[] = [], quantity = 1) => {
      const amount = Math.max(1, Math.floor(quantity));
      const deltaSum = modifiers.reduce((sum, mod) => sum + mod.priceDeltaCents, 0);
      const lineId = makeLineId(product.id, modifiers);

      setLines((current) => {
        const existing = current.find((line) => line.lineId === lineId);
        if (existing) {
          return current.map((line) =>
            line.lineId === lineId ? { ...line, quantity: line.quantity + amount } : line,
          );
        }
        return [
          ...current,
          {
            lineId,
            productId: product.id,
            name: product.name,
            priceCents: product.priceCents + deltaSum,
            quantity: amount,
            modifiers,
          },
        ];
      });
    },
    [],
  );

  const setQuantity = useCallback((lineId: string, quantity: number) => {
    setLines((current) =>
      quantity <= 0
        ? current.filter((line) => line.lineId !== lineId)
        : current.map((line) =>
            line.lineId === lineId ? { ...line, quantity } : line,
          ),
    );
  }, []);

  const remove = useCallback((lineId: string) => {
    setLines((current) => current.filter((line) => line.lineId !== lineId));
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

/** Maps a chosen catalog option to the cart's modifier shape. */
export function toCartModifier(modifier: CatalogModifier): CartModifier {
  return {
    modifierId: modifier.id,
    name: modifier.name,
    priceDeltaCents: modifier.priceDeltaCents,
  };
}
