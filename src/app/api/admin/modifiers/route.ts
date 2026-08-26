import { NextResponse } from "next/server";

import { createModifier, createModifierSchema } from "@/lib/admin-catalog";
import { broadcast } from "@/lib/events";
import { adminErrorResponse } from "@/app/api/admin/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Creates an option within a group. Broadcasts `catalog:changed`. */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const parsed = createModifierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Daten." }, { status: 400 });
  }

  try {
    const result = createModifier(parsed.data);
    broadcast({ type: "catalog:changed" });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
