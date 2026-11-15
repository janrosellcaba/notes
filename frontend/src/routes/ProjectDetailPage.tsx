import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Board } from "../components/kanban/Board";
import { MonthCalendar } from "../components/home/MonthCalendar";
import { TaskCreateDialog, TaskEditor } from "../components/items/TaskEditor";
import { Button } from "../components/ui/Button";
import { ContextBadge } from "../components/ui/ContextBadge";
import { PageHeader } from "../components/ui/PageHeader";
import { PriorityMark } from "../components/ui/PriorityMark";
import { RowLink } from "../components/ui/RowLink";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { StatusSelect } from "../components/ui/StatusSelect";
import { Modal } from "../components/ui/Modal";
import { Popover } from "../components/ui/Popover";
import { TextField } from "../components/ui/TextField";
import { archiveProject, deleteProject, getProject, listItems, patchItem, patchProject } from "../lib/api";
import { mapItem, restoreLists, snapshotLists } from "../lib/cache";
import { groupTasks, relativeTime, todayISO } from "../lib/dates";
import { useI18n, type MessageKey } from "../lib/i18n";
import { queryKeys } from "../lib/queryKeys";
import { useUi } from "../stores/ui";
import type { Item, ItemFilters, ItemStatus } from "../types/api";

type Tab = "notes" | "tasks" | "meetings" | "calendar";
type TasksView = "list" | "board";

function tabFrom(value: string | null): Tab {
  if (value === "tasks" || value === "board" || value === "meetings" || value === "calendar") {
    return value === "board" ? "tasks" : value;
  }
  return "notes";
}

function tasksViewFrom(tab: string | null, view: string | null, fallback: TasksView): TasksView {
  if (tab === "board") return "board";
  if (view === "board" || view === "list") return view;
  return fallback;
}

