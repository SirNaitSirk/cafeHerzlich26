"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ChevronLeft } from "lucide-react";
import QRCode from "qrcode";

import { formatEuros } from "@/lib/format";
import { terminalMessages as t } from "@/lib/messages";

/** Builds a PayPal.me link with the amount pre-filled (e.g. .../handle/6.40EUR). */
function paypalUrl(handle: string, totalCents: number): string {
  const amount = (totalCents / 100).toFixed(2);
  return `https://www.paypal.com/paypalme/${encodeURIComponent(handle)}/${amount}EUR`;
}

/** PayPal QR (amount pre-filled) + "Ich habe bezahlt". Order is persisted only on confirm. */
export function PaypalScreen({
  handle,
  totalCents,
  submitting,
  onPaid,
  onBack,
}: {
  handle: string;
  totalCents: number;
  submitting: boolean;
  onPaid: () => void;
  onBack: () => void;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

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
        <p className="max-w-md text-stone-600">{t.paypal.instructions}</p>
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
