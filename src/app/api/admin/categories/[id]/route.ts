import { NextResponse } from "next/server";
import { z } from "zod";

import {
  moveCategory,
  moveSchema,
  updateCategory,
  updateCategorySchema,
} from "@/lib/admin-catalog";
import { broadcast } from "@/lib/events";
import { adminErrorResponse, parseId } from "@/app/api/admin/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH body: edit fields / toggle active, or reorder. */
const patchSchema = z.discriminatedUnion("action", [
  updateCategorySchema.extend({ action: z.literal("update") }),
  moveSchema.extend({ action: z.literal("move") }),
]);

/** Edits a category, toggles its active flag, or reorders it. Broadcasts `catalog:changed`. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ error: "Ungültige Kategorie." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Daten." }, { status: 400 });
  }

  try {
    if (parsed.data.action === "move") {
      moveCategory(id, parsed.data.direction);
    } else {
      updateCategory(id, { name: parsed.data.name, active: parsed.data.active });
    }
    broadcast({ type: "catalog:changed" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

/** Soft-deletes a category: active → false. Broadcasts `catalog:changed`. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ error: "Ungültige Kategorie." }, { status: 400 });
  }

  try {
    updateCategory(id, { active: false });
    broadcast({ type: "catalog:changed" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
