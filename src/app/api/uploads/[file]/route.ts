import { readUpload } from "@/lib/uploads";

export const runtime = "nodejs";

/**
 * Serves a stored product image from local disk. Public — product photos appear
 * on the terminal. Filenames are validated in `readUpload` (no path traversal).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
): Promise<Response> {
  const { file } = await params;
  const upload = await readUpload(file);
  if (!upload) {
    return new Response("Nicht gefunden.", { status: 404 });
  }

  return new Response(new Uint8Array(upload.body), {
    headers: {
      "Content-Type": upload.contentType,
      // Filenames are content-unique (uuid); cache aggressively.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
