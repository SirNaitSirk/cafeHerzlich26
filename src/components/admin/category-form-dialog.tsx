"use client";

import { useState } from "react";

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
import { adminMessages as t } from "@/lib/messages";

/** Create/edit dialog for a category. `category` null = create mode. */
export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: { id: number; name: string } | null;
  onSubmit: (name: string) => Promise<boolean>;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [submitting, setSubmitting] = useState(false);

  // Reset the field each time the dialog (re)opens (render-time state adjust).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(category?.name ?? "");
      setSubmitting(false);
    }
  }

  const trimmed = name.trim();

  async function handleSubmit() {
    if (!trimmed) return;
    setSubmitting(true);
    const ok = await onSubmit(trimmed);
    setSubmitting(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {category ? t.categories.form.editTitle : t.categories.form.createTitle}
          </DialogTitle>
          <DialogDescription>{t.categories.form.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="category-name">
            {t.categories.form.name}
          </label>
          <Input
            id="category-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t.categories.form.namePlaceholder}
            maxLength={60}
            autoFocus
            className="h-11"
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleSubmit();
            }}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t.common.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !trimmed}>
            {t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
