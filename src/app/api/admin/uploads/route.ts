import { NextResponse } from "next/server";

import { adminErrorResponse } from "@/app/api/admin/response";
import { saveUpload } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stores an uploaded product image and returns its URL. No broadcast here — the
 * image only affects the catalog once it's linked on a product save.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Ungültiger Upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Keine Datei erhalten." }, { status: 400 });
  }

  try {
    const url = await saveUpload(file);
    return NextResponse.json({ url }, { status: 201 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
