import { NextResponse } from "next/server";

import { getCatalog } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Active catalog for the terminal. Refetched by the client on `catalog:changed`. */
export function GET(): NextResponse {
  return NextResponse.json({ categories: getCatalog() });
}
