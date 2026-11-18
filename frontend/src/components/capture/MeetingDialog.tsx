import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";

import { createItem, getItem, listItems, patchItem } from "../../lib/api";
import { filedContext } from "../../lib/capture";
import { meetingTitle } from "../../lib/dates";
import { FIELD, FIELD_SELECT, FIELD_TEXTAREA } from "../../lib/field";
import { useI18n } from "../../lib/i18n";
import { queryKeys } from "../../lib/queryKeys";
import { useUi } from "../../stores/ui";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

export function MeetingDialog({ projectId, onClose }: { projectId: string | null; onClose: () => void }) {
  const navigate = useNavigate();
  const pushToast = useUi((state) => state.pushToast);
  const contextId = useUi((state) => state.contextId);
  const { t } = useI18n();
  const [existingId, setExistingId] = useState("");
  const [initialTitle] = useState(() => meetingTitle());
  const [title, setTitle] = useState(initialTitle);
  const [notes, setNotes] = useState("");
  const [transcript, setTranscript] = useState("");
  const [pending, setPending] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);

  const existing = useQuery({
    queryKey: queryKeys.items({
      type: "meeting",
      limit: 50,
      project_id: projectId ?? undefined,
      context_id: contextId === "all" ? undefined : contextId,
    }),
    queryFn: () =>
      listItems({
        type: "meeting",
        limit: 50,
        project_id: projectId ?? undefined,
        context_id: contextId === "all" ? undefined : contextId,
      }),
  });

  useEffect(() => {
    if (!existingId) return;
    let cancelled = false;
    setLoadingExisting(true);
    void getItem(existingId)
      .then((item) => {
        if (cancelled) return;
        setTitle(item.title || meetingTitle());
        setNotes(item.body_md);
        setTranscript(item.transcript_raw ?? "");
      })
      .catch((error) => {
        if (cancelled) return;
        pushToast(error instanceof Error ? error.message : t("editor.unavailable"));
        setExistingId("");
      })
      .finally(() => {
        if (!cancelled) setLoadingExisting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [existingId, pushToast, t]);

  function startNew() {
    setExistingId("");
    setTitle(initialTitle);
    setNotes("");
    setTranscript("");
  }

  const titled = title.trim().length > 0 && title.trim() !== initialTitle;
  const hasContent = titled || notes.trim().length > 0 || transcript.trim().length > 0;

  async function submit() {
    if (pending || loadingExisting) return;
    if (!existingId && !hasContent) return;
    setPending(true);
    try {
      if (existingId) {
        const meeting = await patchItem(existingId, {
          title: title.trim() || initialTitle,
          body_md: notes,
          transcript_raw: transcript.trim() ? transcript : null,
        });
        onClose();
        void navigate(`/item/${meeting.id}`);
        return;
      }
      const meeting = await createItem({
        type: "meeting",
        title: title.trim() || initialTitle,
        body_md: notes,
        transcript_raw: transcript.trim() ? transcript : null,
        project_id: projectId,
        context_id: filedContext(contextId, projectId),
      });
      onClose();
      void navigate(`/item/${meeting.id}`);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : t("editor.unavailable"));
      setPending(false);
    }
  }

  return (
    <Modal title={existingId ? t("meeting.update") : t("home.meeting")} onClose={onClose}>
      <form
        className="flex max-h-[75dvh] flex-col gap-3 overflow-y-auto p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <input
          autoFocus
          value={title}
          aria-label={t("editor.title")}
          className={FIELD}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setTitle(event.target.value)}
        />
        <label className="block text-[13px] text-fg-secondary">
          {t("meeting.notes")}
          <textarea
            value={notes}
            className={`mt-1.5 ${FIELD_TEXTAREA}`}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <label className="block text-[13px] text-fg-secondary">
          {t("meeting.hint")}
          <textarea
            value={transcript}
            className={`mt-1.5 ${FIELD_TEXTAREA}`}
            onChange={(event) => setTranscript(event.target.value)}
          />
        </label>
        <div className="rounded-[8px] border border-border-subtle px-3 py-3">
          <p className="text-[13px] text-fg-secondary">{t("meeting.existing")}</p>
          <p className="mt-1 text-[12px] text-fg-muted">{t("meeting.existingDetail")}</p>
          <div className="mt-2 flex gap-2">
            <select
              value={existingId}
              aria-label={t("meeting.existing")}
              className={`${FIELD_SELECT} min-w-0 flex-1`}
              onChange={(event) => {
                const next = event.target.value;
                if (!next) {
                  startNew();
                  return;
                }
                setExistingId(next);
              }}
            >
              <option value="">{t("meeting.newOption")}</option>
              {(existing.data?.items ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title || t("common.untitled")}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button type="submit" variant="go" disabled={pending || loadingExisting || (!existingId && !hasContent)}>
          {existingId ? t("meeting.save") : t("common.create")}
        </Button>
      </form>
    </Modal>
  );
}
