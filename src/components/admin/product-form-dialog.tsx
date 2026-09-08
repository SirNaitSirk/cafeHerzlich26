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
import type { AdminCategory, AdminModifierGroup, AdminProduct } from "@/lib/admin-catalog";
import { formatEuros, parseEurosToCents } from "@/lib/format";
import { adminMessages as t } from "@/lib/messages";
import { cn } from "@/lib/utils";

export type ProductFormValues = {
  categoryId: number;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  stockCount: number | null;
  needsPreparation: boolean;
  modifierGroupIds: number[];
};

/** Create/edit dialog for a product. `product` null = create mode. */
export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  categories,
  modifierGroups,
  defaultCategoryId,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: AdminProduct | null;
  categories: AdminCategory[];
  modifierGroups: AdminModifierGroup[];
  defaultCategoryId: number | null;
  onSubmit: (values: ProductFormValues) => Promise<boolean>;
}) {
  const firstCategoryId = product?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? 0;

  const [categoryId, setCategoryId] = useState(firstCategoryId);
  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(product ? formatPrice(product.priceCents) : "");
  const [imageUrl, setImageUrl] = useState<string | null>(product?.imageUrl ?? null);
  const [stock, setStock] = useState(product?.stockCount != null ? String(product.stockCount) : "");
  const [needsPreparation, setNeedsPreparation] = useState(product?.needsPreparation ?? true);
  const [groupIds, setGroupIds] = useState<number[]>(product?.modifierGroupIds ?? []);
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
      setNeedsPreparation(product?.needsPreparation ?? true);
      setGroupIds(product?.modifierGroupIds ?? []);
      setSubmitting(false);
      setPriceError(false);
    }
  }

  // Only active groups are assignable; keep already-assigned ids even if edited.
  const assignableGroups = modifierGroups.filter(
    (group) => group.active || groupIds.includes(group.id),
  );

  const toggleGroup = (id: number) =>
    setGroupIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );

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
      needsPreparation,
      modifierGroupIds: groupIds,
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

          <div className="space-y-1.5">
            <button
              type="button"
              role="switch"
              aria-checked={needsPreparation}
              onClick={() => setNeedsPreparation((value) => !value)}
              className="flex w-full items-center justify-between gap-4 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
            >
              <span className="text-sm font-medium">{t.products.form.preparation}</span>
              <span
                className={cn(
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                  needsPreparation ? "bg-primary" : "bg-input",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 size-5 rounded-full bg-background shadow transition-all",
                    needsPreparation ? "left-[1.375rem]" : "left-0.5",
                  )}
                />
              </span>
            </button>
            <p className="text-xs text-muted-foreground">{t.products.form.preparationHint}</p>
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium">{t.modifiers.assign.label}</span>
            <p className="text-xs text-muted-foreground">{t.modifiers.assign.hint}</p>
            {assignableGroups.length === 0 ? (
              <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                {t.modifiers.assign.none}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {assignableGroups.map((group) => {
                  const active = groupIds.includes(group.id);
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      className={cn(
                        "rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input hover:bg-muted/50",
                      )}
                    >
                      {group.name}
                    </button>
                  );
                })}
              </div>
            )}
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
