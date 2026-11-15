import { useState } from "react";
import { useNavigate } from "react-router";

import { createItem } from "../../lib/api";
import { filedContext } from "../../lib/capture";
import { meetingTitle } from "../../lib/dates";
import { useI18n } from "../../lib/i18n";
import { useUi } from "../../stores/ui";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

export function MeetingDialog({ projectId, onClose }: { projectId: string | null; onClose: () => void }) {
  const navigate = useNavigate();
  const pushToast = useUi((state) => state.pushToast);
  const contextId = useUi((state) => state.contextId);
  const { t } = useI18n();
  const [title, setTitle] = useState(() => meetingTitle());
  const [transcript, setTranscript] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    if (pending) return;
    setPending(true);
    try {
      const meeting = await createItem({
        type: "meeting",
        title: title.trim() || meetingTitle(),
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
    <Modal title={t("home.meeting")} onClose={onClose}>
      <form
        className="flex flex-col gap-3 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <input
          autoFocus
          value={title}
          aria-label={t("editor.title")}
          className="min-h-11 rounded-[8px] border border-border bg-canvas px-3 text-[16px] outline-none focus:border-fg"
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setTitle(event.target.value)}
        />
        <label className="block text-[13px] text-fg-secondary">
          {t("meeting.hint")}
          <textarea
            value={transcript}
            className="mt-1.5 min-h-28 w-full resize-y rounded-[8px] border border-border bg-canvas px-3 py-2 text-[16px] leading-[1.6] outline-none focus:border-fg"
            onChange={(event) => setTranscript(event.target.value)}
          />
        </label>
        <Button type="submit" disabled={pending}>
          {t("common.create")}
        </Button>
      </form>
    </Modal>
  );
}
