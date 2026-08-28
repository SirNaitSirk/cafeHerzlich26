"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { CategoryFormDialog } from "@/components/admin/category-form-dialog";
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
import type { AdminCategory, Direction } from "@/lib/admin-catalog";
import { adminMessages as t } from "@/lib/messages";
import { cn } from "@/lib/utils";

export type CategoryHandlers = {
  onCreate: (name: string) => Promise<boolean>;
  onRename: (id: number, name: string) => Promise<boolean>;
  onMove: (id: number, direction: Direction) => Promise<boolean>;
  onToggleActive: (id: number, active: boolean) => Promise<boolean>;
  onDelete: (id: number) => Promise<boolean>;
};

export function CategoryManager({
  categories,
  handlers,
}: {
  categories: AdminCategory[];
  handlers: CategoryHandlers;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [deleting, setDeleting] = useState<AdminCategory | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(category: AdminCategory) {
    setEditing(category);
    setDialogOpen(true);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeletePending(true);
    const ok = await handlers.onDelete(deleting.id);
    setDeletePending(false);
    if (ok) setDeleting(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{t.categories.count(categories.length)}</p>
        <Button size="lg" className="h-11" onClick={openCreate}>
          <PlusIcon className="size-5" />
          {t.categories.add}
        </Button>
      </div>

      {categories.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
          {t.categories.empty}
        </p>
      ) : (
        <ul className="divide-y rounded-2xl border">
          {categories.map((category, index) => (
            <li
              key={category.id}
              className={cn(
                "flex items-center gap-3 p-3",
                !category.active && "opacity-55",
              )}
            >
              <div className="flex flex-col">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-8"
                  disabled={index === 0}
                  onClick={() => handlers.onMove(category.id, "up")}
                  aria-label={t.common.moveUp}
                >
                  <ChevronUpIcon className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-8"
                  disabled={index === categories.length - 1}
                  onClick={() => handlers.onMove(category.id, "down")}
                  aria-label={t.common.moveDown}
                >
                  <ChevronDownIcon className="size-4" />
                </Button>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-lg font-medium">{category.name}</p>
                  {!category.active && (
                    <Badge variant="secondary">{t.common.inactive}</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {t.categories.productCount(category.products.length)}
                </p>
              </div>

              <Button variant="outline" size="sm" className="h-10" onClick={() => openEdit(category)}>
                <PencilIcon className="size-4" />
                {t.common.edit}
              </Button>
              {category.active ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10"
                  onClick={() => handlers.onToggleActive(category.id, false)}
                >
                  {t.common.deactivate}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-10"
                  onClick={() => handlers.onToggleActive(category.id, true)}
                >
                  {t.common.reactivate}
                </Button>
              )}
              {category.products.length === 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 text-destructive hover:text-destructive"
                  onClick={() => setDeleting(category)}
                >
                  <Trash2Icon className="size-4" />
                  {t.common.deleteForever}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <CategoryFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={editing}
        onSubmit={(name) =>
          editing ? handlers.onRename(editing.id, name) : handlers.onCreate(name)
        }
      />

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.categories.confirmDelete.title}</DialogTitle>
            <DialogDescription>
              {deleting && t.categories.confirmDelete.description(deleting.name)}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={deletePending}
            >
              {t.categories.confirmDelete.cancel}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deletePending}>
              {t.categories.confirmDelete.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
