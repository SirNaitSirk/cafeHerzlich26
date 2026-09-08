"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, WifiOffIcon } from "lucide-react";
import { toast } from "sonner";

import { CategoryManager, type CategoryHandlers } from "@/components/admin/category-manager";
import { ModifierManager, type ModifierHandlers } from "@/components/admin/modifier-manager";
import { OrderArchive } from "@/components/admin/order-archive";
import { ProductManager, type ProductHandlers } from "@/components/admin/product-manager";
import { SettingsForm } from "@/components/admin/settings-form";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { useAdminCatalog } from "@/hooks/use-admin-catalog";
import { useAdminModifierGroups } from "@/hooks/use-admin-modifier-groups";
import type { AdminCategory, AdminModifierGroup, Direction } from "@/lib/admin-catalog";
import { adminMessages as t } from "@/lib/messages";
import { cn } from "@/lib/utils";
import type { ProductFormValues } from "@/components/admin/product-form-dialog";
import type { ModifierFormValues } from "@/components/admin/modifier-form-dialog";
import type { ModifierGroupFormValues } from "@/components/admin/modifier-group-form-dialog";
import type { OrderWithItems } from "@/lib/orders";

type Tab = "categories" | "products" | "modifiers" | "settings" | "history";

const TABS: { id: Tab; label: string }[] = [
  { id: "categories", label: t.tabs.categories },
  { id: "products", label: t.tabs.products },
  { id: "modifiers", label: t.tabs.modifiers },
  { id: "settings", label: t.tabs.settings },
  { id: "history", label: t.tabs.history },
];

