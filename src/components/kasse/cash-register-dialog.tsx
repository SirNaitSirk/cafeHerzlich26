"use client";

import { useMemo, useState } from "react";
import { BanknoteIcon, DeleteIcon, HandCoinsIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatEuros } from "@/lib/format";
import { kasseMessages } from "@/lib/messages";
import { orderDisplayLabel } from "@/lib/order-label";

/**
 * The minimum an order must provide to be settled at the till: the amount due
 * plus what the label needs. Kept structural so both a full `OrderWithItems`
 * (cash queue) and a freshly created order (Kasse order flow) fit.
 */
export type CashRegisterOrder = {
  guestName: string | null;
  orderNumber: number;
  totalCents: number;
  /** True when the goods are handed over right here instead of going to the kitchen. */
  directSale: boolean;
};

const t = kasseMessages.cash.dialog;

/** Common note/coin values (in cents) offered as quick-select chips. */
const QUICK_DENOMINATIONS_CENTS = [500, 1000, 2000, 5000];

/** Sentinel key for the backspace button on the on-screen keypad. */
const KEYPAD_BACKSPACE = "backspace";

/** Digit/comma/backspace layout for the on-screen numeric keypad. */
const KEYPAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", KEYPAD_BACKSPACE] as const;

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
 * Apply one on-screen keypad key to the current amount text, enforcing German
 * euro formatting: a single comma and at most two decimal places. Kept in sync
 * with `parseEurosToCents` so the visible text always stays parseable.
 */
function applyKeypadKey(current: string, key: (typeof KEYPAD_KEYS)[number]): string {
  if (key === KEYPAD_BACKSPACE) {
    return current.slice(0, -1);
  }
  if (key === ",") {
    if (current.includes(",")) return current;
    return current === "" ? "0," : `${current},`;
  }
  // A digit.
  const [whole, decimals] = current.split(",");
  if (decimals !== undefined) {
    if (decimals.length >= 2) return current;
    return `${whole},${decimals}${key}`;
  }
  // No comma yet: replace a lone leading zero instead of stacking "00".
  if (current === "0") return key;
  return `${current}${key}`;
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
  order: CashRegisterOrder;
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
      <DialogContent className="max-h-[95svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg">{t.title}</DialogTitle>
          <p className="text-sm text-muted-foreground">{orderDisplayLabel(order)}</p>
          {order.directSale && (
            <p className="mt-1 flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
              <HandCoinsIcon className="size-4 shrink-0" aria-hidden />
              {t.directSaleHint}
            </p>
          )}
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
          {/* Left: amount display + on-screen keypad (no OS keyboard). */}
          <div className="space-y-3">
            <span id="cash-received-label" className="text-base text-muted-foreground">
              {t.received}
            </span>
            <div
              role="textbox"
              aria-readonly="true"
              aria-labelledby="cash-received-label"
              className="flex h-14 items-center justify-end gap-2 rounded-md border bg-background px-3"
            >
              <span
                className={
                  "text-2xl font-semibold tabular-nums " +
                  (receivedText === "" ? "text-muted-foreground" : "")
                }
              >
                {receivedText === "" ? t.receivedPlaceholder : receivedText}
              </span>
              <span className="text-2xl font-semibold text-muted-foreground">€</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {KEYPAD_KEYS.map((key) => (
                <Button
                  key={key}
                  type="button"
                  variant="outline"
                  onClick={() => setReceivedText((current) => applyKeypadKey(current, key))}
                  aria-label={key === KEYPAD_BACKSPACE ? t.backspace : key}
                  className="h-14 text-2xl font-semibold tabular-nums"
                >
                  {key === KEYPAD_BACKSPACE ? <DeleteIcon className="size-6" /> : key}
                </Button>
              ))}
            </div>
          </div>

          {/* Right: totals, live change, quick amounts. */}
          <div className="space-y-4">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-base text-muted-foreground">{t.toPay}</span>
              <span className="text-2xl font-semibold tabular-nums">
                {formatEuros(order.totalCents)}
              </span>
            </div>

            <div className="flex items-baseline justify-between gap-4 border-t pt-4">
              <span className="text-base text-muted-foreground">{t.change}</span>
              <ChangeAmount changeCents={changeCents} />
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
