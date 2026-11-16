import { FileText, Image, Paperclip, X } from "lucide-react";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { deleteAttachment, listAttachments, uploadAttachment } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { useUi } from "../../stores/ui";
import type { Attachment } from "../../types/api";

function iconFor(type: string) {
  if (type.startsWith("image/")) return Image;
  return FileText;
}

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function Attachments({ itemId }: { itemId: string }) {
  const queryClient = useQueryClient();
  const pushToast = useUi((state) => state.pushToast);
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const attachments = useQuery({
    queryKey: ["attachments", itemId],
    queryFn: () => listAttachments(itemId),
  });

  async function onPick(files: FileList | null) {
    if (!files?.length || uploading) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadAttachment(itemId, file);
      }
      await queryClient.invalidateQueries({ queryKey: ["attachments", itemId] });
    } catch (error) {
      pushToast(error instanceof Error ? error.message : t("editor.unavailable"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(attachment: Attachment) {
    try {
      await deleteAttachment(itemId, attachment.id);
      await queryClient.invalidateQueries({ queryKey: ["attachments", itemId] });
    } catch (error) {
      pushToast(error instanceof Error ? error.message : t("editor.unavailable"));
    }
  }

  const rows = attachments.data ?? [];

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] text-fg-secondary">{t("editor.attachments")}</p>
        <button
          type="button"
          disabled={uploading}
          className="inline-flex min-h-7 items-center gap-1 rounded-md px-2 text-[12px] text-fg-muted hover:bg-interactive hover:text-fg disabled:opacity-50"
          onClick={() => inputRef.current?.click()}
        >
          <Paperclip size={12} />
          {uploading ? t("status.saving") : t("editor.addFile")}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
          multiple
          className="hidden"
          onChange={(event) => void onPick(event.target.files)}
        />
      </div>
      {rows.length > 0 ? (
        <ul className="mt-1.5 flex flex-col gap-1">
          {rows.map((file) => {
            const Icon = iconFor(file.content_type);
            return (
              <li
                key={file.id}
                className="group flex min-h-8 items-center gap-2 rounded-md px-1.5 hover:bg-interactive"
              >
                <Icon size={14} className="shrink-0 text-fg-muted" />
                <a
                  href={`/api/items/${encodeURIComponent(itemId)}/attachments/${encodeURIComponent(file.id)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate text-[13px] hover:underline"
                >
                  {file.filename}
                </a>
                <span className="font-mono text-[11px] text-fg-muted">{sizeLabel(file.size)}</span>
                <button
                  type="button"
                  aria-label={t("editor.remove")}
                  className="rounded p-1 text-fg-muted opacity-0 hover:bg-canvas hover:text-fg group-hover:opacity-100"
                  onClick={() => void remove(file)}
                >
                  <X size={12} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
