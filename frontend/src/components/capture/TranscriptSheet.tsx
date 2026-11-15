import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";

import { createItem, errorMessage, newIdempotencyKey, patchItem } from "../../lib/api";
import { filedContext } from "../../lib/capture";
import { invalidateItemViews } from "../../lib/cache";
import { meetingTitle } from "../../lib/dates";
import { useI18n } from "../../lib/i18n";
import { useProjectList } from "../../lib/queries";
import { useUi } from "../../stores/ui";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { ProjectPill } from "../editor/ProjectPill";

type Draft = { title: string; transcript: string; projectId: string | null };

export function TranscriptSheet({ projectId, onClose }: { projectId: string | null; onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pushToast = useUi((state) => state.pushToast);
  const contextId = useUi((state) => state.contextId);
  const { t } = useI18n();
  const projects = useProjectList("all");
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(() => meetingTitle());
  const [transcript, setTranscript] = useState("");
  const [selectedProject, setSelectedProject] = useState<string | null>(projectId);
  const [status, setStatus] = useState("");
  const draft = useRef<Draft>({ title: meetingTitle(), transcript: "", projectId });
  const dirty = useRef(false);
  const alive = useRef(true);
  const timer = useRef(0);
  const state = useRef({
    saving: false,
    pending: false,
    id: null as string | null,
    key: newIdempotencyKey(),
  });

  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.select();
  }, []);

  async function flush(): Promise<string | null> {
    const current = draft.current;
    if (!dirty.current && !state.current.id) return state.current.id;
    if (!navigator.onLine) {
      if (alive.current) setStatus(t("status.offline"));
      state.current.pending = true;
      return state.current.id;
    }
    if (state.current.saving) {
      state.current.pending = true;
      return state.current.id;
    }
    state.current.saving = true;
    if (alive.current) setStatus(t("status.saving"));
    try {
      if (!state.current.id) {
        const created = await createItem(
          {
            type: "meeting",
            title: current.title.trim() || meetingTitle(),
            body_md: "",
            transcript_raw: current.transcript.trim() ? current.transcript : null,
            project_id: current.projectId,
            context_id: filedContext(contextId, current.projectId),
          },
          state.current.key,
        );
        state.current.id = created.id;
      } else {
        await patchItem(state.current.id, {
          title: current.title,
          transcript_raw: current.transcript.trim() ? current.transcript : null,
          project_id: current.projectId,
        });
      }
      if (alive.current) setStatus(t("status.saved"));
      invalidateItemViews(queryClient, state.current.id);
      return state.current.id;
    } catch (error) {
      if (alive.current) {
        setStatus(t("status.offline"));
        const message = errorMessage(error);
        if (message) pushToast(message);
      }
      return state.current.id;
    } finally {
      state.current.saving = false;
      if (state.current.pending) {
        state.current.pending = false;
        void flush();
      }
    }
  }

  const flushRef = useRef(flush);
  flushRef.current = flush;

  function schedule() {
    dirty.current = true;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flushRef.current(), 400);
  }

  useEffect(() => {
    alive.current = true;
    const onHide = () => {
      if (document.visibilityState === "hidden") void flushRef.current();
    };
    const onOnline = () => {
      if (state.current.pending) void flushRef.current();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("online", onOnline);
    return () => {
      alive.current = false;
      window.clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("online", onOnline);
      void flushRef.current();
    };
  }, []);

  async function save() {
    dirty.current = true;
    window.clearTimeout(timer.current);
    const id = await flushRef.current();
    if (!id) return;
    onClose();
    void navigate(`/item/${id}`);
  }

  const projectName = projects.data?.projects.find((project) => project.id === selectedProject)?.name;

  return (
    <Modal title={t("home.transcript")} onClose={() => void flushRef.current().then(onClose)} align="stretch">
      <div className="flex h-full min-h-0 flex-col">
        <input
          ref={titleRef}
          value={title}
          aria-label={t("editor.title")}
          className="border-b border-border-subtle bg-transparent px-4 py-3 text-[16px] outline-none"
          onChange={(event) => {
            const next = event.target.value;
            setTitle(next);
            draft.current = { ...draft.current, title: next };
            schedule();
          }}
        />
        <label className="flex min-h-0 flex-1 flex-col px-4 py-3">
          <span className="mb-2 text-[13px] text-fg-secondary">{t("editor.transcript")}</span>
          <textarea
            value={transcript}
            className="min-h-[40vh] flex-1 resize-none bg-transparent text-[16px] leading-[1.6] outline-none"
            onChange={(event) => {
              const next = event.target.value;
              setTranscript(next);
              draft.current = { ...draft.current, transcript: next };
              schedule();
            }}
          />
        </label>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-4 py-2">
          <ProjectPill
            projectId={selectedProject}
            projects={projects.data?.projects ?? []}
            onChange={(next) => {
              setSelectedProject(next);
              draft.current = { ...draft.current, projectId: next };
              schedule();
            }}
          />
          <div className="flex items-center gap-3">
            <p className="font-mono text-[13px] text-fg-muted" aria-live="polite">
              {status}
            </p>
            <Button onClick={() => void save()}>{projectName ? t("editor.saveTo", { name: projectName }) : t("editor.saveInbox")}</Button>
          </div>
        </footer>
      </div>
    </Modal>
  );
}
