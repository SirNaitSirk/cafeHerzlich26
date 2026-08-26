"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlusIcon, Loader2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { adminMessages as t } from "@/lib/messages";

/**
 * Product image field: uploads the chosen file to `/api/admin/uploads` and
 * reports the resulting URL via `onChange`. Shows a live preview; the URL is
 * only persisted when the surrounding product form is saved.
 */
export function ImageUpload({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/admin/uploads", { method: "POST", body: form });
      if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
      const data: { url: string } = await response.json();
      onChange(data.url);
    } catch {
      toast.error(t.image.error);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border bg-muted">
        {value ? (
          <Image src={value} alt="" fill sizes="80px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImagePlusIcon className="size-6" />
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Loader2Icon className="size-5 animate-spin" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? t.image.uploading : value ? t.image.change : t.image.upload}
          </Button>
          {value && !uploading && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => onChange(null)}
            >
              <XIcon className="size-4" />
              {t.image.remove}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t.image.hint}</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}
