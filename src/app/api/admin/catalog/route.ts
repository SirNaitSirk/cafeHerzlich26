import { NextResponse } from "next/server";

import { getAdminCatalog } from "@/lib/admin-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Full admin catalog (all categories/products, incl. inactive). Refetched on `catalog:changed`. */
export function GET(): NextResponse {
  return NextResponse.json({ categories: getAdminCatalog() });
}