export function ProjectDetailPage() {
  const { projectId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = tabFrom(params.get("tab"));
  const tasksViewPref = useUi((state) => state.tasksView);
  const tasksView = tasksViewFrom(params.get("tab"), params.get("view"), tasksViewPref);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const openCapture = useUi((state) => state.openCapture);
  const pushToast = useUi((state) => state.pushToast);
  const { t } = useI18n();
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Item | null>(null);
  const [creating, setCreating] = useState(false);
  const today = todayISO();
  const project = useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: () => getProject(projectId),
    enabled: projectId.length > 0,
  });
  const noteFilters = useMemo<ItemFilters>(() => ({ type: "note", project_id: projectId, limit: 200 }), [projectId]);
  const meetingFilters = useMemo<ItemFilters>(() => ({ type: "meeting", project_id: projectId, limit: 200 }), [projectId]);
  const taskFilters = useMemo<ItemFilters>(
    () => ({
      type: "task",
      project_id: projectId,
      include_done: tasksView === "board",
      limit: 200,
      today,
    }),
    [projectId, tasksView, today],
  );
  const notes = useQuery({
    queryKey: queryKeys.items(noteFilters),
    queryFn: () => listItems(noteFilters),
    enabled: tab === "notes",
  });
  const meetings = useQuery({
    queryKey: queryKeys.items(meetingFilters),
    queryFn: () => listItems(meetingFilters),
    enabled: tab === "meetings",
  });
  const tasks = useQuery({
    queryKey: queryKeys.items(taskFilters),
    queryFn: () => listItems(taskFilters),
    enabled: tab === "tasks",
  });

  function selectTab(next: Tab) {
    const copy = new URLSearchParams(params);
    if (next === "notes") copy.delete("tab");
    else copy.set("tab", next);
    if (next !== "tasks") copy.delete("view");
    setParams(copy, { replace: true });
  }

  function setTasksView(next: TasksView) {
    const copy = new URLSearchParams(params);
    copy.set("tab", "tasks");
    copy.set("view", next);
    setParams(copy, { replace: true });
  }

  async function rename() {
    const next = name.trim();
    if (!next || !project.data) return;
    try {
      const saved = await patchProject(project.data.id, { name: next });
      queryClient.setQueryData(queryKeys.project(project.data.id), saved);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      setRenaming(false);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not rename the project");
    }
  }

  async function archive() {
    if (!project.data) return;
    setMenu(false);
    try {
      await archiveProject(project.data.id);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      void navigate("/projects");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not archive the project");
    }
  }

  async function remove() {
    if (!project.data) return;
    try {
      await deleteProject(project.data.id);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      void navigate("/projects");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not delete the project");
    }
  }

  async function setStatus(item: Item, status: ItemStatus) {
    if (item.status === status) return;
    const lists = snapshotLists(queryClient);
    mapItem(queryClient, item.id, (current) => ({
      ...current,
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
    }));
    try {
      const saved = await patchItem(item.id, { status });
      mapItem(queryClient, item.id, () => saved);
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
    } catch (error) {
      restoreLists(queryClient, lists);
      pushToast(error instanceof Error ? error.message : "Could not update the task");
    }
  }

  if (project.isPending) return <p className="text-fg-muted">{t("common.loading")}</p>;
  if (project.isError || !project.data) return <p>{t("project.missing")}</p>;
  const current = project.data;
  const meetingRows = [...(meetings.data?.items ?? [])].sort((left, right) => right.created_at.localeCompare(left.created_at));
  const nested = nestTasks(tasks.data?.items ?? []);
  const groups = groupTasks(nested.roots, today);
  const sections = [
    [t("tasks.overdue"), groups.overdue],
    [t("tasks.today"), groups.today],
    [t("tasks.upcoming"), groups.upcoming],
    [t("tasks.none"), groups.none],
  ] as const;
  const tabs: Tab[] = ["notes", "tasks", "meetings", "calendar"];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title={
          <span className="flex min-w-0 items-center gap-3">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: current.color }} />
            <span className="truncate">{current.name}</span>
          </span>
        }
        actions={
          <>
            <ContextBadge color={current.context.color} icon={current.context.icon} name={current.context.name} />
            <Popover
              open={menu}
              onClose={() => {
                setMenu(false);
                setConfirmDelete(false);
              }}
              className="right-0 left-auto"
              trigger={
                <Button variant="consult" aria-label="Project actions" onClick={() => setMenu((open) => !open)}>
                  ···
                </Button>
              }
            >
              <div className="flex min-w-40 flex-col p-1">
                <Button
                  variant="consult"
                  className="w-full justify-start"
                  onClick={() => {
                    setName(current.name);
                    setMenu(false);
                    setRenaming(true);
                  }}
                >
                  {t("project.rename")}
                </Button>
                <Button variant="consult" className="w-full justify-start" onClick={() => void archive()}>
                  {t("project.archive")}
                </Button>
                {confirmDelete ? (
                  <Button variant="consult" tone="danger" className="w-full justify-start" onClick={() => void remove()}>
                    {t("project.deleteConfirm")}
                  </Button>
                ) : (
                  <Button variant="consult" className="w-full justify-start" onClick={() => setConfirmDelete(true)}>
                    {t("project.delete")}
                  </Button>
                )}
              </div>
            </Popover>
          </>
        }
      />
      <div className="flex gap-1 border-b border-border-subtle" role="tablist">
        {tabs.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={`-mb-px min-h-9 border-b-2 px-3 text-[13px] font-medium ${
              tab === value ? "border-fg text-fg" : "border-transparent text-fg-muted hover:text-fg"
            }`}
            onClick={() => selectTab(value)}
          >
            {t(`project.${value}` as MessageKey)}
          </button>
        ))}
      </div>
      {tab === "notes" ? (
        <section className="flex flex-col gap-2">
          <Button variant="add" className="self-start" onClick={() => openCapture({ type: "note", projectId: current.id })}>
            {t("project.noteIn")}
          </Button>
          <ul>
            {(notes.data?.items ?? []).map((item) => (
              <li key={item.id}>
                <RowLink to={`/item/${item.id}`} title={item.title || t("common.untitled")} meta={relativeTime(item.updated_at)} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {tab === "tasks" ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="add" onClick={() => setCreating(true)}>
              {t("tasks.new")}
            </Button>
            <SegmentedControl
              label={t("settings.tasksView")}
              value={tasksView}
              onChange={setTasksView}
              options={[
                { value: "list", label: t("tasks.list") },
                { value: "board", label: t("tasks.board") },
              ]}
            />
          </div>
          {tasksView === "board" ? (
            <Board items={nested.roots} projectId={current.id} showProject={false} />
          ) : (
            <div className="flex flex-col gap-6">
              {sections.every(([, rows]) => rows.length === 0) ? <p className="text-fg-muted">{t("tasks.empty")}</p> : null}
              {sections.map(([label, rows]) =>
                rows.length === 0 ? null : (
                  <div key={label}>
                    <h2 className="mb-2 text-[13px] text-fg-muted">{label}</h2>
                    <ul>
                      {rows.map((item) => (
                        <li key={item.id}>
                          <ProjectTaskRow item={item} onOpen={setEditing} onStatus={(row, status) => void setStatus(row, status)} />
                          {(nested.children.get(item.id) ?? []).map((child) => (
                            <div key={child.id} className="pl-7">
                              <ProjectTaskRow item={child} onOpen={setEditing} onStatus={(row, status) => void setStatus(row, status)} />
                            </div>
                          ))}
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
              )}
            </div>
          )}
        </section>
      ) : null}
      {tab === "meetings" ? (
        <section className="flex flex-col gap-2">
          <Button variant="add" className="self-start" onClick={() => openCapture({ type: "meeting", projectId: current.id })}>
            {t("home.meeting")}
          </Button>
          <ul>
            {meetingRows.map((item) => (
              <li key={item.id}>
                <RowLink to={`/item/${item.id}`} title={item.title || t("common.untitled")} meta={item.created_at.slice(0, 10)} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {tab === "calendar" ? (
        <section className="flex flex-col gap-3">
          <p className="text-[13px] text-fg-muted">{t("project.calendarDetail")}</p>
          <MonthCalendar projectId={current.id} />
        </section>
      ) : null}
      {renaming ? (
        <Modal title={t("project.renameTitle")} onClose={() => setRenaming(false)}>
          <form
            className="flex flex-col gap-4 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void rename();
            }}
          >
            <TextField label="Name" value={name} onChange={(event) => setName(event.target.value)} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="consult" onClick={() => setRenaming(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" variant="go">
                Save
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
      {editing ? <TaskEditor item={editing} onClose={() => setEditing(null)} onOpen={setEditing} /> : null}
      {creating ? <TaskCreateDialog projectId={current.id} onClose={() => setCreating(false)} /> : null}
    </div>
  );
}

function nestTasks(items: Item[]): { roots: Item[]; children: Map<string, Item[]> } {
  const ids = new Set(items.map((item) => item.id));
  const children = new Map<string, Item[]>();
  const roots: Item[] = [];
  for (const item of items) {
    if (item.parent_id && ids.has(item.parent_id)) {
      const list = children.get(item.parent_id) ?? [];
      list.push(item);
      children.set(item.parent_id, list);
    } else {
      roots.push(item);
    }
  }
  return { roots, children };
}

function ProjectTaskRow({
  item,
  onOpen,
  onStatus,
}: {
  item: Item;
  onOpen: (item: Item) => void;
  onStatus: (item: Item, status: ItemStatus) => void;
}) {
  const { t } = useI18n();
  const done = item.status === "done";
  return (
    <div className="flex min-h-11 items-center gap-2 rounded-[8px] px-1 hover:bg-interactive">
      <StatusSelect status={item.status ?? "todo"} onChange={(status) => onStatus(item, status)} />
      <button type="button" className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left" onClick={() => onOpen(item)}>
        <span className={`min-w-0 flex-1 truncate ${done ? "text-fg-muted line-through" : ""}`}>
          {item.title || t("common.untitled")}
        </span>
        {item.subtask_total > 0 ? (
          <span className="font-mono text-[12px] text-fg-muted">
            {item.subtask_done}/{item.subtask_total}
          </span>
        ) : null}
        {item.due_on ? <span className="font-mono text-[13px] text-fg-muted">{item.due_on}</span> : null}
        <PriorityMark priority={item.priority} />
      </button>
    </div>
  );
}
