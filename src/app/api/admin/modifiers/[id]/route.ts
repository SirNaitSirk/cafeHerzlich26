import { NextResponse } from "next/server";
import { z } from "zod";

import {
  moveModifier,
  moveSchema,
  updateModifier,
  updateModifierSchema,
} from "@/lib/admin-catalog";
import { broadcast } from "@/lib/events";
import { adminErrorResponse, parseId } from "@/app/api/admin/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH body: edit fields / toggle active, or reorder within the group. */
const patchSchema = z.discriminatedUnion("action", [
  updateModifierSchema.extend({ action: z.literal("update") }),
  moveSchema.extend({ action: z.literal("move") }),
]);

/** Edits an option or reorders it. Broadcasts `catalog:changed`. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ error: "Ungültige Option." }, { status: 400 });
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
      moveModifier(id, parsed.data.direction);
    } else {
      updateModifier(id, parsed.data);
    }
    broadcast({ type: "catalog:changed" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

/** Soft-deletes an option: active → false. Broadcasts `catalog:changed`. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ error: "Ungültige Option." }, { status: 400 });
  }

  try {
    updateModifier(id, { active: false });
    broadcast({ type: "catalog:changed" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
