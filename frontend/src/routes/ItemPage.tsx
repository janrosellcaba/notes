import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import NoteSurface from "../components/editor/NoteSurface";
import { ProjectPill } from "../components/editor/ProjectPill";
import { TranscriptDrawer } from "../components/editor/TranscriptDrawer";
import { Attachments } from "../components/items/Attachments";
import { Button } from "../components/ui/Button";
import { IconButton } from "../components/ui/IconButton";
import { extractTask, getItem, patchItem, restoreItem } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { useI18n } from "../lib/i18n";
import { useProjectList } from "../lib/queries";
import { softDeleteItems } from "../lib/taskActions";
import { useUi } from "../stores/ui";
import type { Item, ItemPatch } from "../types/api";

function bulletTitles(markdown: string): string[] {
  const titles: string[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:[-*+]|\d+\.)\s+(.+?)\s*$/);
    if (!match?.[1]) continue;
    const title = match[1].replace(/\*\*|__/g, "").trim();
    if (title) titles.push(title.slice(0, 500));
  }
  return titles;
}

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
  const { t } = useI18n();
  const projects = useProjectList("all");
  const item = useQuery({
    queryKey: queryKeys.item(itemId),
    queryFn: () => getItem(itemId),
    enabled: itemId.length > 0,
  });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
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
      if (alive.current) setStatus(t("status.offline"));
      return;
    }
    if (state.current.saving) {
      state.current.pending = true;
      return;
    }
    state.current.saving = true;
    if (alive.current) setStatus(t("status.saving"));
    try {
      const updated = await patchItem(item.data.id, patch);
      state.current.saved = draftFrom(updated);
      queryClient.setQueryData(queryKeys.item(item.data.id), updated);
      if (alive.current) setStatus(t("status.saved"));
    } catch {
      if (alive.current) setStatus(t("status.offline"));
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

  async function createTask(selection: string) {
    if (!selection.trim()) {
      pushToast(t("editor.selectText"));
      return;
    }
    await flushRef.current();
    if (!item.data) return;
    try {
      const task = await extractTask(item.data.id, {
        title: selection.trim().slice(0, 500),
        selection: selection.slice(0, 2000),
      });
      pushToast(t("editor.taskCreated"), { href: `/item/${task.id}`, label: t("editor.open") });
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not create the task");
    }
  }

  async function createTasksFromBullets() {
    await flushRef.current();
    if (!item.data || !draft) return;
    const titles = bulletTitles(draft.body);
    if (titles.length === 0) {
      pushToast(t("editor.noBullets"));
      return;
    }
    try {
      const created = await Promise.all(
        titles.map((title) =>
          extractTask(item.data!.id, {
            title,
            selection: title,
          }),
        ),
      );
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      pushToast(t("editor.tasksFromBullets", { count: String(created.length) }));
    } catch (error) {
      pushToast(error instanceof Error ? error.message : t("editor.unavailable"));
    }
  }

  async function remove() {
    if (!item.data) return;
    const current = item.data;
    try {
      await flushRef.current();
      void navigate(-1);
      await softDeleteItems(queryClient, [current], {
        pushToast,
        message: t("tasks.deleted"),
        undoLabel: t("common.undo"),
      });
    } catch (error) {
      pushToast(error instanceof Error ? error.message : t("editor.unavailable"));
      setConfirmDelete(false);
    }
  }

  if (item.isPending || !draft) return <p className="text-fg-muted">{t("common.loading")}</p>;
  if (item.isError || !item.data) return <p>{t("editor.unavailable")}</p>;
  const current = item.data;
  const meeting = current.type === "meeting";

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-2 pb-3">
        <Button variant="consult" onClick={() => void navigate(-1)}>
          {t("editor.back")}
        </Button>
        <ProjectPill
          projectId={draft.projectId}
          projects={projects.data?.projects ?? []}
          onChange={(projectId) => patchDraft({ projectId }, 0)}
        />
        <p className="ml-auto font-mono text-[13px] text-fg-muted" aria-live="polite">
          {status}
        </p>
        {current.deleted_at ? null : confirmDelete ? (
          <Button variant="consult" tone="danger" onClick={() => void remove()}>
            {t("inbox.deleteConfirm")}
          </Button>
        ) : (
          <IconButton label={t("common.delete")} onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} />
          </IconButton>
        )}
      </header>
      <input
        value={draft.title}
        aria-label={t("editor.title")}
        className="border-b border-border-subtle bg-transparent px-1 py-2 text-[20px] outline-none"
        onChange={(event) => patchDraft({ title: event.target.value })}
      />
      {meeting ? (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-3">
          <p className="text-[13px] text-fg-muted">{t("editor.takeaways")}</p>
          <Button variant="consult" onClick={() => void createTasksFromBullets()}>
            {t("editor.bulletsToTasks")}
          </Button>
        </div>
      ) : null}
      <NoteSurface
        value={draft.body}
        onChange={(body) => patchDraft({ body })}
        onCreateTask={current.type === "task" ? undefined : (selection) => void createTask(selection)}
      />
      {meeting ? (
        <TranscriptDrawer value={draft.transcript} onChange={(transcript) => patchDraft({ transcript })} />
      ) : null}
      <div className="mt-4 px-1">
        <Attachments itemId={current.id} />
      </div>
      {current.deleted_at ? (
        <p className="mt-3 flex items-center justify-between gap-3 rounded-[8px] border border-border px-3 py-2 text-[13px]">
          {t("editor.inTrash")}
          <Button
            variant="add"
            onClick={() => void restoreItem(current.id).then((saved) => queryClient.setQueryData(queryKeys.item(current.id), saved))}
          >
            {t("trash.restore")}
          </Button>
        </p>
      ) : null}
      {current.source_item_id ? (
        <p className="px-1 py-3 text-[13px] text-fg-muted">
          {t("editor.from")} <Link to={`/item/${current.source_item_id}`} className="underline">{t("editor.source")}</Link>
        </p>
      ) : null}
    </div>
  );
}
