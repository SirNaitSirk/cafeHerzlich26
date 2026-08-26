"use client";

import { useState } from "react";

import { ImageUpload } from "@/components/admin/image-upload";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { AdminCategory, AdminProduct } from "@/lib/admin-catalog";
import { formatEuros, parseEurosToCents } from "@/lib/format";
import { adminMessages as t } from "@/lib/messages";

export type ProductFormValues = {
  categoryId: number;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  stockCount: number | null;
};

/** Create/edit dialog for a product. `product` null = create mode. */
export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  categories,
  defaultCategoryId,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: AdminProduct | null;
  categories: AdminCategory[];
  defaultCategoryId: number | null;
  onSubmit: (values: ProductFormValues) => Promise<boolean>;
}) {
  const firstCategoryId = product?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? 0;

  const [categoryId, setCategoryId] = useState(firstCategoryId);
  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(product ? formatPrice(product.priceCents) : "");
  const [imageUrl, setImageUrl] = useState<string | null>(product?.imageUrl ?? null);
  const [stock, setStock] = useState(product?.stockCount != null ? String(product.stockCount) : "");
  const [submitting, setSubmitting] = useState(false);
  const [priceError, setPriceError] = useState(false);

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setCategoryId(firstCategoryId);
      setName(product?.name ?? "");
      setPrice(product ? formatPrice(product.priceCents) : "");
      setImageUrl(product?.imageUrl ?? null);
      setStock(product?.stockCount != null ? String(product.stockCount) : "");
      setSubmitting(false);
      setPriceError(false);
    }
  }

  const trimmedName = name.trim();
  const canSave = trimmedName !== "" && categoryId > 0;

  async function handleSubmit() {
    const priceCents = parseEurosToCents(price);
    if (priceCents === null) {
      setPriceError(true);
      return;
    }
    if (!canSave) return;

    const stockTrimmed = stock.trim();
    const stockCount = stockTrimmed === "" ? null : Math.max(0, Math.floor(Number(stockTrimmed)));

    setSubmitting(true);
    const ok = await onSubmit({
      categoryId,
      name: trimmedName,
      priceCents,
      imageUrl,
      stockCount: Number.isNaN(stockCount as number) ? null : stockCount,
    });
    setSubmitting(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {product ? t.products.form.editTitle : t.products.form.createTitle}
          </DialogTitle>
          <DialogDescription>{t.products.form.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="product-name">
              {t.products.form.name}
            </label>
            <Input
              id="product-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t.products.form.namePlaceholder}
              maxLength={60}
              autoFocus
              className="h-11"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="product-category">
                {t.products.form.category}
              </label>
              <select
                id="product-category"
                value={categoryId}
                onChange={(event) => setCategoryId(Number(event.target.value))}
                className="h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                    {category.active ? "" : ` (${t.common.inactive})`}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="product-price">
                {t.products.form.price}
              </label>
              <Input
                id="product-price"
                value={price}
                inputMode="decimal"
                onChange={(event) => {
                  setPrice(event.target.value);
                  setPriceError(false);
                }}
                placeholder={t.products.form.pricePlaceholder}
                className="h-11"
                aria-invalid={priceError}
              />
            </div>
          </div>
          {priceError && (
            <p className="text-sm text-destructive">{t.products.form.priceInvalid}</p>
          )}

          <div className="space-y-1.5">
            <span className="text-sm font-medium">{t.products.form.image}</span>
            <ImageUpload value={imageUrl} onChange={setImageUrl} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="product-stock">
              {t.products.form.stock}
            </label>
            <Input
              id="product-stock"
              value={stock}
              inputMode="numeric"
              onChange={(event) => setStock(event.target.value.replace(/[^0-9]/g, ""))}
              placeholder={t.products.form.stockPlaceholder}
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">{t.products.form.stockHint}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t.common.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !canSave}>
            {t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Price cents → a plain German number string for the input (no currency symbol). */
function formatPrice(cents: number): string {
  return formatEuros(cents).replace(/\s?€/, "").trim();
}
