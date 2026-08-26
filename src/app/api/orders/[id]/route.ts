import { NextResponse } from "next/server";
import { z } from "zod";

import { broadcast } from "@/lib/events";
import {
  OrderNotFoundError,
  OrderStockError,
  OrderTransitionError,
  OrderValidationError,
  cancelOrder,
  collectOrder,
  confirmCashPayment,
  markOrderReady,
  restoreOrder,
  updateOrder,
  updateOrderSchema,
} from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH body: mark done, confirm cash, mark collected, or apply an edit. */
const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ready") }),
  z.object({ action: z.literal("cash") }),
  z.object({ action: z.literal("collect") }),
  z.object({ action: z.literal("restore") }),
  updateOrderSchema.extend({ action: z.literal("update") }),
]);

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Turns a service error into the right HTTP response; rethrows unknown errors. */
function errorResponse(error: unknown): NextResponse {
  if (error instanceof OrderNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof OrderTransitionError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof OrderStockError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof OrderValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error("Order mutation failed:", error);
  return NextResponse.json({ error: "Aktion fehlgeschlagen." }, { status: 500 });
}

/**
 * Mutates a single order: `{ action: "ready" }` marks it done (→ ready, green on
 * the Abholmonitor), `{ action: "cash" }` confirms cash collected (→ in_kitchen),
 * `{ action: "collect" }` marks a ready order picked up (→ collected),
 * `{ action: "update", ... }` edits items/name. All broadcast `orders:changed`;
 * edits that touched stock also broadcast `catalog:changed`.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ error: "Ungültige Bestellung." }, { status: 400 });
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
    if (parsed.data.action === "ready") {
      markOrderReady(id);
      broadcast({ type: "orders:changed" });
      return NextResponse.json({ ok: true });
    }

    if (parsed.data.action === "cash") {
      confirmCashPayment(id);
      broadcast({ type: "orders:changed" });
      return NextResponse.json({ ok: true });
    }

    if (parsed.data.action === "collect") {
      collectOrder(id);
      broadcast({ type: "orders:changed" });
      return NextResponse.json({ ok: true });
    }

    if (parsed.data.action === "restore") {
      restoreOrder(id);
      broadcast({ type: "orders:changed" });
      broadcast({ type: "catalog:changed" });
      return NextResponse.json({ ok: true });
    }

    const result = updateOrder(id, {
      items: parsed.data.items,
      guestName: parsed.data.guestName,
    });
    broadcast({ type: "orders:changed" });
    if (result.stockChanged) broadcast({ type: "catalog:changed" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Cancels an order (soft): status → cancelled, tracked stock returned. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ error: "Ungültige Bestellung." }, { status: 400 });
  }

  try {
    cancelOrder(id);
    broadcast({ type: "orders:changed" });
    broadcast({ type: "catalog:changed" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
