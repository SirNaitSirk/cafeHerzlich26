import { NextResponse } from "next/server";
import { z } from "zod";

import {
  moveProduct,
  moveSchema,
  setProductSoldOut,
  setProductStock,
  setSoldOutSchema,
  setStockSchema,
  updateProduct,
  updateProductSchema,
} from "@/lib/admin-catalog";
import { broadcast } from "@/lib/events";
import { adminErrorResponse, parseId } from "@/app/api/admin/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH body: edit fields / toggle active, adjust stock, toggle availability, or reorder. */
const patchSchema = z.discriminatedUnion("action", [
  updateProductSchema.extend({ action: z.literal("update") }),
  setStockSchema.extend({ action: z.literal("stock") }),
  setSoldOutSchema.extend({ action: z.literal("availability") }),
  moveSchema.extend({ action: z.literal("move") }),
]);

/** Edits a product, adjusts its stock, or reorders it. Broadcasts `catalog:changed`. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ error: "Ungültiges Produkt." }, { status: 400 });
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
      moveProduct(id, parsed.data.direction);
    } else if (parsed.data.action === "stock") {
      setProductStock(id, parsed.data.stockCount);
    } else if (parsed.data.action === "availability") {
      setProductSoldOut(id, parsed.data.soldOut);
    } else {
      updateProduct(id, parsed.data);
    }
    broadcast({ type: "catalog:changed" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

/** Soft-deletes a product: active → false. Broadcasts `catalog:changed`. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ error: "Ungültiges Produkt." }, { status: 400 });
  }

  try {
    updateProduct(id, { active: false });
    broadcast({ type: "catalog:changed" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
