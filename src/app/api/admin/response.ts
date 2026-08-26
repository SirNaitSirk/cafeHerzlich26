import { NextResponse } from "next/server";

import { AdminNotFoundError, AdminValidationError } from "@/lib/admin-catalog";
import { UploadValidationError } from "@/lib/uploads";

/** Maps an admin service error to the right HTTP response; rethrows unknown ones. */
export function adminErrorResponse(error: unknown): NextResponse {
  if (error instanceof AdminNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof AdminValidationError || error instanceof UploadValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error("Admin mutation failed:", error);
  return NextResponse.json({ error: "Aktion fehlgeschlagen." }, { status: 500 });
}

/** Parses a positive-integer route param, or null. */
export function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}