export function AdminDashboard({
  initialCategories,
  initialModifierGroups,
  initialSettings,
  initialArchive,
  showKasseLink = false,
}: {
  initialCategories: AdminCategory[];
  initialModifierGroups: AdminModifierGroup[];
  initialSettings: Record<string, string>;
  initialArchive: OrderWithItems[];
  showKasseLink?: boolean;
}) {
  const { categories, hasError, refetch } = useAdminCatalog(initialCategories);
  const { groups: modifierGroups, hasError: modifierError } =
    useAdminModifierGroups(initialModifierGroups);
  const [tab, setTab] = useState<Tab>("categories");

  /** Fires a mutation, toasts the outcome, and refetches on success. */
  const mutate = useCallback(
    async (
      url: string,
      method: "POST" | "PATCH" | "DELETE",
      body: unknown,
      successMessage?: string,
    ): Promise<boolean> => {
      try {
        const response = await fetch(url, {
          method,
          headers: body === undefined ? undefined : { "Content-Type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (response.ok) {
          if (successMessage) toast.success(successMessage);
          refetch();
          return true;
        }
        toast.error(t.common.generic);
        return false;
      } catch {
        toast.error(t.common.generic);
        return false;
      }
    },
    [refetch],
  );

  const categoryHandlers = useMemo<CategoryHandlers>(
    () => ({
      onCreate: (name) =>
        mutate("/api/admin/categories", "POST", { name }, t.categories.toasts.created),
      onRename: (id, name) =>
        mutate(`/api/admin/categories/${id}`, "PATCH", { action: "update", name }, t.categories.toasts.updated),
      onMove: (id, direction: Direction) =>
        mutate(`/api/admin/categories/${id}`, "PATCH", { action: "move", direction }),
      onToggleActive: (id, active) =>
        active
          ? mutate(`/api/admin/categories/${id}`, "PATCH", { action: "update", active: true }, t.categories.toasts.reactivated)
          : mutate(`/api/admin/categories/${id}`, "DELETE", undefined, t.categories.toasts.deactivated),
      onDelete: (id) =>
        mutate(`/api/admin/categories/${id}?permanent=true`, "DELETE", undefined, t.categories.toasts.deleted),
    }),
    [mutate],
  );

  const productHandlers = useMemo<ProductHandlers>(
    () => ({
      onCreate: (values: ProductFormValues) =>
        mutate("/api/admin/products", "POST", values, t.products.toasts.created),
      onUpdate: (id, values: ProductFormValues) =>
        mutate(`/api/admin/products/${id}`, "PATCH", { action: "update", ...values }, t.products.toasts.updated),
      onMove: (id, direction: Direction) =>
        mutate(`/api/admin/products/${id}`, "PATCH", { action: "move", direction }),
      onToggleActive: (id, active) =>
        active
          ? mutate(`/api/admin/products/${id}`, "PATCH", { action: "update", active: true }, t.products.toasts.reactivated)
          : mutate(`/api/admin/products/${id}`, "DELETE", undefined, t.products.toasts.deactivated),
      onSetStock: (id, stockCount) =>
        mutate(`/api/admin/products/${id}`, "PATCH", { action: "stock", stockCount }, t.products.toasts.stock),
      onSetSoldOut: (id, soldOut) =>
        mutate(
          `/api/admin/products/${id}`,
          "PATCH",
          { action: "availability", soldOut },
          soldOut ? t.products.toasts.soldOut : t.products.toasts.available,
        ),
      onDelete: (id) =>
        mutate(
          `/api/admin/products/${id}?permanent=true`,
          "DELETE",
          undefined,
          t.products.toasts.deleted,
        ),
    }),
    [mutate],
  );

  const modifierHandlers = useMemo<ModifierHandlers>(
    () => ({
      onCreateGroup: (values: ModifierGroupFormValues) =>
        mutate("/api/admin/modifier-groups", "POST", values, t.modifiers.toasts.groupCreated),
      onUpdateGroup: (id, values: ModifierGroupFormValues) =>
        mutate(`/api/admin/modifier-groups/${id}`, "PATCH", { action: "update", ...values }, t.modifiers.toasts.groupUpdated),
      onMoveGroup: (id, direction: Direction) =>
        mutate(`/api/admin/modifier-groups/${id}`, "PATCH", { action: "move", direction }),
      onToggleGroupActive: (id, active) =>
        active
          ? mutate(`/api/admin/modifier-groups/${id}`, "PATCH", { action: "update", active: true }, t.modifiers.toasts.groupReactivated)
          : mutate(`/api/admin/modifier-groups/${id}`, "DELETE", undefined, t.modifiers.toasts.groupDeactivated),
      onCreateOption: (groupId, values: ModifierFormValues) =>
        mutate("/api/admin/modifiers", "POST", { groupId, ...values }, t.modifiers.toasts.optionCreated),
      onUpdateOption: (id, values: ModifierFormValues) =>
        mutate(`/api/admin/modifiers/${id}`, "PATCH", { action: "update", ...values }, t.modifiers.toasts.optionUpdated),
      onMoveOption: (id, direction: Direction) =>
        mutate(`/api/admin/modifiers/${id}`, "PATCH", { action: "move", direction }),
      onToggleOptionActive: (id, active) =>
        active
          ? mutate(`/api/admin/modifiers/${id}`, "PATCH", { action: "update", active: true }, t.modifiers.toasts.optionReactivated)
          : mutate(`/api/admin/modifiers/${id}`, "DELETE", undefined, t.modifiers.toasts.optionDeactivated),
    }),
    [mutate],
  );

  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            {showKasseLink && (
              <Button asChild variant="outline" size="lg" className="h-11">
                <Link href="/kasse">
                  <ArrowLeftIcon className="size-5" />
                  {t.backToKasse}
                </Link>
              </Button>
            )}
            <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
          </div>
          {(hasError || modifierError) && (
            <span className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
              <WifiOffIcon className="size-4" />
              {t.connectionLost}
            </span>
          )}
        </div>
        <div className="mx-auto flex max-w-4xl gap-1 px-6">
          {TABS.map((entry) => (
            <Button
              key={entry.id}
              variant="ghost"
              className={cn(
                "h-11 rounded-none border-b-2 border-transparent px-4 text-base",
                tab === entry.id && "border-primary text-foreground",
              )}
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
            </Button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {tab === "categories" && (
          <CategoryManager categories={categories} handlers={categoryHandlers} />
        )}
        {tab === "products" && (
          <ProductManager
            categories={categories}
            modifierGroups={modifierGroups}
            handlers={productHandlers}
          />
        )}
        {tab === "modifiers" && (
          <ModifierManager groups={modifierGroups} handlers={modifierHandlers} />
        )}
        {tab === "settings" && <SettingsForm initial={initialSettings} />}
        {tab === "history" && <OrderArchive initial={initialArchive} />}
      </main>

      <Toaster position="top-center" richColors />
    </div>
  );
}
