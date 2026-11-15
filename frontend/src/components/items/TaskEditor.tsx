import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { createItem, listItems, patchItem } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { queryKeys } from "../../lib/queryKeys";
import { useContexts, useProjectList } from "../../lib/queries";
import { useUi } from "../../stores/ui";
import type { Item, ItemPriority } from "../../types/api";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

const PRIORITIES: ItemPriority[] = ["none", "low", "medium", "high", "urgent"];

const fieldClass =
  "mt-1.5 min-h-11 w-full rounded-[8px] border border-border bg-canvas px-3 text-[16px] outline-none focus:border-fg";

export function TaskCreateDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const pushToast = useUi((state) => state.pushToast);
  const { t } = useI18n();
  const projects = useProjectList("all");
  const contexts = useContexts();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [starts, setStarts] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState<ItemPriority>("none");
  const [projectId, setProjectId] = useState("");
  const [contextId, setContextId] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    const nextTitle = title.trim();
    if (!nextTitle || pending) return;
    setPending(true);
    try {
      await createItem({
        type: "task",
        title: nextTitle,
        project_id: projectId || null,
        context_id: projectId ? null : contextId || null,
        priority,
        due_on: due || null,
        starts_on: starts || null,
        assignee: assignee.trim() || null,
      });
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
      onClose();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : t("editor.unavailable"));
      setPending(false);
    }
  }

  return (
    <Modal title={t("tasks.new")} onClose={onClose}>
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
          placeholder={t("editor.title")}
          className="min-h-11 rounded-[8px] border border-border bg-canvas px-3 text-[16px] outline-none focus:border-fg"
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
        <Button type="submit" disabled={pending || title.trim().length === 0}>
          {t("tasks.create")}
        </Button>
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
  const [projectId, setProjectId] = useState(item.project?.id ?? "");
  const [contextId, setContextId] = useState(item.project ? "" : (item.context?.id ?? ""));
  const [subtask, setSubtask] = useState("");
  const children = useQuery({
    queryKey: queryKeys.items({ parent_id: item.id, type: "task", include_done: true, limit: 100 }),
    queryFn: () => listItems({ parent_id: item.id, type: "task", include_done: true, limit: 100 }),
  });

  useEffect(() => {
    if (title === item.title && body === item.body_md) return;
    const timer = window.setTimeout(() => {
      void save({ title, body_md: body });
    }, 400);
    return () => window.clearTimeout(timer);
    // Title and body debounce. Selects save immediately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body]);

  async function save(patch: Parameters<typeof patchItem>[1]) {
    try {
      const saved = await patchItem(item.id, patch);
      queryClient.setQueryData(queryKeys.item(item.id), saved);
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
    } catch (error) {
      pushToast(error instanceof Error ? error.message : t("editor.unavailable"));
    }
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
        context_id: item.project ? null : item.context?.id ?? null,
      });
      setSubtask("");
      await queryClient.invalidateQueries({ queryKey: ["items"] });
    } catch (error) {
      pushToast(error instanceof Error ? error.message : t("editor.unavailable"));
    }
  }

  return (
    <Modal title={t("editor.task")} onClose={onClose}>
      <form className="flex flex-col gap-3 p-4" onSubmit={(event) => event.preventDefault()}>
        <input
          value={title}
          aria-label={t("editor.title")}
          className="min-h-11 rounded-[8px] border border-border bg-canvas px-3 text-[16px] outline-none focus:border-fg"
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
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={child.status === "done"}
                    aria-label={`${t("board.done")} ${child.title}`}
                    onChange={() => void patchItem(child.id, { status: child.status === "done" ? "todo" : "done" }).then(() => queryClient.invalidateQueries({ queryKey: ["items"] }))}
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
                className="min-h-8 min-w-0 flex-1 rounded-[8px] border border-border bg-canvas px-3 text-[13px] outline-none focus:border-fg"
                onChange={(event) => setSubtask(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void addSubtask();
                  }
                }}
              />
              <Button type="button" variant="secondary" onClick={() => void addSubtask()}>
                {t("common.create")}
              </Button>
            </div>
          </div>
        )}
        <textarea
          value={body}
          aria-label={t("task.notes")}
          className="min-h-32 rounded-[8px] border border-border bg-canvas px-3 py-2 text-[16px] leading-[1.6] outline-none focus:border-fg"
          onChange={(event) => setBody(event.target.value)}
        />
        <Link to={`/item/${item.id}`} className="min-h-8 self-start text-[13px] leading-8 underline">
          {t("editor.open")}
        </Link>
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
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[13px] text-fg-secondary">
          {t("task.starts")}
          <input type="date" value={starts} className={fieldClass} onChange={(event) => onStarts(event.target.value)} />
        </label>
        <label className="block text-[13px] text-fg-secondary">
          {t("task.due")}
          <input type="date" value={due} className={fieldClass} onChange={(event) => onDue(event.target.value)} />
        </label>
      </div>
      <label className="block text-[13px] text-fg-secondary">
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
      <label className="block text-[13px] text-fg-secondary">
        {t("task.assignee")}
        <input
          value={assignee}
          placeholder={t("task.assigneePlaceholder")}
          className={fieldClass}
          onChange={(event) => onAssignee(event.target.value)}
          onBlur={(event) => onAssigneeCommit?.(event.target.value)}
        />
      </label>
      <label className="block text-[13px] text-fg-secondary">
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
        <label className="block text-[13px] text-fg-secondary">
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
    </>
  );
}
