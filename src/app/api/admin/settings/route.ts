import { NextResponse } from "next/server";
import { z } from "zod";

import { broadcast } from "@/lib/events";
import { getSettings, setSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  cafe_name: z.string().trim().max(60).optional(),
  paypal_handle: z
    .string()
    .trim()
    .max(60)
    // paypal.me handles are alphanumeric; keep it simple and safe for the QR link.
    .regex(/^[a-zA-Z0-9]*$/, "Ungültiger PayPal-Handle.")
    .optional(),
});

/** Current café settings as a key/value map. */
export function GET(): NextResponse {
  return NextResponse.json({ settings: getSettings() });
}

/** Updates café settings (cafe_name, paypal_handle). Broadcasts `catalog:changed`. */
export async function PATCH(request: Request): Promise<NextResponse> {
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

  setSettings(parsed.data);
  broadcast({ type: "catalog:changed" });
  return NextResponse.json({ ok: true });
}
