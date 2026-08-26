"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { AdminModifier } from "@/lib/admin-catalog";
import { formatEuros, parseEurosToCents } from "@/lib/format";
import { adminMessages as t } from "@/lib/messages";

export type ModifierFormValues = {
  name: string;
  priceDeltaCents: number;
};

/** Create/edit dialog for a single option within a group. `modifier` null = create. */
export function ModifierFormDialog({
  open,
  onOpenChange,
  modifier,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modifier: AdminModifier | null;
  onSubmit: (values: ModifierFormValues) => Promise<boolean>;
}) {
  const [name, setName] = useState(modifier?.name ?? "");
  const [price, setPrice] = useState(modifier ? formatPrice(modifier.priceDeltaCents) : "");
  const [submitting, setSubmitting] = useState(false);
  const [priceError, setPriceError] = useState(false);

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(modifier?.name ?? "");
      setPrice(modifier ? formatPrice(modifier.priceDeltaCents) : "");
      setSubmitting(false);
      setPriceError(false);
    }
  }

  const trimmedName = name.trim();
  const canSave = trimmedName !== "";

  async function handleSubmit() {
    // Empty price = no surcharge.
    const priceDeltaCents = price.trim() === "" ? 0 : parseEurosToCents(price);
    if (priceDeltaCents === null) {
      setPriceError(true);
      return;
    }
    if (!canSave) return;

    setSubmitting(true);
    const ok = await onSubmit({ name: trimmedName, priceDeltaCents });
    setSubmitting(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {modifier ? t.modifiers.optionForm.editTitle : t.modifiers.optionForm.createTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="option-name">
              {t.modifiers.optionForm.name}
            </label>
            <Input
              id="option-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t.modifiers.optionForm.namePlaceholder}
              maxLength={60}
              autoFocus
              className="h-11"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="option-price">
              {t.modifiers.optionForm.price}
            </label>
            <Input
              id="option-price"
              value={price}
              inputMode="decimal"
              onChange={(event) => {
                setPrice(event.target.value);
                setPriceError(false);
              }}
              placeholder={t.modifiers.optionForm.pricePlaceholder}
              className="h-11"
              aria-invalid={priceError}
            />
            {priceError && (
              <p className="text-sm text-destructive">{t.modifiers.optionForm.priceInvalid}</p>
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
