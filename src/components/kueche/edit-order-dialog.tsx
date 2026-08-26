"use client";

import { useMemo, useState } from "react";
import { MinusIcon, PlusIcon } from "lucide-react";

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
import { formatEuros } from "@/lib/format";
import { kitchenMessages as t } from "@/lib/messages";
import type { OrderWithItems, UpdateOrderInput } from "@/lib/orders";
import { cn } from "@/lib/utils";

/** Draft quantity per order item while editing (0 = removed). */
type Draft = { orderItemId: number; name: string; unitPriceCents: number; quantity: number };

const MAX_QUANTITY = 99;

export function EditOrderDialog({
  order,
  open,
  onOpenChange,
  onSubmit,
}: {
  order: OrderWithItems;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: UpdateOrderInput) => Promise<boolean>;
}) {
  function initialDrafts(): Draft[] {
    return order.items.map((item) => ({
      orderItemId: item.id,
      name: item.nameSnapshot,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
    }));
  }

  const [drafts, setDrafts] = useState<Draft[]>(initialDrafts);
  const [name, setName] = useState(order.guestName ?? "");
  const [submitting, setSubmitting] = useState(false);

  // Reset the draft from the order each time the dialog (re)opens — the React-blessed
  // "adjust state during render" pattern, so no setState-in-effect is needed.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDrafts(initialDrafts());
      setName(order.guestName ?? "");
      setSubmitting(false);
    }
  }

  const totalCents = useMemo(
    () => drafts.reduce((sum, draft) => sum + draft.unitPriceCents * draft.quantity, 0),
    [drafts],
  );
  const allRemoved = drafts.every((draft) => draft.quantity === 0);

  function setQuantity(orderItemId: number, quantity: number) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.orderItemId === orderItemId
          ? { ...draft, quantity: Math.max(0, Math.min(MAX_QUANTITY, quantity)) }
          : draft,
      ),
    );
  }

  async function handleSubmit() {
    setSubmitting(true);
    const ok = await onSubmit({
      items: drafts.map((draft) => ({
        orderItemId: draft.orderItemId,
        quantity: draft.quantity,
      })),
      guestName: name.trim() || null,
    });
    setSubmitting(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.edit.title}</DialogTitle>
          <DialogDescription>{t.edit.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t.edit.namePlaceholder}
            maxLength={40}
            className="h-11"
          />
        </div>

        <ul className="space-y-2">
          {drafts.map((draft) => (
            <li
              key={draft.orderItemId}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border p-2.5 transition-opacity",
                draft.quantity === 0 && "opacity-40",
              )}
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{draft.name}</p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {formatEuros(draft.unitPriceCents)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-10"
                  onClick={() => setQuantity(draft.orderItemId, draft.quantity - 1)}
                  disabled={draft.quantity === 0}
                  aria-label="Weniger"
                >
                  <MinusIcon className="size-4" />
                </Button>
                <span className="w-8 text-center text-lg font-semibold tabular-nums">
                  {draft.quantity}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-10"
                  onClick={() => setQuantity(draft.orderItemId, draft.quantity + 1)}
                  disabled={draft.quantity >= MAX_QUANTITY}
                  aria-label="Mehr"
                >
                  <PlusIcon className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between px-1">
          <span className="text-sm text-muted-foreground">{t.edit.total}</span>
          <span className="text-lg font-semibold tabular-nums">{formatEuros(totalCents)}</span>
        </div>

        {allRemoved && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {t.edit.emptyWarning}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t.actions.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {t.actions.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
