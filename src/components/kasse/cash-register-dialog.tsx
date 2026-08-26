"use client";

import { useMemo, useState } from "react";
import { BanknoteIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatEuros } from "@/lib/format";
import { kasseMessages } from "@/lib/messages";
import { orderDisplayLabel } from "@/lib/order-label";
import type { OrderWithItems } from "@/lib/orders";

const t = kasseMessages.cash.dialog;

/** Common note/coin values (in cents) offered as quick-select chips. */
const QUICK_DENOMINATIONS_CENTS = [500, 1000, 2000, 5000];

/**
 * Parse a German euro input ("5", "5,00", "5.00") into integer cents.
 * Returns null for empty/invalid input so the change line stays hidden.
 */
function parseEurosToCents(input: string): number | null {
  const normalized = input.trim().replace(",", ".");
  if (normalized === "") return null;
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

/**
 * A cash-register dialog: staff enter the amount received and see the change
 * to give back, then confirm collection. Purely a client-side helper — the
 * received/change amounts are not persisted; confirming runs the existing
 * `onConfirm` (PATCH { action: "cash" }).
 */
export function CashRegisterDialog({
  order,
  open,
  onOpenChange,
  onConfirm,
  pending,
}: {
  order: OrderWithItems;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  const [receivedText, setReceivedText] = useState("");

  // Reset the input whenever the dialog re-opens for a fresh collection
  // (adjust-state-during-render, so we don't fire a cascading effect).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setReceivedText("");
  }

  const receivedCents = useMemo(() => parseEurosToCents(receivedText), [receivedText]);
  const changeCents = receivedCents === null ? null : receivedCents - order.totalCents;

  const quickAmounts = QUICK_DENOMINATIONS_CENTS.filter((cents) => cents >= order.totalCents);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">{t.title}</DialogTitle>
          <p className="text-sm text-muted-foreground">{orderDisplayLabel(order)}</p>
        </DialogHeader>

        <div className="flex items-baseline justify-between gap-4">
          <span className="text-base text-muted-foreground">{t.toPay}</span>
          <span className="text-2xl font-semibold tabular-nums">
            {formatEuros(order.totalCents)}
          </span>
        </div>

        <div className="space-y-2">
          <label htmlFor="cash-received" className="text-base text-muted-foreground">
            {t.received}
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="cash-received"
              autoFocus
              inputMode="decimal"
              placeholder={t.receivedPlaceholder}
              value={receivedText}
              onChange={(event) => setReceivedText(event.target.value)}
              className="h-14 text-2xl font-semibold tabular-nums"
            />
            <span className="text-2xl font-semibold text-muted-foreground">€</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setReceivedText((order.totalCents / 100).toFixed(2).replace(".", ","))}
              className="h-12 flex-1 text-base"
            >
              {t.quickExact}
            </Button>
            {quickAmounts.map((cents) => (
              <Button
                key={cents}
                type="button"
                variant="outline"
                onClick={() => setReceivedText((cents / 100).toFixed(2).replace(".", ","))}
                className="h-12 flex-1 text-base tabular-nums"
              >
                {formatEuros(cents)}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-baseline justify-between gap-4 border-t pt-4">
          <span className="text-base text-muted-foreground">{t.change}</span>
          <ChangeAmount changeCents={changeCents} />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            className="h-14 text-base"
          >
            {t.cancel}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="h-14 bg-amber-600 text-base text-white hover:bg-amber-700"
          >
            <BanknoteIcon className="size-5" />
            {kasseMessages.cash.action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The live change readout: green surplus, red shortfall, neutral when exact/empty. */
function ChangeAmount({ changeCents }: { changeCents: number | null }) {
  if (changeCents === null) {
    return <span className="text-2xl font-semibold text-muted-foreground">{t.changePlaceholder}</span>;
  }
  if (changeCents === 0) {
    return <span className="text-lg font-medium text-muted-foreground">{t.exactHint}</span>;
  }
  if (changeCents < 0) {
    return (
      <span className="text-xl font-semibold tabular-nums text-destructive">
        {t.missing} {formatEuros(-changeCents)}
      </span>
    );
  }
  return (
    <span className="text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
      {formatEuros(changeCents)}
    </span>
  );
}
