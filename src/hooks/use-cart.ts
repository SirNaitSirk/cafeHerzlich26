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
  /**
   * Adds units. `max`, when given, caps the resulting **product-wide** quantity
   * (summed across all modifier variants of the same product).
   */
  add: (product: CatalogProduct, modifiers?: CartModifier[], quantity?: number, max?: number) => void;
  /** Sets a line's quantity. `max` caps the resulting product-wide quantity. */
  setQuantity: (lineId: string, quantity: number, max?: number) => void;
  remove: (lineId: string) => void;
  clear: () => void;
  /** Total quantity of a product across all its cart lines (all modifier variants). */
  quantityForProduct: (productId: number) => number;
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
    (product: CatalogProduct, modifiers: CartModifier[] = [], quantity = 1, max?: number) => {
      const amount = Math.max(1, Math.floor(quantity));
      const deltaSum = modifiers.reduce((sum, mod) => sum + mod.priceDeltaCents, 0);
      const lineId = makeLineId(product.id, modifiers);

      setLines((current) => {
        const existing = current.find((line) => line.lineId === lineId);
        // Cap against the product-wide total already in the cart.
        const productTotal = current
          .filter((line) => line.productId === product.id)
          .reduce((sum, line) => sum + line.quantity, 0);
        const headroom = max === undefined ? amount : Math.max(0, max - productTotal);
        const grant = Math.min(amount, headroom);
        if (grant <= 0) return current;

        if (existing) {
          return current.map((line) =>
            line.lineId === lineId ? { ...line, quantity: line.quantity + grant } : line,
          );
        }
        return [
          ...current,
          {
            lineId,
            productId: product.id,
            name: product.name,
            priceCents: product.priceCents + deltaSum,
            quantity: grant,
            modifiers,
          },
        ];
      });
    },
    [],
  );

  const setQuantity = useCallback((lineId: string, quantity: number, max?: number) => {
    setLines((current) => {
      if (quantity <= 0) return current.filter((line) => line.lineId !== lineId);
      const target = current.find((line) => line.lineId === lineId);
      if (!target) return current;
      // Cap against the product-wide total from this product's other lines.
      const otherLines = current
        .filter((line) => line.productId === target.productId && line.lineId !== lineId)
        .reduce((sum, line) => sum + line.quantity, 0);
      const capped = max === undefined ? quantity : Math.min(quantity, Math.max(1, max - otherLines));
      return current.map((line) =>
        line.lineId === lineId ? { ...line, quantity: capped } : line,
      );
    });
  }, []);

  const remove = useCallback((lineId: string) => {
    setLines((current) => current.filter((line) => line.lineId !== lineId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const quantityForProduct = useCallback(
    (productId: number) =>
      lines
        .filter((line) => line.productId === productId)
        .reduce((sum, line) => sum + line.quantity, 0),
    [lines],
  );

  const { itemCount, totalCents } = useMemo(() => {
    return lines.reduce(
      (acc, line) => ({
        itemCount: acc.itemCount + line.quantity,
        totalCents: acc.totalCents + line.priceCents * line.quantity,
      }),
      { itemCount: 0, totalCents: 0 },
    );
  }, [lines]);

  return { lines, itemCount, totalCents, add, setQuantity, remove, clear, quantityForProduct };
}

/** Maps a chosen catalog option to the cart's modifier shape. */
export function toCartModifier(modifier: CatalogModifier): CartModifier {
  return {
    modifierId: modifier.id,
    name: modifier.name,
    priceDeltaCents: modifier.priceDeltaCents,
  };
}
