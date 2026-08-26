"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminMessages as t } from "@/lib/messages";

/** Café-wide settings editor: café name + PayPal handle for the QR. */
export function SettingsForm({ initial }: { initial: Record<string, string> }) {
  const [cafeName, setCafeName] = useState(initial.cafe_name ?? "");
  const [paypalHandle, setPaypalHandle] = useState(initial.paypal_handle ?? "");
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
      </div>

      <Button size="lg" className="h-11" onClick={handleSubmit} disabled={submitting}>
        {t.common.save}
      </Button>
    </div>
  );
}
