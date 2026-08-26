"use client";

import { useState } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PencilIcon,
  PlusIcon,
} from "lucide-react";

import {
  ModifierFormDialog,
  type ModifierFormValues,
} from "@/components/admin/modifier-form-dialog";
import {
  ModifierGroupFormDialog,
  type ModifierGroupFormValues,
} from "@/components/admin/modifier-group-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminModifier, AdminModifierGroup, Direction } from "@/lib/admin-catalog";
import { formatEuros } from "@/lib/format";
import { adminMessages as t } from "@/lib/messages";
import { cn } from "@/lib/utils";

export type ModifierHandlers = {
  onCreateGroup: (values: ModifierGroupFormValues) => Promise<boolean>;
  onUpdateGroup: (id: number, values: ModifierGroupFormValues) => Promise<boolean>;
  onMoveGroup: (id: number, direction: Direction) => Promise<boolean>;
  onToggleGroupActive: (id: number, active: boolean) => Promise<boolean>;
  onCreateOption: (groupId: number, values: ModifierFormValues) => Promise<boolean>;
  onUpdateOption: (id: number, values: ModifierFormValues) => Promise<boolean>;
  onMoveOption: (id: number, direction: Direction) => Promise<boolean>;
  onToggleOptionActive: (id: number, active: boolean) => Promise<boolean>;
};

export function ModifierManager({
  groups,
  handlers,
}: {
  groups: AdminModifierGroup[];
  handlers: ModifierHandlers;
}) {
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AdminModifierGroup | null>(null);

  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<AdminModifier | null>(null);
  const [optionGroupId, setOptionGroupId] = useState<number | null>(null);

  function openCreateGroup() {
    setEditingGroup(null);
    setGroupDialogOpen(true);
  }
  function openEditGroup(group: AdminModifierGroup) {
    setEditingGroup(group);
    setGroupDialogOpen(true);
  }
  function openCreateOption(groupId: number) {
    setEditingOption(null);
    setOptionGroupId(groupId);
    setOptionDialogOpen(true);
  }
  function openEditOption(option: AdminModifier) {
    setEditingOption(option);
    setOptionGroupId(option.groupId);
    setOptionDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="max-w-xl text-sm text-muted-foreground">{t.modifiers.description}</p>
        <Button size="lg" className="h-11 shrink-0" onClick={openCreateGroup}>
          <PlusIcon className="size-5" />
          {t.modifiers.addGroup}
        </Button>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
          {t.modifiers.empty}
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map((group, index) => (
            <GroupCard
              key={group.id}
              group={group}
              isFirst={index === 0}
              isLast={index === groups.length - 1}
              handlers={handlers}
              onEditGroup={() => openEditGroup(group)}
              onAddOption={() => openCreateOption(group.id)}
              onEditOption={openEditOption}
            />
          ))}
        </div>
      )}

      <ModifierGroupFormDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        group={editingGroup}
        onSubmit={(values) =>
          editingGroup
            ? handlers.onUpdateGroup(editingGroup.id, values)
            : handlers.onCreateGroup(values)
        }
      />

      <ModifierFormDialog
        open={optionDialogOpen}
        onOpenChange={setOptionDialogOpen}
        modifier={editingOption}
        onSubmit={(values) =>
          editingOption
            ? handlers.onUpdateOption(editingOption.id, values)
            : optionGroupId !== null
              ? handlers.onCreateOption(optionGroupId, values)
              : Promise.resolve(false)
        }
      />
    </div>
  );
}

function GroupCard({
  group,
  isFirst,
  isLast,
  handlers,
  onEditGroup,
  onAddOption,
  onEditOption,
}: {
  group: AdminModifierGroup;
  isFirst: boolean;
  isLast: boolean;
  handlers: ModifierHandlers;
  onEditGroup: () => void;
  onAddOption: () => void;
  onEditOption: (option: AdminModifier) => void;
}) {
  return (
    <section className={cn("rounded-2xl border", !group.active && "opacity-55")}>
      <header className="flex items-center gap-3 border-b p-3">
        <div className="flex flex-col">
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-8"
            disabled={isFirst}
            onClick={() => handlers.onMoveGroup(group.id, "up")}
            aria-label={t.common.moveUp}
          >
            <ChevronUpIcon className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-8"
            disabled={isLast}
            onClick={() => handlers.onMoveGroup(group.id, "down")}
            aria-label={t.common.moveDown}
          >
            <ChevronDownIcon className="size-4" />
          </Button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-lg font-semibold tracking-tight">{group.name}</h3>
            {!group.active && <Badge variant="secondary">{t.common.inactive}</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">
              {group.selectionType === "single"
                ? t.modifiers.selectionType.single
                : t.modifiers.selectionType.multi}
            </Badge>
            {group.required && <Badge variant="outline">{t.modifiers.required}</Badge>}
          </div>
        </div>

        <Button variant="outline" size="sm" className="h-10" onClick={onEditGroup}>
          <PencilIcon className="size-4" />
          {t.common.edit}
        </Button>
        {group.active ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-10"
            onClick={() => handlers.onToggleGroupActive(group.id, false)}
          >
            {t.common.deactivate}
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            className="h-10"
            onClick={() => handlers.onToggleGroupActive(group.id, true)}
          >
            {t.common.reactivate}
          </Button>
        )}
      </header>

      {group.modifiers.length === 0 ? (
        <p className="p-4 text-center text-sm text-muted-foreground">{t.modifiers.noOptions}</p>
      ) : (
        <ul className="divide-y">
          {group.modifiers.map((option, index) => (
            <OptionRow
              key={option.id}
              option={option}
              isFirst={index === 0}
              isLast={index === group.modifiers.length - 1}
              handlers={handlers}
              onEdit={() => onEditOption(option)}
            />
          ))}
        </ul>
      )}

      <div className="border-t p-2">
        <Button variant="ghost" size="sm" className="h-9 w-full" onClick={onAddOption}>
          <PlusIcon className="size-4" />
          {t.modifiers.addOption}
        </Button>
      </div>
    </section>
  );
}

function OptionRow({
  option,
  isFirst,
  isLast,
  handlers,
  onEdit,
}: {
  option: AdminModifier;
  isFirst: boolean;
  isLast: boolean;
  handlers: ModifierHandlers;
  onEdit: () => void;
}) {
  return (
    <li className={cn("flex items-center gap-3 p-3", !option.active && "opacity-55")}>
      <div className="flex flex-col">
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-8"
          disabled={isFirst}
          onClick={() => handlers.onMoveOption(option.id, "up")}
          aria-label={t.common.moveUp}
        >
          <ChevronUpIcon className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-8"
          disabled={isLast}
          onClick={() => handlers.onMoveOption(option.id, "down")}
          aria-label={t.common.moveDown}
        >
          <ChevronDownIcon className="size-4" />
        </Button>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-medium">{option.name}</p>
        <p className="text-sm text-muted-foreground tabular-nums">
          {option.priceDeltaCents > 0 ? `+ ${formatEuros(option.priceDeltaCents)}` : "—"}
        </p>
      </div>

      <Button variant="outline" size="sm" className="h-10" onClick={onEdit}>
        <PencilIcon className="size-4" />
        {t.common.edit}
      </Button>
      {option.active ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-10"
          onClick={() => handlers.onToggleOptionActive(option.id, false)}
        >
          {t.common.deactivate}
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          className="h-10"
          onClick={() => handlers.onToggleOptionActive(option.id, true)}
        >
          {t.common.reactivate}
        </Button>
      )}
    </li>
  );
}
