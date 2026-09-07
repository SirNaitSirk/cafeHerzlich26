"use client";

import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";

import { CartScreen } from "@/components/terminal/cart-screen";
import { LanguageSwitcher } from "@/components/terminal/language-switcher";
import { MenuScreen } from "@/components/terminal/menu-screen";
import { PaymentChoice } from "@/components/terminal/payment-choice";
import { PaypalScreen } from "@/components/terminal/paypal-screen";
import { SuccessScreen } from "@/components/terminal/success-screen";
import { useCart } from "@/hooks/use-cart";
import { useEventStream } from "@/hooks/use-event-stream";
import { useTerminalCopy } from "@/hooks/use-terminal-language";
import type { CatalogCategory } from "@/lib/catalog";
import type { OrderSource, PaymentMethod } from "@/lib/db/schema";
import { orderDisplayLabel } from "@/lib/order-label";

/** The steps of an order, from menu browsing to the confirmation screen. */
type Step = "menu" | "cart" | "payment" | "paypal" | "success";

/** What a host surface learns about an order the moment it was created. */
export type CreatedOrder = {
  id: number;
  orderNumber: number;
  totalCents: number;
  guestName: string | null;
  method: PaymentMethod;
};

/**
 * The shared ordering brain: Menü → Warenkorb → Zahlung → PayPal-QR / Erfolg.
 * Owns the cart, the step machine and the order submission; the hosting surface
 * decides how it is entered and what happens around it:
 *
 * - Terminal wraps it with the welcome/attract screen + idle-timeout (`source: "terminal"`).
 * - Kasse mounts it directly to take an order on behalf of a guest (`source: "kasse"`).
 *
 * `onExit` fires when the guest cancels out of the menu; `onComplete` fires after
 * the success screen. `onOrderCreated` fires the moment the order was accepted by
 * the server — the Kasse uses it to settle a cash order right away. The host
 * provides its own `<Toaster />`.
 */
export function OrderFlow({
  paypalHandle,
  cafeName,
  initialCatalog,
  source,
  onExit,
  onComplete,
  onOrderCreated,
}: {
  paypalHandle: string | null;
  cafeName: string;
  initialCatalog: CatalogCategory[];
  source: OrderSource;
  onExit: () => void;
  onComplete: () => void;
  onOrderCreated?: (order: CreatedOrder) => void;
}) {
  const [categories, setCategories] = useState(initialCatalog);
  const [step, setStep] = useState<Step>("menu");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastOrder, setLastOrder] = useState<{ method: PaymentMethod; label: string } | null>(null);
  const cart = useCart();
  const t = useTerminalCopy();

  // Live stock lookup for the cart's per-line "+" cap. Derived from the catalog
  // so it tracks `catalog:changed` refetches without any frozen local state.
  const stockByProduct = useMemo(() => {
    const map = new Map<number, number | null>();
    for (const category of categories) {
      for (const product of category.products) {
        map.set(product.id, product.stockCount);
      }
    }
    return map;
  }, [categories]);

  const refetchCatalog = useCallback(async () => {
    try {
      const response = await fetch("/api/catalog", { cache: "no-store" });
      if (!response.ok) return;
      const data: { categories: CatalogCategory[] } = await response.json();
      setCategories(data.categories);
    } catch {
      // network hiccup — keep the current catalog
    }
  }, []);

  useEventStream(["catalog:changed"], refetchCatalog);

  const submitOrder = useCallback(
    async (method: PaymentMethod) => {
      if (submitting) return;
      setSubmitting(true);
      try {
        const response = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: cart.lines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
              modifierIds: line.modifiers.map((mod) => mod.modifierId),
            })),
            guestName: name.trim() || undefined,
            paymentMethod: method,
            source,
          }),
        });

        if (response.status === 409) {
          toast.error(t.errors.stock);
          await refetchCatalog();
          setStep("menu");
          return;
        }
        if (!response.ok) {
          toast.error(t.errors.generic);
          return;
        }

        const result: { id: number; orderNumber: number; totalCents: number } =
          await response.json();
        const guestName = name.trim() || null;
        setLastOrder({
          method,
          label: orderDisplayLabel({ guestName, orderNumber: result.orderNumber }),
        });
        onOrderCreated?.({ ...result, guestName, method });
        cart.clear();
        setName("");
        setStep("success");
      } catch {
        toast.error(t.errors.generic);
      } finally {
        setSubmitting(false);
      }
    },
    [cart, name, onOrderCreated, refetchCatalog, source, submitting, t],
  );

  const handlePaymentSelect = useCallback(
    (method: PaymentMethod) => {
      if (method === "paypal") {
        setStep("paypal");
      } else {
        void submitOrder("cash");
      }
    },
    [submitOrder],
  );

  return (
    <div className="relative h-dvh w-full">
      {/* Persistent language switch across every step. Hidden on the Kasse
          (no language provider → single language → LanguageSwitcher renders null). */}
      <div className="absolute right-6 top-6 z-50">
        <LanguageSwitcher variant="compact" />
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="h-dvh w-full"
        >
        {step === "menu" && (
          <MenuScreen
            categories={categories}
            cart={cart}
            onCheckout={() => setStep("cart")}
            onCancel={onExit}
          />
        )}
        {step === "cart" && (
          <CartScreen
            cart={cart}
            stockByProduct={stockByProduct}
            name={name}
            onNameChange={setName}
            onBack={() => setStep("menu")}
            onContinue={() => setStep("payment")}
          />
        )}
        {step === "payment" && (
          <PaymentChoice
            totalCents={cart.totalCents}
            paypalAvailable={!!paypalHandle}
            onSelect={handlePaymentSelect}
            onBack={() => setStep("cart")}
          />
        )}
        {step === "paypal" && paypalHandle && (
          <PaypalScreen
            handle={paypalHandle}
            totalCents={cart.totalCents}
            cafeName={cafeName}
            guestName={name}
            submitting={submitting}
            onPaid={() => void submitOrder("paypal")}
            onBack={() => setStep("payment")}
          />
        )}
        {step === "success" && lastOrder && (
          <SuccessScreen
            method={lastOrder.method}
            orderLabel={lastOrder.label}
            onDone={onComplete}
          />
        )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
