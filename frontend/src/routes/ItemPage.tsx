import { Pin, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import NoteSurface from "../components/editor/NoteSurface";
import { ProjectPill } from "../components/editor/ProjectPill";
import { TranscriptDrawer } from "../components/editor/TranscriptDrawer";
import { aiProcess, extractTask, getItem, patchItem } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { useProjectList } from "../lib/queries";
import { useUi } from "../stores/ui";
import type { Item, ItemPatch } from "../types/api";

type Draft = { title: string; body: string; projectId: string | null; transcript: string };

function draftFrom(item: Item): Draft {
  return {
    title: item.title,
    body: item.body_md,
    projectId: item.project?.id ?? null,
    transcript: item.transcript_raw ?? "",
  };
}

export default function ItemPage() {
  const { itemId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pushToast = useUi((state) => state.pushToast);
  const projects = useProjectList("all");
  const item = useQuery({
    queryKey: queryKeys.item(itemId),
    queryFn: () => getItem(itemId),
    enabled: itemId.length > 0,
  });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState("");
  const state = useRef({ draft: null as Draft | null, saved: null as Draft | null, saving: false, pending: false });
  const timer = useRef<number | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    if (!item.data) return;
    if (state.current.draft && state.current.saved) return;
    const next = draftFrom(item.data);
    state.current.draft = next;
    state.current.saved = next;
    setDraft(next);
  }, [item.data]);

  async function flush() {
    const current = state.current.draft;
    const saved = state.current.saved;
    if (!current || !saved || !item.data) return;
    const patch: ItemPatch = {};
    if (current.title !== saved.title) patch.title = current.title;
    if (current.body !== saved.body) patch.body_md = current.body;
    if (current.projectId !== saved.projectId) patch.project_id = current.projectId;
    if (item.data.type === "meeting" && current.transcript !== saved.transcript) patch.transcript_raw = current.transcript;
    if (Object.keys(patch).length === 0) return;
    if (!navigator.onLine) {
      state.current.pending = true;
      if (alive.current) setStatus("Offline — not saved");
      return;
    }
    if (state.current.saving) {
      state.current.pending = true;
      return;
    }
    state.current.saving = true;
    if (alive.current) setStatus("Saving…");
    try {
      const updated = await patchItem(item.data.id, patch);
      state.current.saved = draftFrom(updated);
      queryClient.setQueryData(queryKeys.item(item.data.id), updated);
      if (alive.current) setStatus("Saved");
    } catch {
      if (alive.current) setStatus("Offline — not saved");
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

  function update(next: Draft, delay = 400) {
    state.current.draft = next;
    setDraft(next);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flushRef.current(), delay);
  }

  function patchDraft(partial: Partial<Draft>, delay = 400) {
    const current = state.current.draft;
    if (!current) return;
    update({ ...current, ...partial }, delay);
  }

  useEffect(() => {
    alive.current = true;
    const onHide = () => {
      if (document.visibilityState === "hidden") void flushRef.current();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      alive.current = false;
      document.removeEventListener("visibilitychange", onHide);
      void flushRef.current();
    };
  }, [itemId]);

  async function togglePin() {
    if (!item.data || item.data.type === "task") return;
    const pinned = !item.data.pinned;
    const updated = await patchItem(item.data.id, { pinned });
    queryClient.setQueryData(queryKeys.item(item.data.id), updated);
    await queryClient.invalidateQueries({ queryKey: ["home"] });
  }

  async function createTask(selection: string) {
    if (!selection.trim()) {
      pushToast("Select text first");
      return;
    }
    await flushRef.current();
    if (!item.data) return;
    try {
      const task = await extractTask(item.data.id, {
        title: selection.trim().slice(0, 500),
        selection: selection.slice(0, 2000),
      });
      pushToast("Task created", { href: `/item/${task.id}`, label: "Open" });
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not create the task");
    }
  }

  if (item.isPending || !draft) return <p className="text-fg-muted">Loading…</p>;
  if (item.isError || !item.data) return <p>This item is not available.</p>;
  const current = item.data;
  const meeting = current.type === "meeting";

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-2 pb-3">
        <button type="button" className="min-h-11 rounded-[8px] px-2 text-fg-secondary hover:bg-interactive" onClick={() => void navigate(-1)}>
          Back
        </button>
        {current.type !== "task" ? (
          <button
            type="button"
            className={`inline-flex min-h-11 items-center gap-2 rounded-[8px] px-2 ${current.pinned ? "text-fg" : "text-fg-muted"}`}
            aria-pressed={current.pinned}
            onClick={() => void togglePin()}
          >
            <Pin size={16} />
            Pin
          </button>
        ) : null}
        <ProjectPill
          projectId={draft.projectId}
          projects={projects.data?.projects ?? []}
          onChange={(projectId) => patchDraft({ projectId }, 0)}
        />
        <button
          type="button"
          className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-[8px] px-2 text-fg-muted"
          disabled
          aria-describedby="ai-unavailable"
          onClick={() => void aiProcess(current.id)}
        >
          <Sparkles size={16} />
          AI summarize
        </button>
        <span id="ai-unavailable" className="sr-only">
          AI processing is not configured
        </span>
        <p className="font-mono text-[13px] text-fg-muted" aria-live="polite">
          {status}
        </p>
      </header>
      <input
        value={draft.title}
        aria-label="Title"
        className="border-b border-border-subtle bg-transparent px-1 py-2 text-[20px] outline-none"
        onChange={(event) => patchDraft({ title: event.target.value })}
      />
      {meeting ? <p className="px-1 pt-3 text-[13px] text-fg-muted">Takeaways and action items</p> : null}
      <NoteSurface
        value={draft.body}
        onChange={(body) => patchDraft({ body })}
        onCreateTask={current.type === "task" ? undefined : (selection) => void createTask(selection)}
      />
      {meeting ? (
        <TranscriptDrawer value={draft.transcript} onChange={(transcript) => patchDraft({ transcript })} />
      ) : null}
      {current.source_item_id ? (
        <p className="px-1 py-3 text-[13px] text-fg-muted">
          From <Link to={`/item/${current.source_item_id}`} className="underline">source</Link>
        </p>
      ) : null}
    </div>
  );
}
