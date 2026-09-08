"use client";

import { CheckIcon, EyeIcon, EyeOffIcon, WifiOffIcon } from "lucide-react";
import { toast } from "sonner";

import { ProductImage } from "@/components/terminal/product-image";
import { Button } from "@/components/ui/button";
import type { CatalogCategory, CatalogProduct } from "@/lib/catalog";
import { formatEuros } from "@/lib/format";
import { kasseMessages as t } from "@/lib/messages";
import { cn } from "@/lib/utils";

/**
 * Kasse "Verfügbarkeit" panel: a lean, touch-first list of the active catalog
 * where staff flip a product's manual "sold out today" flag with one tap. It is
 * NOT a product editor — only the soldOut toggle. Changes broadcast
 * `catalog:changed`, so the terminal greys the product out instantly.
 *
 * The catalog is owned by `KasseDashboard` (which stays mounted) and passed in,
 * so this panel always opens on the current state.
 */
export function AvailabilityPanel({
  categories,
  hasError,
  refetchCatalog,
  onExit,
}: {
  categories: CatalogCategory[];
  hasError: boolean;
  refetchCatalog: () => Promise<void>;
  onExit: () => void;
}) {
  async function toggle(product: CatalogProduct) {
    const soldOut = !product.soldOut;
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "availability", soldOut }),
      });
      if (response.ok) {
        toast.success(soldOut ? t.toasts.soldOut : t.toasts.available);
        void refetchCatalog();
        return;
      }
      toast.error(t.toasts.generic);
    } catch {
      toast.error(t.toasts.generic);
    }
  }

  const isEmpty = categories.every((category) => category.products.length === 0);

  return (
    <div className="flex h-dvh flex-col bg-muted/30">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-background/90 px-6 py-4 backdrop-blur">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{t.availability.title}</h1>
          <p className="truncate text-sm text-muted-foreground">{t.availability.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          {hasError && (
            <span className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
              <WifiOffIcon className="size-4" />
              {t.connectionLost}
            </span>
          )}
          <Button size="lg" className="h-12 text-base" onClick={onExit}>
            <CheckIcon className="size-5" />
            {t.availability.done}
          </Button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto p-6">
        {isEmpty ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
            {t.availability.empty}
          </p>
        ) : (
          <div className="space-y-8">
            {categories
              .filter((category) => category.products.length > 0)
              .map((category) => (
                <section key={category.id} className="space-y-3">
                  <h2 className="text-lg font-semibold tracking-tight">{category.name}</h2>
                  <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {category.products.map((product) => (
                      <ProductToggle key={product.id} product={product} onToggle={toggle} />
                    ))}
                  </ul>
                </section>
              ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ProductToggle({
  product,
  onToggle,
}: {
  product: CatalogProduct;
  onToggle: (product: CatalogProduct) => void;
}) {
  const soldOut = product.soldOut;

  return (
    <li>
      <button
        type="button"
        onClick={() => onToggle(product)}
        className={cn(
          "flex w-full items-center gap-4 rounded-2xl border p-3 text-left transition-colors",
          soldOut
            ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
            : "bg-background hover:bg-accent",
        )}
      >
        <div className="relative size-16 shrink-0 overflow-hidden rounded-xl">
          <ProductImage name={product.name} imageUrl={product.imageUrl} />
          {soldOut && <div className="absolute inset-0 bg-background/50" />}
        </div>

        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-base font-medium", soldOut && "text-muted-foreground")}>
            {product.name}
          </p>
          <p className="text-sm text-muted-foreground tabular-nums">
            {formatEuros(product.priceCents)}
          </p>
        </div>

        <span
          className={cn(
            "flex h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-medium",
            soldOut
              ? "bg-amber-600 text-white"
              : "border border-input bg-background text-foreground",
          )}
        >
          {soldOut ? (
            <>
              <EyeIcon className="size-4" />
              {t.availability.markAvailable}
            </>
          ) : (
            <>
              <EyeOffIcon className="size-4" />
              {t.availability.markOut}
            </>
          )}
        </span>
      </button>
    </li>
  );
}
