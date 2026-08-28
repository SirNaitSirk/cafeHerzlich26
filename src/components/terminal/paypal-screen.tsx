"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ChevronLeft } from "lucide-react";
import QRCode from "qrcode";

import { useTerminalCopy } from "@/hooks/use-terminal-language";
import { formatEuros } from "@/lib/format";

/**
 * Builds a PayPal.Me link with the amount pre-filled (e.g. paypal.me/handle/6.40).
 * No currency suffix: the mobile PayPal app fails to parse `<amount>EUR` deep links
 * (opens the profile without the amount), while the bare amount is picked up reliably
 * and uses the account's default currency (EUR for a German account).
 */
function paypalUrl(handle: string, totalCents: number): string {
  const amount = (totalCents / 100).toFixed(2);
  return `https://www.paypal.me/${encodeURIComponent(handle)}/${amount}`;
}

/** PayPal QR (amount pre-filled) + "Ich habe bezahlt". Order is persisted only on confirm. */
export function PaypalScreen({
  handle,
  totalCents,
  cafeName,
  guestName,
  submitting,
  onPaid,
  onBack,
}: {
  handle: string;
  totalCents: number;
  cafeName: string;
  guestName: string;
  submitting: boolean;
  onPaid: () => void;
  onBack: () => void;
}) {
  const t = useTerminalCopy();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Suggested payment reference the guest types into PayPal (display only —
  // PayPal.Me cannot pre-fill a note). Falls back to just the café name.
  const reference = guestName.trim() ? `${cafeName} – ${guestName.trim()}` : cafeName;

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(paypalUrl(handle, totalCents), { width: 320, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [handle, totalCents]);

  return (
    <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col px-4 py-4">
      <header className="flex items-center gap-3 pb-2">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-stone-600 shadow-sm disabled:opacity-50"
          aria-label={t.paypal.back}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-2xl font-semibold text-stone-800">{t.paypal.title}</h1>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 text-center">
        <div className="rounded-3xl bg-white p-6 shadow-lg">
          {qrDataUrl ? (
            <motion.img
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              src={qrDataUrl}
              alt="PayPal QR-Code"
              className="h-64 w-64"
            />
          ) : (
            <div className="h-64 w-64 animate-pulse rounded-xl bg-stone-100" />
          )}
        </div>

        <div>
          <div className="text-sm uppercase tracking-wide text-stone-500">
            {t.paypal.amountLabel}
          </div>
          <div className="text-4xl font-bold text-stone-900">{formatEuros(totalCents)}</div>
        </div>

        <p className="max-w-md font-medium text-stone-700">{t.paypal.friendsFamily}</p>

        <div className="w-full max-w-md">
          <div className="text-sm uppercase tracking-wide text-stone-500">
            {t.paypal.referenceLabel}
          </div>
          <div className="mt-1.5 rounded-2xl bg-stone-100 px-5 py-3 text-xl font-semibold text-stone-900">
            {reference}
          </div>
          <p className="mt-1.5 text-sm text-stone-500">{t.paypal.referenceHint}</p>
        </div>
      </div>

      <footer className="pt-4">
        <button
          type="button"
          onClick={onPaid}
          disabled={submitting}
          className="w-full rounded-full bg-emerald-600 py-5 text-lg font-semibold text-white shadow-lg disabled:opacity-60"
        >
          {t.paypal.paid}
        </button>
      </footer>
    </div>
  );
}
