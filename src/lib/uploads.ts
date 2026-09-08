import "server-only";

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Local product-image storage. Files live on the Pi under `data/uploads/`
 * (gitignored) and are served back through `GET /api/uploads/<file>`. Fully
 * offline — no external URLs, no cloud storage.
 */
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), "data", "uploads");
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/** Allowed image types → canonical file extension. */
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const EXT_CONTENT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Thrown when an upload is rejected (bad type / too large). Maps to HTTP 400. */
export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

// Runtime path on the Pi; the opt-out comments below stop Turbopack from tracing
// the whole project into the build just because these paths are computed at runtime.
function ensureDir(): void {
  if (!existsSync(/*turbopackIgnore: true*/ UPLOAD_DIR)) {
    mkdirSync(/*turbopackIgnore: true*/ UPLOAD_DIR, { recursive: true });
  }
}

/**
 * Persists an uploaded image and returns the public URL to reference it by.
 * The stored filename is server-generated (never the client's), so there is no
 * path-traversal surface and no name collisions.
 */
export async function saveUpload(file: File): Promise<string> {
  const ext = ALLOWED[file.type];
  if (!ext) {
    throw new UploadValidationError("Nur JPG-, PNG- oder WebP-Bilder sind erlaubt.");
  }
  if (file.size > MAX_BYTES) {
    throw new UploadValidationError("Das Bild ist zu groß (max. 5 MB).");
  }

  ensureDir();
  const name = `${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(/*turbopackIgnore: true*/ UPLOAD_DIR, name), buffer);
  return `/api/uploads/${name}`;
}

export type StoredUpload = { body: Buffer; contentType: string };

/**
 * Reads a stored upload by filename for serving. Rejects anything that isn't a
 * plain `<uuid>.<ext>` name (no slashes, no `..`) to prevent path traversal.
 */
export async function readUpload(name: string): Promise<StoredUpload | null> {
  if (!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(name)) return null;
  const ext = name.slice(name.lastIndexOf(".") + 1);
  const path = join(/*turbopackIgnore: true*/ UPLOAD_DIR, name);
  if (!existsSync(path)) return null;
  return { body: await readFile(path), contentType: EXT_CONTENT_TYPE[ext] };
}

/**
 * Removes a stored product image. Best effort: a missing file or a URL that
 * isn't a local upload is silently ignored — deleting a product must never
 * fail because of its image.
 */
export async function deleteUpload(url: string | null): Promise<void> {
  if (!url) return;
  const match = /^\/api\/uploads\/([a-f0-9-]+\.(?:jpg|png|webp))$/.exec(url);
  if (!match) return;

  try {
    await unlink(join(/*turbopackIgnore: true*/ UPLOAD_DIR, match[1]));
  } catch {
    // File already gone (or never written) — nothing to clean up.
  }
}
