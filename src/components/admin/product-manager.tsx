"use client";

import { useState } from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  EyeIcon,
  EyeOffIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";

import { ProductFormDialog, type ProductFormValues } from "@/components/admin/product-form-dialog";
import { ProductImage } from "@/components/terminal/product-image";
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
import type {
  AdminCategory,
  AdminModifierGroup,
  AdminProduct,
  Direction,
} from "@/lib/admin-catalog";
import { formatEuros } from "@/lib/format";
import { adminMessages as t } from "@/lib/messages";
import { cn } from "@/lib/utils";

export type ProductHandlers = {
  onCreate: (values: ProductFormValues) => Promise<boolean>;
  onUpdate: (id: number, values: ProductFormValues) => Promise<boolean>;
  onMove: (id: number, direction: Direction) => Promise<boolean>;
  onToggleActive: (id: number, active: boolean) => Promise<boolean>;
  onSetStock: (id: number, stockCount: number | null) => Promise<boolean>;
  onSetSoldOut: (id: number, soldOut: boolean) => Promise<boolean>;
  onDelete: (id: number) => Promise<boolean>;
};

export function ProductManager({
  categories,
  modifierGroups,
  handlers,
}: {
  categories: AdminCategory[];
  modifierGroups: AdminModifierGroup[];
  handlers: ProductHandlers;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [presetCategoryId, setPresetCategoryId] = useState<number | null>(null);
  const [expandedArchives, setExpandedArchives] = useState<Record<number, boolean>>({});
  const [deleting, setDeleting] = useState<AdminProduct | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const hasCategories = categories.length > 0;

  function toggleArchive(categoryId: number) {
    setExpandedArchives((current) => ({ ...current, [categoryId]: !current[categoryId] }));
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeletePending(true);
    const ok = await handlers.onDelete(deleting.id);
    setDeletePending(false);
    if (ok) setDeleting(null);
  }

  function openCreate(categoryId: number | null) {
    setEditing(null);
    setPresetCategoryId(categoryId);
    setDialogOpen(true);
  }

  function openEdit(product: AdminProduct) {
    setEditing(product);
    setPresetCategoryId(null);
    setDialogOpen(true);
  }

  if (!hasCategories) {
    return (
      <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
        {t.products.emptyAll}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button size="lg" className="h-11" onClick={() => openCreate(null)}>
          <PlusIcon className="size-5" />
          {t.products.add}
        </Button>
      </div>

      {categories.map((category) => {
        const activeProducts = category.products.filter((product) => product.active);
        const archivedProducts = category.products.filter((product) => !product.active);
        const archiveOpen = expandedArchives[category.id] ?? false;

        return (
          <section key={category.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold tracking-tight">{category.name}</h3>
              {!category.active && <Badge variant="secondary">{t.common.inactive}</Badge>}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-9"
                onClick={() => openCreate(category.id)}
              >
                <PlusIcon className="size-4" />
                {t.products.add}
              </Button>
            </div>

            {activeProducts.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                {t.products.empty}
              </p>
            ) : (
              <ul className="divide-y rounded-2xl border">
                {activeProducts.map((product, index) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    isFirst={index === 0}
                    isLast={index === activeProducts.length - 1}
                    archived={false}
                    handlers={handlers}
                    onEdit={() => openEdit(product)}
                    onDelete={() => setDeleting(product)}
                  />
                ))}
              </ul>
            )}

            {archivedProducts.length > 0 && (
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-muted-foreground"
                  aria-expanded={archiveOpen}
                  onClick={() => toggleArchive(category.id)}
                >
                  {archiveOpen ? (
                    <ChevronDownIcon className="size-4" />
                  ) : (
                    <ChevronRightIcon className="size-4" />
                  )}
                  {t.products.archive.heading(archivedProducts.length)}
                </Button>

                {archiveOpen && (
                  <>
                    <p className="px-1 text-sm text-muted-foreground">
                      {t.products.archive.hint}
                    </p>
                    <ul className="divide-y rounded-2xl border">
                      {archivedProducts.map((product) => (
                        <ProductRow
                          key={product.id}
                          product={product}
                          isFirst
                          isLast
                          archived
                          handlers={handlers}
                          onEdit={() => openEdit(product)}
                          onDelete={() => setDeleting(product)}
                        />
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </section>
        );
      })}

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editing}
        categories={categories}
        modifierGroups={modifierGroups}
        defaultCategoryId={presetCategoryId}
        onSubmit={(values) =>
          editing ? handlers.onUpdate(editing.id, values) : handlers.onCreate(values)
        }
      />

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.products.confirmDelete.title}</DialogTitle>
            <DialogDescription>
              {deleting && t.products.confirmDelete.description(deleting.name)}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deletePending}>
              {t.products.confirmDelete.cancel}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deletePending}>
              {t.products.confirmDelete.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductRow({
  product,
  isFirst,
  isLast,
  archived,
  handlers,
  onEdit,
  onDelete,
}: {
  product: AdminProduct;
  isFirst: boolean;
  isLast: boolean;
  /** Archived rows drop reordering, stock and availability — only edit, reactivate, delete. */
  archived: boolean;
  handlers: ProductHandlers;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const tracked = product.stockCount !== null;

  return (
    <li
      className={cn(
        "flex items-center gap-3 p-3",
        !product.active && "opacity-55",
        product.soldOut && "bg-amber-50 dark:bg-amber-950/30",
      )}
    >
      {!archived && (
        <div className="flex flex-col">
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-8"
            disabled={isFirst}
            onClick={() => handlers.onMove(product.id, "up")}
            aria-label={t.common.moveUp}
          >
            <ChevronUpIcon className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-8"
            disabled={isLast}
            onClick={() => handlers.onMove(product.id, "down")}
            aria-label={t.common.moveDown}
          >
            <ChevronDownIcon className="size-4" />
          </Button>
        </div>
      )}

      <div className="relative size-14 shrink-0 overflow-hidden rounded-xl">
        <ProductImage name={product.name} imageUrl={product.imageUrl} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-base font-medium">{product.name}</p>
          {product.soldOut && (
            <Badge className="border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              {t.products.availability.badge}
            </Badge>
          )}
          {!product.needsPreparation && (
            <Badge variant="secondary">{t.products.directSaleBadge}</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">
          {formatEuros(product.priceCents)}
        </p>
      </div>

      {!archived && (
        <>
          <StockControl product={product} onSetStock={handlers.onSetStock} tracked={tracked} />

          {product.soldOut ? (
            <Button
              variant="secondary"
              size="sm"
              className="h-10"
              onClick={() => handlers.onSetSoldOut(product.id, false)}
            >
              <EyeIcon className="size-4" />
              {t.products.availability.markAvailable}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-10"
              onClick={() => handlers.onSetSoldOut(product.id, true)}
            >
              <EyeOffIcon className="size-4" />
              {t.products.availability.markOut}
            </Button>
          )}
        </>
      )}

      <Button variant="outline" size="sm" className="h-10" onClick={onEdit}>
        <PencilIcon className="size-4" />
        {t.common.edit}
      </Button>
      {archived ? (
        <>
          <Button
            variant="secondary"
            size="sm"
            className="h-10"
            onClick={() => handlers.onToggleActive(product.id, true)}
          >
            {t.common.reactivate}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-10 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2Icon className="size-4" />
            {t.common.deleteForever}
          </Button>
        </>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="h-10"
          onClick={() => handlers.onToggleActive(product.id, false)}
        >
          {t.common.deactivate}
        </Button>
      )}
    </li>
  );
}

function StockControl({
  product,
  tracked,
  onSetStock,
}: {
  product: AdminProduct;
  tracked: boolean;
  onSetStock: (id: number, stockCount: number | null) => Promise<boolean>;
}) {
  if (!tracked) {
    return (
      <Badge variant="outline" className="h-8 px-3">
        {t.products.stock.unlimited}
      </Badge>
    );
  }

  const count = product.stockCount ?? 0;

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="icon-sm"
        className="size-8"
        disabled={count === 0}
        onClick={() => onSetStock(product.id, Math.max(0, count - 1))}
        aria-label={t.common.moveDown}
      >
        <MinusIcon className="size-4" />
      </Button>
      <span
        className={cn(
          "w-8 text-center text-sm font-semibold tabular-nums",
          count === 0 && "text-destructive",
        )}
        title={count === 0 ? t.products.stock.soldOut : undefined}
      >
        {count}
      </span>
      <Button
        variant="outline"
        size="icon-sm"
        className="size-8"
        onClick={() => onSetStock(product.id, count + 1)}
        aria-label={t.common.moveUp}
      >
        <PlusIcon className="size-4" />
      </Button>
    </div>
  );
}
