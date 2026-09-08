"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Trash2Icon, UndoIcon } from "lucide-react";

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
import { kasseMessages as t } from "@/lib/messages";
import { orderDisplayLabel } from "@/lib/order-label";
import type { OrderWithItems } from "@/lib/orders";

/**
 * One order already handed over today. Deliberately muted — it must not compete
 * with the green "Abholbereit" cards.
 *
 * Two kinds live here, so the correction differs: a regular pickup goes back to
 * "Abholbereit" ("Zurückholen"), while a direct sale never was ready and never
 * reached the kitchen — its only correction is a cancellation, which is money
 * changing hands and therefore asks for confirmation first.
 */
export function CollectedOrderCard({
  order,
  onUncollect,
  onCancel,
}: {
  order: OrderWithItems;
  onUncollect: (id: number) => Promise<boolean>;
  onCancel: (id: number) => Promise<boolean>;
}) {
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleUncollect() {
    setPending(true);
    const ok = await onUncollect(order.id);
    if (!ok) setPending(false); // on success the card animates out
  }

  async function handleCancel() {
    setPending(true);
    const ok = await onCancel(order.id);
    if (!ok) {
      setPending(false);
      setConfirmOpen(false);
    }
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
      className="flex items-center justify-between gap-3 rounded-xl border bg-background/60 p-3"
    >
      <div className="min-w-0">
        <h3 className="truncate text-base font-medium text-muted-foreground">
          {orderDisplayLabel(order)}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{t.paymentBadge[order.paymentMethod]}</Badge>
          <Badge variant="ghost">{t.sourceBadge[order.source]}</Badge>
          {order.directSale && (
            <Badge variant="secondary">{t.collected.directSaleBadge}</Badge>
          )}
        </div>
      </div>

      {order.directSale ? (
        <Button
          size="lg"
          variant="outline"
          onClick={() => setConfirmOpen(true)}
          disabled={pending}
          className="h-12 shrink-0"
        >
          <Trash2Icon className="size-5" />
          {t.collected.cancel}
        </Button>
      ) : (
        <Button
          size="lg"
          variant="outline"
          onClick={handleUncollect}
          disabled={pending}
          className="h-12 shrink-0"
        >
          <UndoIcon className="size-5" />
          {t.collected.action}
        </Button>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.collected.confirmCancel.title}</DialogTitle>
            <DialogDescription>
              {t.collected.confirmCancel.description(orderDisplayLabel(order))}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={pending}
            >
              {t.collected.confirmCancel.cancel}
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={pending}>
              {t.collected.confirmCancel.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.li>
  );
}
