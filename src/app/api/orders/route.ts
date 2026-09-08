import { NextResponse } from "next/server";
import { z } from "zod";

import type { OrderStatus } from "@/lib/db/schema";
import { broadcast } from "@/lib/events";
import {
  CASH_QUEUE_STATUSES,
  KITCHEN_STATUSES,
  OrderStockError,
  OrderValidationError,
  PICKUP_STATUSES,
  READY_STATUSES,
  createOrder,
  createOrderSchema,
  listCollectedToday,
  listOrderArchive,
  listOrderHistory,
  listOrders,
} from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Maps a client-facing scope to the order statuses that surface should show. */
const SCOPE_STATUSES: Record<string, readonly OrderStatus[]> = {
  kitchen: KITCHEN_STATUSES,
  pickup: PICKUP_STATUSES,
  cash: CASH_QUEUE_STATUSES,
  ready: READY_STATUSES,
};

const scopeSchema = z.enum([
  "kitchen",
  "pickup",
  "cash",
  "ready",
  "collected",
  "history",
  "archive",
]);

/**
 * Lists orders for a staff surface. `?scope=kitchen` returns open kitchen orders
 * (with item snapshots), oldest first. `?scope=history` returns today's past
 * orders (done + deleted) for the kitchen history, newest first. `?scope=archive`
 * returns the permanent, all-days admin archive of every order that reached the
 * kitchen, newest first. `?scope=collected` returns today's collected orders —
 * the Kasse undo list for pickups marked by mistake.
 */
export function GET(request: Request): NextResponse {
  const scope = new URL(request.url).searchParams.get("scope");
  const parsed = scopeSchema.safeParse(scope);
  if (!parsed.success) {
    return NextResponse.json({ error: "Unbekannter Bereich." }, { status: 400 });
  }
  let orders;
  if (parsed.data === "history") {
    orders = listOrderHistory();
  } else if (parsed.data === "archive") {
    orders = listOrderArchive();
  } else if (parsed.data === "collected") {
    orders = listCollectedToday();
  } else {
    orders = listOrders({ statuses: SCOPE_STATUSES[parsed.data] });
  }
  return NextResponse.json({ orders });
}

/**
 * Creates an order. The server owns pricing and stock; the client sends only
 * item ids + quantities. On success, broadcasts both `orders:changed` (for the
 * staff screens) and `catalog:changed` (stock changed).
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Bestelldaten." }, { status: 400 });
  }

  try {
    const result = createOrder(parsed.data);
    broadcast({ type: "orders:changed" });
    broadcast({ type: "catalog:changed" });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof OrderStockError) {
      // The terminal is multilingual, so it renders its own copy — it only needs
      // the product and how many units are actually left to trim the cart line.
      return NextResponse.json(
        {
          error: error.message,
          productId: error.productId,
          productName: error.productName,
          available: error.available,
        },
        { status: 409 },
      );
    }
    if (error instanceof OrderValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Order creation failed:", error);
    return NextResponse.json({ error: "Bestellung fehlgeschlagen." }, { status: 500 });
  }
}
