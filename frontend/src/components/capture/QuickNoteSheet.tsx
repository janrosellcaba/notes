import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { createItem, errorMessage, extractTask, newIdempotencyKey, patchItem } from "../../lib/api";
import { filedContext } from "../../lib/capture";
import { useI18n } from "../../lib/i18n";
import { invalidateItemViews } from "../../lib/cache";
import { useProjectList } from "../../lib/queries";
import { useUi } from "../../stores/ui";
import { Modal } from "../ui/Modal";
import { ProjectPill } from "../editor/ProjectPill";

const NoteSurface = lazy(() => import("../editor/NoteSurface"));

type Draft = { title: string; body: string; projectId: string | null };

function sameDraft(left: Draft, right: Draft): boolean {
  return left.title === right.title && left.body === right.body && left.projectId === right.projectId;
}

export function QuickNoteSheet({ projectId, onClose }: { projectId: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const pushToast = useUi((state) => state.pushToast);
  const contextId = useUi((state) => state.contextId);
  const { t } = useI18n();
  const projects = useProjectList("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedProject, setSelectedProject] = useState<string | null>(projectId);
  const [status, setStatus] = useState("");
  const draft = useRef<Draft>({ title: "", body: "", projectId });
  const alive = useRef(true);
  const timer = useRef(0);
  const state = useRef({
    saving: false,
    pending: false,
    id: null as string | null,
    key: newIdempotencyKey(),
    saved: null as Draft | null,
  });

  async function flush() {
    const current = draft.current;
    const hasText = current.title.trim().length > 0 || current.body.trim().length > 0;
    if (!state.current.id && !hasText) return;
    if (state.current.saved && sameDraft(state.current.saved, current)) return;
    if (!navigator.onLine) {
      if (alive.current) setStatus(t("status.offline"));
      state.current.pending = true;
      return;
    }
    if (state.current.saving) {
      state.current.pending = true;
      return;
    }
    state.current.saving = true;
    if (alive.current) setStatus(t("status.saving"));
    try {
      if (!state.current.id) {
        const created = await createItem(
          {
            type: "note",
            title: current.title,
            body_md: current.body,
            project_id: current.projectId,
            context_id: filedContext(contextId, current.projectId),
          },
          state.current.key,
        );
        state.current.id = created.id;
      } else {
        const saved = state.current.saved;
        const patch: Parameters<typeof patchItem>[1] = {};
        if (!saved || saved.title !== current.title) patch.title = current.title;
        if (!saved || saved.body !== current.body) patch.body_md = current.body;
        if (!saved || saved.projectId !== current.projectId) patch.project_id = current.projectId;
        if (Object.keys(patch).length > 0) await patchItem(state.current.id, patch);
      }
      state.current.saved = { ...current };
      if (alive.current) setStatus(t("status.saved"));
      invalidateItemViews(queryClient, state.current.id ?? undefined);
    } catch (error) {
      if (alive.current) {
        setStatus(t("status.offline"));
        const message = errorMessage(error);
        if (message) pushToast(message);
      }
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

  function schedule(delay = 400) {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flushRef.current(), delay);
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

  async function createTask(selection: string) {
    if (!selection.trim()) {
      pushToast("Select text first");
      return;
    }
    await flushRef.current();
    while (state.current.saving) {
      await new Promise((resolve) => window.setTimeout(resolve, 25));
    }
    const id = state.current.id;
    if (!id) {
      pushToast("Select text first");
      return;
    }
    try {
      const task = await extractTask(id, {
        title: selection.trim().slice(0, 500),
        selection: selection.slice(0, 2000),
      });
      pushToast("Task created", { href: `/item/${task.id}`, label: "Open" });
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not create the task");
    }
  }

  async function requestClose() {
    window.clearTimeout(timer.current);
    await flushRef.current();
    onClose();
  }

  return (
    <Modal title="Quick note" onClose={() => void requestClose()} align="stretch">
      <form
        className="flex h-full min-h-0 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          void requestClose();
        }}
      >
        <input
          value={title}
          aria-label="Title"
          placeholder={t("editor.title")}
          className="border-b border-border-subtle bg-transparent px-4 py-3 text-[16px] outline-none"
          onChange={(event) => {
            const next = event.target.value;
            setTitle(next);
            draft.current = { ...draft.current, title: next };
            schedule();
          }}
        />
        <Suspense fallback={<div className="min-h-48 flex-1" />}>
          <NoteSurface
            value={body}
            onChange={(next) => {
              setBody(next);
              draft.current = { ...draft.current, body: next };
              schedule();
            }}
            onCreateTask={(selection) => void createTask(selection)}
          />
        </Suspense>
        <footer className="flex items-center justify-between gap-3 border-t border-border-subtle px-4 py-2">
          <ProjectPill
            projectId={selectedProject}
            projects={projects.data?.projects ?? []}
            onChange={(next) => {
              setSelectedProject(next);
              draft.current = { ...draft.current, projectId: next };
              schedule(0);
            }}
          />
          <p className="font-mono text-[13px] text-fg-muted" aria-live="polite">
            {status}
          </p>
        </footer>
      </form>
    </Modal>
  );
}
