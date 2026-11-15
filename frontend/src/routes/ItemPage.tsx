import { Pin, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import NoteSurface from "../components/editor/NoteSurface";
import { ProjectPill } from "../components/editor/ProjectPill";
import { TranscriptDrawer } from "../components/editor/TranscriptDrawer";
import { aiProcess, deleteAttachment, extractTask, getItem, listAttachments, listBacklinks, patchItem, restoreItem, uploadAttachment } from "../lib/api";
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
      {current.deleted_at ? (
        <p className="mt-3 flex items-center justify-between gap-3 rounded-[8px] border border-border px-3 py-2 text-[13px]">
          This is in the trash.
          <button
            type="button"
            className="min-h-11 rounded-[8px] border border-border px-3"
            onClick={() => void restoreItem(current.id).then((saved) => queryClient.setQueryData(queryKeys.item(current.id), saved))}
          >
            Restore
          </button>
        </p>
      ) : null}
      {current.type === "task" ? <RepeatControl item={current} /> : null}
      {current.type !== "task" ? <Attachments itemId={current.id} /> : null}
      <Backlinks itemId={current.id} />
      {current.source_item_id ? (
        <p className="px-1 py-3 text-[13px] text-fg-muted">
          From <Link to={`/item/${current.source_item_id}`} className="underline">source</Link>
        </p>
      ) : null}
    </div>
  );
}

function RepeatControl({ item }: { item: Item }) {
  const queryClient = useQueryClient();
  return (
    <label className="mt-3 block px-1 text-[13px] text-fg-secondary">
      Repeats
      <select
        value={item.recurrence ?? ""}
        className="mt-1.5 min-h-11 w-full rounded-[8px] border border-border bg-canvas px-3 text-[16px]"
        onChange={(event) => {
          const next = event.target.value as "" | "weekly" | "monthly";
          const due = item.due_on;
          const dueDate = due ? new Date(`${due}T00:00:00`) : new Date();
          void patchItem(item.id, {
            recurrence: next || null,
            recurrence_weekday: next === "weekly" ? (dueDate.getDay() + 6) % 7 : null,
            recurrence_monthday: next === "monthly" ? (due ? Number(due.slice(8, 10)) : 1) : null,
          }).then((saved) => {
            queryClient.setQueryData(queryKeys.item(item.id), saved);
            void queryClient.invalidateQueries({ queryKey: ["items"] });
          });
        }}
      >
        <option value="">Does not repeat</option>
        <option value="weekly">Every week</option>
        <option value="monthly">Every month</option>
      </select>
    </label>
  );
}

function Backlinks({ itemId }: { itemId: string }) {
  const links = useQuery({ queryKey: ["backlinks", itemId], queryFn: () => listBacklinks(itemId) });
  const items = links.data?.items ?? [];
  if (items.length === 0) return null;
  return (
    <section className="mt-4 px-1">
      <h2 className="text-[13px] text-fg-muted">Linked from</h2>
      <ul className="mt-2 flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <Link to={`/item/${item.id}`} className="underline">{item.title || "Untitled"}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Attachments({ itemId }: { itemId: string }) {
  const queryClient = useQueryClient();
  const pushToast = useUi((state) => state.pushToast);
  const files = useQuery({ queryKey: ["attachments", itemId], queryFn: () => listAttachments(itemId) });

  async function onFiles(list: FileList | null) {
    if (!list) return;
    try {
      for (const file of list) await uploadAttachment(itemId, file);
      await queryClient.invalidateQueries({ queryKey: ["attachments", itemId] });
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not attach the file");
    }
  }

  return (
    <section
      className="mt-4 rounded-[10px] border border-dashed border-border px-4 py-3"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        void onFiles(event.dataTransfer.files);
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[13px] text-fg-muted">Attachments</h2>
        <label className="min-h-11 cursor-pointer rounded-[8px] border border-border px-3 leading-[2.75rem]">
          Add image or PDF
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
            className="sr-only"
            onChange={(event) => void onFiles(event.target.files)}
          />
        </label>
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        {(files.data ?? []).map((file) => (
          <li key={file.id} className="flex items-center justify-between gap-3 text-[14px]">
            <a className="truncate underline" href={`/api/items/${itemId}/attachments/${file.id}`}>
              {file.filename}
            </a>
            <button
              type="button"
              className="text-[13px] text-fg-muted"
              onClick={() => void deleteAttachment(itemId, file.id).then(() => queryClient.invalidateQueries({ queryKey: ["attachments", itemId] }))}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
