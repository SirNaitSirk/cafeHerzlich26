"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { BanknoteIcon } from "lucide-react";

import { CashRegisterDialog } from "@/components/kasse/cash-register-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatEuros } from "@/lib/format";
import { kasseMessages as t } from "@/lib/messages";
import { orderDisplayLabel } from "@/lib/order-label";
import type { OrderWithItems } from "@/lib/orders";

/** One cash order awaiting collection. "Kassiert" releases it into the kitchen. */
export function CashOrderCard({
  order,
  onConfirm,
}: {
  order: OrderWithItems;
  onConfirm: (id: number, directSale: boolean) => Promise<boolean>;
}) {
  const [pending, setPending] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function handleConfirm() {
    setPending(true);
    const ok = await onConfirm(order.id, order.directSale);
    if (ok) {
      setDialogOpen(false); // on success the card animates out
    } else {
      setPending(false);
    }
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
      className="flex flex-col rounded-2xl border-2 border-amber-500/50 bg-card p-4 text-card-foreground shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-2xl font-semibold tracking-tight">
            {orderDisplayLabel(order)}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{t.paymentBadge[order.paymentMethod]}</Badge>
            <Badge variant="ghost">{t.sourceBadge[order.source]}</Badge>
          </div>
        </div>
        <span className="shrink-0 text-2xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
          {formatEuros(order.totalCents)}
        </span>
      </div>

      <ul className="mt-4 space-y-1.5 border-t pt-3 text-lg">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0">
              <span className="font-semibold tabular-nums">{item.quantity}×</span>{" "}
              <span className="text-foreground/90">{item.nameSnapshot}</span>
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

      <Button
        size="lg"
        onClick={() => setDialogOpen(true)}
        disabled={pending}
        className="mt-4 h-14 bg-amber-600 text-base text-white hover:bg-amber-700"
      >
        <BanknoteIcon className="size-5" />
        {t.cash.action}
      </Button>

      <CashRegisterDialog
        order={order}
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!pending) setDialogOpen(open);
        }}
        onConfirm={handleConfirm}
        pending={pending}
      />
    </motion.li>
  );
}
