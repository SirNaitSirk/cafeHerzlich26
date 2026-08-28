"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminMessages as t } from "@/lib/messages";
import {
  PICKUP_THEMES,
  PICKUP_THEME_KEYS,
  resolvePickupThemeKey,
} from "@/lib/pickup-themes";
import { cn } from "@/lib/utils";

/** Café-wide settings editor: café name + PayPal handle + pickup-monitor theme. */
export function SettingsForm({ initial }: { initial: Record<string, string> }) {
  const [cafeName, setCafeName] = useState(initial.cafe_name ?? "");
  const [paypalHandle, setPaypalHandle] = useState(initial.paypal_handle ?? "");
  const [pickupTheme, setPickupTheme] = useState(() =>
    resolvePickupThemeKey(initial.pickup_theme),
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cafe_name: cafeName.trim(),
          paypal_handle: paypalHandle.trim(),
          pickup_theme: pickupTheme,
        }),
      });
      if (response.ok) {
        toast.success(t.settings.saved);
      } else {
        toast.error(t.common.generic);
      }
    } catch {
      toast.error(t.common.generic);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <p className="text-sm text-muted-foreground">{t.settings.description}</p>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="cafe-name">
          {t.settings.cafeName}
        </label>
        <Input
          id="cafe-name"
          value={cafeName}
          onChange={(event) => setCafeName(event.target.value)}
          placeholder={t.settings.cafeNamePlaceholder}
          maxLength={60}
          className="h-11"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="paypal-handle">
          {t.settings.paypalHandle}
        </label>
        <Input
          id="paypal-handle"
          value={paypalHandle}
          onChange={(event) => setPaypalHandle(event.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
          placeholder={t.settings.paypalHandlePlaceholder}
          maxLength={60}
          className="h-11"
        />
        <p className="text-xs text-muted-foreground">{t.settings.paypalHandleHint}</p>
        {paypalHandle.trim() && (
          <a
            href={`https://www.paypal.me/${encodeURIComponent(paypalHandle.trim())}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            {t.settings.paypalHandleTest}
          </a>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">{t.settings.pickupTheme}</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PICKUP_THEME_KEYS.map((key) => {
            const theme = PICKUP_THEMES[key];
            const selected = pickupTheme === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={selected}
                onClick={() => setPickupTheme(key)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors",
                  selected
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-input hover:bg-accent",
                )}
              >
                <span
                  className="size-4 shrink-0 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: theme.swatch }}
                />
                {theme.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">{t.settings.pickupThemeHint}</p>
      </div>

      <Button size="lg" className="h-11" onClick={handleSubmit} disabled={submitting}>
        {t.common.save}
      </Button>
    </div>
  );
}
