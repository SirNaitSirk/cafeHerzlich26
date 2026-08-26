"use client";

import { useState } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
} from "lucide-react";

import { ProductFormDialog, type ProductFormValues } from "@/components/admin/product-form-dialog";
import { ProductImage } from "@/components/terminal/product-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminCategory, AdminProduct, Direction } from "@/lib/admin-catalog";
import { formatEuros } from "@/lib/format";
import { adminMessages as t } from "@/lib/messages";
import { cn } from "@/lib/utils";

export type ProductHandlers = {
  onCreate: (values: ProductFormValues) => Promise<boolean>;
  onUpdate: (id: number, values: ProductFormValues) => Promise<boolean>;
  onMove: (id: number, direction: Direction) => Promise<boolean>;
  onToggleActive: (id: number, active: boolean) => Promise<boolean>;
  onSetStock: (id: number, stockCount: number | null) => Promise<boolean>;
};

export function ProductManager({
  categories,
  handlers,
}: {
  categories: AdminCategory[];
  handlers: ProductHandlers;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [presetCategoryId, setPresetCategoryId] = useState<number | null>(null);

  const hasCategories = categories.length > 0;

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

      {categories.map((category) => (
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

          {category.products.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              {t.products.empty}
            </p>
          ) : (
            <ul className="divide-y rounded-2xl border">
              {category.products.map((product, index) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  isFirst={index === 0}
                  isLast={index === category.products.length - 1}
                  handlers={handlers}
                  onEdit={() => openEdit(product)}
                />
              ))}
            </ul>
          )}
        </section>
      ))}

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editing}
        categories={categories}
        defaultCategoryId={presetCategoryId}
        onSubmit={(values) =>
          editing ? handlers.onUpdate(editing.id, values) : handlers.onCreate(values)
        }
      />
    </div>
  );
}

function ProductRow({
  product,
  isFirst,
  isLast,
  handlers,
  onEdit,
}: {
  product: AdminProduct;
  isFirst: boolean;
  isLast: boolean;
  handlers: ProductHandlers;
  onEdit: () => void;
}) {
  const tracked = product.stockCount !== null;

  return (
    <li className={cn("flex items-center gap-3 p-3", !product.active && "opacity-55")}>
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

      <div className="relative size-14 shrink-0 overflow-hidden rounded-xl">
        <ProductImage name={product.name} imageUrl={product.imageUrl} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-medium">{product.name}</p>
        <p className="text-sm text-muted-foreground tabular-nums">
          {formatEuros(product.priceCents)}
        </p>
      </div>

      <StockControl product={product} onSetStock={handlers.onSetStock} tracked={tracked} />

      <Button variant="outline" size="sm" className="h-10" onClick={onEdit}>
        <PencilIcon className="size-4" />
        {t.common.edit}
      </Button>
      {product.active ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-10"
          onClick={() => handlers.onToggleActive(product.id, false)}
        >
          {t.common.deactivate}
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          className="h-10"
          onClick={() => handlers.onToggleActive(product.id, true)}
        >
          {t.common.reactivate}
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
