import { Paperclip, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { createItem, deleteItem, listItems, patchItem, uploadAttachment } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { queryKeys } from "../../lib/queryKeys";
import { useContexts, useProjectList } from "../../lib/queries";
import { useUi } from "../../stores/ui";
import type { Item, ItemPriority, ItemStatus } from "../../types/api";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { Modal } from "../ui/Modal";
import { PrioritySelect } from "../ui/PrioritySelect";
import { StatusSelect } from "../ui/StatusSelect";
import { Attachments } from "./Attachments";

const PRIORITIES: ItemPriority[] = ["none", "low", "medium", "high", "urgent"];

const fieldClass =
  "mt-1.5 min-h-9 w-full rounded-md border border-border bg-canvas px-2.5 text-[13px] outline-none focus:border-fg";

export function TaskCreateDialog({
  projectId: initialProjectId,
  dueOn: initialDue = null,
  onClose,
}: {
  projectId?: string | null;
  dueOn?: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const pushToast = useUi((state) => state.pushToast);
  const { t } = useI18n();
  const projects = useProjectList("all");
  const contexts = useContexts();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [batch, setBatch] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [body, setBody] = useState("");
  const [due, setDue] = useState(initialDue ?? "");
  const [starts, setStarts] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState<ItemPriority>("none");
  const [status, setStatus] = useState<ItemStatus>("todo");
  const [projectId, setProjectId] = useState(initialProjectId ?? "");
  const [contextId, setContextId] = useState("");
  const [subtask, setSubtask] = useState("");
  const [pendingSubtasks, setPendingSubtasks] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);

  function addPendingSubtask() {
    const next = subtask.trim();
    if (!next) return;
    setPendingSubtasks((rows) => [...rows, next]);
    setSubtask("");
  }

  async function createOne(nextTitle: string, extras: { body?: string; subtasks?: string[]; files?: File[] } = {}) {
    const created = await createItem({
      type: "task",
      title: nextTitle,
      body_md: extras.body ?? "",
      project_id: projectId || null,
      context_id: projectId ? null : contextId || null,
      status,
      priority,
      due_on: due || null,
      starts_on: starts || null,
      assignee: assignee.trim() || null,
    });
    for (const child of extras.subtasks ?? []) {
      await createItem({
        type: "task",
        title: child,
        parent_id: created.id,
        project_id: created.project?.id ?? null,
        context_id: created.project ? null : (created.context?.id ?? null),
      });
    }
    for (const file of extras.files ?? []) {
      await uploadAttachment(created.id, file);
    }
    return created;
  }

  async function submit() {
    if (pending) return;
    if (batch) {
      const lines = batchText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length === 0) return;
      setPending(true);
      try {
        for (const line of lines) {
          await createOne(line);
        }
        await queryClient.invalidateQueries({ queryKey: ["items"] });
        await queryClient.invalidateQueries({ queryKey: ["home"] });
        onClose();
      } catch (error) {
        pushToast(error instanceof Error ? error.message : t("editor.unavailable"));
        setPending(false);
      }
      return;
    }

    const nextTitle = title.trim();
    if (!nextTitle) return;
    setPending(true);
    try {
      await createOne(nextTitle, { body: body.trim(), subtasks: pendingSubtasks, files });
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
      onClose();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : t("editor.unavailable"));
      setPending(false);
    }
  }

  const canSubmit = batch
    ? batchText.split("\n").some((line) => line.trim().length > 0)
    : title.trim().length > 0;

  return (
    <Modal title={t("tasks.new")} onClose={onClose}>
      <form
        className="flex max-h-[80dvh] flex-col gap-3 overflow-y-auto p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          {!batch ? <StatusSelect status={status} showLabel={false} onChange={setStatus} /> : null}
          <button
            type="button"
            className={`rounded-md px-2 py-1 text-[12px] ${batch ? "bg-interactive text-fg" : "text-fg-muted hover:text-fg"}`}
            onClick={() => {
              setBatch((value) => !value);
              setTitle("");
              setBatchText("");
            }}
            title={t("tasks.batchHint")}
          >
            {batch ? t("tasks.single") : t("tasks.batch")}
          </button>
        </div>
        {batch ? (
          <textarea
            autoFocus
            value={batchText}
            aria-label={t("tasks.batchHint")}
            placeholder={t("tasks.batchHint")}
            className="min-h-36 rounded-md border border-border bg-canvas px-2.5 py-2 text-[13px] leading-[1.6] outline-none focus:border-fg"
            onChange={(event) => setBatchText(event.target.value)}
          />
        ) : (
          <>
            <input
              autoFocus
              value={title}
              aria-label={t("editor.title")}
              placeholder={t("editor.title")}
              className="min-h-10 rounded-md border-0 bg-transparent px-0 text-[16px] font-medium outline-none placeholder:text-fg-muted"
              onChange={(event) => setTitle(event.target.value)}
            />
            <TaskDetails
              due={due}
              starts={starts}
              assignee={assignee}
              priority={priority}
              projectId={projectId}
              contextId={contextId}
              projects={projects.data?.projects ?? []}
              contexts={contexts.data?.contexts ?? []}
              onDue={setDue}
              onStarts={setStarts}
              onAssignee={setAssignee}
              onPriority={setPriority}
              onProject={setProjectId}
              onContext={setContextId}
            />
            <div>
              <p className="text-[13px] text-fg-secondary">{t("task.subtasks")}</p>
              <ul className="mt-1.5">
                {pendingSubtasks.map((row, index) => (
                  <li key={`${row}-${index}`} className="flex min-h-8 items-center gap-2 text-[13px]">
                    <span className="min-w-0 flex-1 truncate">{row}</span>
                    <button
                      type="button"
                      className="rounded p-1 text-fg-muted hover:bg-interactive hover:text-fg"
                      aria-label={t("editor.remove")}
                      onClick={() => setPendingSubtasks((rows) => rows.filter((_, i) => i !== index))}
                    >
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <input
                  value={subtask}
                  aria-label={t("task.addSubtask")}
                  placeholder={t("task.addSubtask")}
                  className="min-h-8 min-w-0 flex-1 rounded-md border border-border bg-canvas px-2.5 text-[13px] outline-none focus:border-fg"
                  onChange={(event) => setSubtask(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addPendingSubtask();
                    }
                  }}
                />
                <Button type="button" variant="consult" disabled={subtask.trim().length === 0} onClick={addPendingSubtask}>
                  {t("common.create")}
                </Button>
              </div>
            </div>
            <textarea
              value={body}
              aria-label={t("task.notes")}
              placeholder={t("task.notes")}
              className="min-h-24 rounded-md border border-border bg-canvas px-2.5 py-2 text-[13px] leading-[1.6] outline-none focus:border-fg"
              onChange={(event) => setBody(event.target.value)}
            />
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] text-fg-secondary">{t("editor.attachments")}</p>
                <button
                  type="button"
                  className="inline-flex min-h-7 items-center gap-1 rounded-md px-2 text-[12px] text-fg-muted hover:bg-interactive hover:text-fg"
                  onClick={() => fileRef.current?.click()}
                >
                  <Paperclip size={12} />
                  {t("editor.addFile")}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    const next = event.target.files ? Array.from(event.target.files) : [];
                    if (next.length) setFiles((current) => [...current, ...next]);
                    event.target.value = "";
                  }}
                />
              </div>
              {files.length > 0 ? (
                <ul className="mt-1.5 flex flex-col gap-1">
                  {files.map((file, index) => (
                    <li key={`${file.name}-${index}`} className="flex min-h-8 items-center gap-2 text-[13px]">
                      <span className="min-w-0 flex-1 truncate">{file.name}</span>
                      <button
                        type="button"
                        className="rounded p-1 text-fg-muted hover:bg-interactive hover:text-fg"
                        aria-label={t("editor.remove")}
                        onClick={() => setFiles((rows) => rows.filter((_, i) => i !== index))}
                      >
                        <X size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="consult" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" variant="go" disabled={pending || !canSubmit}>
            {batch ? t("tasks.createMany") : t("tasks.create")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function TaskEditor({
  item,
  onClose,
  onOpen,
}: {
  item: Item;
  onClose: () => void;
  onOpen?: (item: Item) => void;
}) {
  const queryClient = useQueryClient();
  const pushToast = useUi((state) => state.pushToast);
  const projects = useProjectList("all");
  const contexts = useContexts();
  const { t } = useI18n();
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(item.body_md);
  const [due, setDue] = useState(item.due_on ?? "");
  const [starts, setStarts] = useState(item.starts_on ?? "");
  const [assignee, setAssignee] = useState(item.assignee ?? "");
  const [priority, setPriority] = useState<ItemPriority>(item.priority ?? "none");
  const [status, setStatus] = useState<ItemStatus>(item.status ?? "todo");
  const [projectId, setProjectId] = useState(item.project?.id ?? "");
  const [contextId, setContextId] = useState(item.project ? "" : (item.context?.id ?? ""));
  const [subtask, setSubtask] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const children = useQuery({
    queryKey: queryKeys.items({ parent_id: item.id, type: "task", include_done: true, limit: 100 }),
    queryFn: () => listItems({ parent_id: item.id, type: "task", include_done: true, limit: 100 }),
  });

  useEffect(() => {
    setTitle(item.title);
    setBody(item.body_md);
    setDue(item.due_on ?? "");
    setStarts(item.starts_on ?? "");
    setAssignee(item.assignee ?? "");
    setPriority(item.priority ?? "none");
    setStatus(item.status ?? "todo");
    setProjectId(item.project?.id ?? "");
    setContextId(item.project ? "" : (item.context?.id ?? ""));
    setConfirmDelete(false);
  }, [item]);

  async function save(patch: Parameters<typeof patchItem>[1]) {
    try {
      const saved = await patchItem(item.id, patch);
      queryClient.setQueryData(queryKeys.item(item.id), saved);
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
      return saved;
    } catch (error) {
      pushToast(error instanceof Error ? error.message : t("editor.unavailable"));
      return null;
    }
  }

  async function saveAndClose() {
    const nextTitle = title.trim();
    if (!nextTitle || saving) return;
    setSaving(true);
    const saved = await save({
      title: nextTitle,
      body_md: body,
      due_on: due || null,
      starts_on: starts || null,
      assignee: assignee.trim() || null,
      priority,
      status,
      project_id: projectId || null,
      context_id: projectId ? null : contextId || null,
    });
    setSaving(false);
    if (saved) onClose();
  }

  async function addSubtask() {
    const next = subtask.trim();
    if (!next) return;
    try {
      await createItem({
        type: "task",
        title: next,
        parent_id: item.id,
        project_id: item.project?.id ?? null,
        context_id: item.project ? null : (item.context?.id ?? null),
      });
      setSubtask("");
      await queryClient.invalidateQueries({ queryKey: ["items"] });
    } catch (error) {
      pushToast(error instanceof Error ? error.message : t("editor.unavailable"));
    }
  }

  async function remove() {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteItem(item.id);
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
      onClose();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : t("editor.unavailable"));
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <Modal title={t("editor.task")} onClose={onClose}>
      <form
        className="flex max-h-[80dvh] flex-col gap-3 overflow-y-auto p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void saveAndClose();
        }}
      >
        <div className="flex items-start gap-2">
          <StatusSelect
            status={status}
            onChange={(next) => {
              setStatus(next);
              void save({ status: next });
            }}
          />
          <PrioritySelect
            priority={priority}
            className="mt-1"
            onChange={(next) => {
              setPriority(next);
              void save({ priority: next });
            }}
          />
          <input
            value={title}
            aria-label={t("editor.title")}
            placeholder={t("editor.title")}
            className="min-h-10 min-w-0 flex-1 rounded-md border-0 bg-transparent px-0 text-[16px] font-medium outline-none placeholder:text-fg-muted"
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void saveAndClose();
              }
            }}
          />
          {confirmDelete ? (
            <Button type="button" variant="consult" tone="danger" disabled={deleting} onClick={() => void remove()}>
              {t("inbox.deleteConfirm")}
            </Button>
          ) : (
            <IconButton label={t("inbox.delete")} onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} />
            </IconButton>
          )}
        </div>
        <TaskDetails
          due={due}
          starts={starts}
          assignee={assignee}
          priority={priority}
          projectId={projectId}
          contextId={contextId}
          projects={projects.data?.projects ?? []}
          contexts={contexts.data?.contexts ?? []}
          onDue={(next) => {
            setDue(next);
            void save({ due_on: next || null });
          }}
          onStarts={(next) => {
            setStarts(next);
            void save({ starts_on: next || null });
          }}
          onAssignee={(next) => setAssignee(next)}
          onAssigneeCommit={(next) => void save({ assignee: next.trim() || null })}
          onPriority={(next) => {
            setPriority(next);
            void save({ priority: next });
          }}
          onProject={(next) => {
            setProjectId(next);
            if (next) setContextId("");
            void save({ project_id: next || null, context_id: next ? null : contextId || null });
          }}
          onContext={(next) => {
            setContextId(next);
            setProjectId("");
            void save({ project_id: null, context_id: next || null });
          }}
        />
        {item.parent_id ? null : (
          <div>
            <p className="text-[13px] text-fg-secondary">{t("task.subtasks")}</p>
            <ul className="mt-1.5">
              {(children.data?.items ?? []).map((child) => (
                <li key={child.id} className="flex min-h-8 items-center gap-2">
                  <StatusSelect
                    status={child.status ?? "todo"}
                    showLabel={false}
                    onChange={(next) =>
                      void patchItem(child.id, { status: next }).then(() =>
                        queryClient.invalidateQueries({ queryKey: ["items"] }),
                      )
                    }
                  />
                  <PrioritySelect
                    priority={child.priority}
                    onChange={(next) =>
                      void patchItem(child.id, { priority: next }).then(() =>
                        queryClient.invalidateQueries({ queryKey: ["items"] }),
                      )
                    }
                  />
                  <button type="button" className="min-w-0 flex-1 truncate text-left text-[13px]" onClick={() => onOpen?.(child)}>
                    {child.title}
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <input
                value={subtask}
                aria-label={t("task.addSubtask")}
                placeholder={t("task.addSubtask")}
                className="min-h-8 min-w-0 flex-1 rounded-md border border-border bg-canvas px-2.5 text-[13px] outline-none focus:border-fg"
                onChange={(event) => setSubtask(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void addSubtask();
                  }
                }}
              />
              <Button type="button" variant="consult" disabled={subtask.trim().length === 0} onClick={() => void addSubtask()}>
                {t("common.create")}
              </Button>
            </div>
          </div>
        )}
        <textarea
          value={body}
          aria-label={t("task.notes")}
          placeholder={t("task.notes")}
          className="min-h-28 rounded-md border border-border bg-canvas px-2.5 py-2 text-[13px] leading-[1.6] outline-none focus:border-fg"
          onChange={(event) => setBody(event.target.value)}
        />
        <Attachments itemId={item.id} />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="consult" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" variant="go" disabled={saving || title.trim().length === 0}>
            {t("common.save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function TaskDetails({
  due,
  starts,
  assignee,
  priority,
  projectId,
  contextId,
  projects,
  contexts,
  onDue,
  onStarts,
  onAssignee,
  onAssigneeCommit,
  onPriority,
  onProject,
  onContext,
}: {
  due: string;
  starts: string;
  assignee: string;
  priority: ItemPriority;
  projectId: string;
  contextId: string;
  projects: Array<{ id: string; name: string }>;
  contexts: Array<{ id: string; name: string }>;
  onDue: (value: string) => void;
  onStarts: (value: string) => void;
  onAssignee: (value: string) => void;
  onAssigneeCommit?: (value: string) => void;
  onPriority: (value: ItemPriority) => void;
  onProject: (value: string) => void;
  onContext: (value: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="block text-[12px] text-fg-muted">
        {t("task.starts")}
        <input type="date" value={starts} className={fieldClass} onChange={(event) => onStarts(event.target.value)} />
      </label>
      <label className="block text-[12px] text-fg-muted">
        {t("task.due")}
        <input type="date" value={due} className={fieldClass} onChange={(event) => onDue(event.target.value)} />
      </label>
      <label className="block text-[12px] text-fg-muted">
        {t("task.priority")}
        <select
          value={priority}
          className={fieldClass}
          onChange={(event) => onPriority(event.target.value as ItemPriority)}
        >
          {PRIORITIES.map((option) => (
            <option key={option} value={option}>
              {t(`task.${option}` as "task.none")}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-[12px] text-fg-muted">
        {t("task.assignee")}
        <input
          value={assignee}
          placeholder={t("task.assigneePlaceholder")}
          className={fieldClass}
          onChange={(event) => onAssignee(event.target.value)}
          onBlur={(event) => onAssigneeCommit?.(event.target.value)}
        />
      </label>
      <label className="block text-[12px] text-fg-muted sm:col-span-2">
        {t("task.project")}
        <select value={projectId} className={fieldClass} onChange={(event) => onProject(event.target.value)}>
          <option value="">{t("tasks.noProject")}</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>
      {projectId ? null : (
        <label className="block text-[12px] text-fg-muted sm:col-span-2">
          {t("tasks.context")}
          <select value={contextId} className={fieldClass} onChange={(event) => onContext(event.target.value)}>
            <option value="">{t("tasks.noContext")}</option>
            {contexts.map((context) => (
              <option key={context.id} value={context.id}>
                {context.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
