"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { CheckIcon, PencilIcon, Trash2Icon } from "lucide-react";

import { EditOrderDialog } from "@/components/kueche/edit-order-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWaitTimer } from "@/hooks/use-wait-timer";
import { formatEuros } from "@/lib/format";
import { kitchenMessages as t } from "@/lib/messages";
import { orderDisplayLabel } from "@/lib/order-label";
import type { OrderWithItems, UpdateOrderInput } from "@/lib/orders";
import { cn } from "@/lib/utils";
import type { WaitLevel } from "@/lib/wait";

/** Per-urgency styling for the card frame and the timer read-out. */
const LEVEL_STYLES: Record<WaitLevel, { card: string; timer: string; dot: string }> = {
  calm: { card: "border-border", timer: "text-foreground", dot: "bg-emerald-500" },
  warning: {
    card: "border-amber-500/60 bg-amber-50/60 dark:bg-amber-950/20",
    timer: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  critical: {
    card: "border-red-500/70 bg-red-50/60 dark:bg-red-950/20",
    timer: "text-red-600 dark:text-red-400",
    dot: "bg-red-500 animate-pulse motion-reduce:animate-none",
  },
};

export function OrderCard({
  order,
  onDone,
  onDelete,
  onUpdate,
}: {
  order: OrderWithItems;
  onDone: (id: number) => Promise<boolean>;
  onDelete: (id: number) => Promise<boolean>;
  onUpdate: (id: number, input: UpdateOrderInput) => Promise<boolean>;
}) {
  const { label, level } = useWaitTimer(order.createdAt);
  const styles = LEVEL_STYLES[level];
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pending, setPending] = useState<"done" | "delete" | null>(null);

  async function handleDone() {
    setPending("done");
    const ok = await onDone(order.id);
    if (!ok) setPending(null); // on success the card animates out
  }

  async function handleDelete() {
    setPending("delete");
    const ok = await onDelete(order.id);
    setPending(null);
    if (ok) setConfirmOpen(false);
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
      className={cn(
        "flex flex-col rounded-2xl border-2 bg-card p-4 text-card-foreground shadow-sm",
        styles.card,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-semibold tracking-tight">
            {orderDisplayLabel(order)}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{t.paymentBadge[order.paymentMethod]}</Badge>
            <Badge variant="ghost">{t.sourceBadge[order.source]}</Badge>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="flex items-center justify-end gap-1.5">
            <span className={cn("size-2 rounded-full", styles.dot)} aria-hidden />
            <span
              className={cn("font-mono text-3xl font-semibold tabular-nums", styles.timer)}
            >
              {label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{t.waitLabel}</p>
        </div>
      </div>

      <ul className="mt-4 space-y-1.5 border-t pt-3 text-lg">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-baseline justify-between gap-3">
            {/* Items nobody has to prepare (a chocolate bar, a can of cola) stay in
                the list — they still belong on the tray — but recede so the eye
                lands on what actually has to be made. */}
            <span className={cn("min-w-0", !item.needsPreparation && "text-muted-foreground")}>
              <span className="font-semibold tabular-nums">{item.quantity}×</span>{" "}
              <span className={cn(!item.needsPreparation ? undefined : "text-foreground/90")}>
                {item.nameSnapshot}
              </span>
              {!item.needsPreparation && (
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 align-middle text-xs font-medium">
                  {t.directItem}
                </span>
              )}
              {item.modifiers.length > 0 ? (
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {item.modifiers.map((mod) => `+ ${mod.nameSnapshot}`).join(", ")}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {formatEuros(item.unitPriceCents * item.quantity)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between border-t pt-3">
        <span className="text-sm text-muted-foreground">{t.edit.total}</span>
        <span className="text-lg font-semibold tabular-nums">
          {formatEuros(order.totalCents)}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-2">
        <Button
          size="lg"
          onClick={handleDone}
          disabled={pending !== null}
          className="h-14 bg-emerald-600 text-base text-white hover:bg-emerald-700"
        >
          <CheckIcon className="size-5" />
          {t.actions.done}
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-14 px-4"
          onClick={() => setEditOpen(true)}
          disabled={pending !== null}
          aria-label={t.actions.edit}
        >
          <PencilIcon className="size-5" />
        </Button>
        <Button
          size="lg"
          variant="destructive"
          className="h-14 px-4"
          onClick={() => setConfirmOpen(true)}
          disabled={pending !== null}
          aria-label={t.actions.delete}
        >
          <Trash2Icon className="size-5" />
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.confirmDelete.title}</DialogTitle>
            <DialogDescription>
              {t.confirmDelete.description(orderDisplayLabel(order))}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={pending === "delete"}
            >
              {t.confirmDelete.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={pending === "delete"}
            >
              {t.confirmDelete.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditOrderDialog
        order={order}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSubmit={(input) => onUpdate(order.id, input)}
      />
    </motion.li>
  );
}
