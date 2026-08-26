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
import type { AdminModifierGroup } from "@/lib/admin-catalog";
import { adminMessages as t } from "@/lib/messages";
import type { ModifierSelectionType } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

export type ModifierGroupFormValues = {
  name: string;
  selectionType: ModifierSelectionType;
  required: boolean;
};

/** Create/edit dialog for a modifier group. `group` null = create mode. */
export function ModifierGroupFormDialog({
  open,
  onOpenChange,
  group,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: AdminModifierGroup | null;
  onSubmit: (values: ModifierGroupFormValues) => Promise<boolean>;
}) {
  const [name, setName] = useState(group?.name ?? "");
  const [selectionType, setSelectionType] = useState<ModifierSelectionType>(
    group?.selectionType ?? "multi",
  );
  const [required, setRequired] = useState(group?.required ?? false);
  const [submitting, setSubmitting] = useState(false);

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(group?.name ?? "");
      setSelectionType(group?.selectionType ?? "multi");
      setRequired(group?.required ?? false);
      setSubmitting(false);
    }
  }

  const trimmedName = name.trim();
  const canSave = trimmedName !== "";

  async function handleSubmit() {
    if (!canSave) return;
    setSubmitting(true);
    const ok = await onSubmit({ name: trimmedName, selectionType, required });
    setSubmitting(false);
    if (ok) onOpenChange(false);
  }

  const types: { value: ModifierSelectionType; label: string; hint: string }[] = [
    {
      value: "multi",
      label: t.modifiers.selectionType.multi,
      hint: t.modifiers.selectionType.multiHint,
    },
    {
      value: "single",
      label: t.modifiers.selectionType.single,
      hint: t.modifiers.selectionType.singleHint,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {group ? t.modifiers.groupForm.editTitle : t.modifiers.groupForm.createTitle}
          </DialogTitle>
          <DialogDescription>{t.modifiers.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="group-name">
              {t.modifiers.groupForm.name}
            </label>
            <Input
              id="group-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t.modifiers.groupForm.namePlaceholder}
              maxLength={60}
              autoFocus
              className="h-11"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium">{t.modifiers.selectionType.label}</span>
            <div className="grid grid-cols-2 gap-2">
              {types.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setSelectionType(type.value)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    selectionType === type.value
                      ? "border-primary bg-primary/5"
                      : "border-input hover:bg-muted/50",
                  )}
                >
                  <span className="block text-sm font-medium">{type.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{type.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-xl border p-3">
            <input
              type="checkbox"
              checked={required}
              onChange={(event) => setRequired(event.target.checked)}
              className="mt-0.5 size-5 accent-primary"
            />
            <span>
              <span className="block text-sm font-medium">{t.modifiers.requiredLabel}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t.modifiers.requiredHint}
              </span>
            </span>
          </label>
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
