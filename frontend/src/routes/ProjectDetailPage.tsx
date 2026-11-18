import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Board } from "../components/kanban/Board";
import { MonthCalendar } from "../components/home/MonthCalendar";
import { TaskEditor } from "../components/items/TaskEditor";
import { nestTasks, TaskList } from "../components/items/TaskList";
import { Button } from "../components/ui/Button";
import { ContextBadge } from "../components/ui/ContextBadge";
import { NewButton } from "../components/ui/NewButton";
import { PageHeader } from "../components/ui/PageHeader";
import { RowLink } from "../components/ui/RowLink";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { Modal } from "../components/ui/Modal";
import { Popover } from "../components/ui/Popover";
import { TextField } from "../components/ui/TextField";
import { deleteProject, getProject, listItems, patchItem, patchProject } from "../lib/api";
import { mapItem, restoreLists, snapshotLists } from "../lib/cache";
import { relativeTime, todayISO } from "../lib/dates";
import { useI18n, type MessageKey } from "../lib/i18n";
import { queryKeys } from "../lib/queryKeys";
import { useUi } from "../stores/ui";
import type { Item, ItemFilters, ItemPriority, ItemStatus, ProjectStatus } from "../types/api";

type Tab = "notes" | "tasks" | "meetings" | "calendar";
type TasksView = "list" | "board";

function tabFrom(value: string | null): Tab {
  if (value === "notes" || value === "meetings" || value === "calendar") return value;
  return "tasks";
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
  const [editingProject, setEditingProject] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState("");
  const [due, setDue] = useState("");
  const [editing, setEditing] = useState<Item | null>(null);
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
      include_done: true,
      limit: 200,
      today,
    }),
    [projectId, today],
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
    if (next === "tasks") copy.delete("tab");
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

  async function saveProject() {
    const next = name.trim();
    if (!next || !project.data) return;
    try {
      const saved = await patchProject(project.data.id, { name: next, due_on: due || null });
      queryClient.setQueryData(queryKeys.project(project.data.id), saved);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      setEditingProject(false);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not update the project");
    }
  }

  async function setProjectStatus(status: ProjectStatus) {
    if (!project.data) return;
    setMenu(false);
    try {
      const saved = await patchProject(project.data.id, { status });
      queryClient.setQueryData(queryKeys.project(project.data.id), saved);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not update the project");
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

  async function setPriority(item: Item, priority: ItemPriority) {
    if (item.priority === priority) return;
    const lists = snapshotLists(queryClient);
    mapItem(queryClient, item.id, (current) => ({ ...current, priority }));
    try {
      const saved = await patchItem(item.id, { priority });
      mapItem(queryClient, item.id, () => saved);
      await queryClient.invalidateQueries({ queryKey: ["items"] });
    } catch (error) {
      restoreLists(queryClient, lists);
      pushToast(error instanceof Error ? error.message : "Could not update the task");
    }
  }

  if (project.isPending) return <p className="text-fg-muted">{t("common.loading")}</p>;
  if (project.isError || !project.data) return <p>{t("project.missing")}</p>;
  const current = project.data;
  const isActive = current.status === "active";
  const meetingRows = [...(meetings.data?.items ?? [])].sort((left, right) => right.created_at.localeCompare(left.created_at));
  const nested = nestTasks(tasks.data?.items ?? []);
  const tabs: Tab[] = ["notes", "tasks", "meetings", "calendar"];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title={
          <button
            type="button"
            className="flex min-w-0 items-center gap-3 rounded-md text-left hover:bg-interactive"
            title={t("project.edit")}
            onClick={() => {
              setName(current.name);
              setDue(current.due_on ?? "");
              setEditingProject(true);
            }}
          >
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: current.color }} />
            <span className="min-w-0 truncate">
              {current.name}
              {current.due_on ? (
                <span className="ml-2 font-mono text-[12px] font-normal text-fg-muted">{current.due_on}</span>
              ) : null}
              {current.status === "done" ? (
                <span className="ml-2 text-[12px] font-normal text-status-done">{t("project.statusDone")}</span>
              ) : null}
              {current.status === "cancelled" ? (
                <span className="ml-2 text-[12px] font-normal text-fg-muted">{t("project.statusCancelled")}</span>
              ) : null}
            </span>
          </button>
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
                    setDue(current.due_on ?? "");
                    setMenu(false);
                    setEditingProject(true);
                  }}
                >
                  {t("project.edit")}
                </Button>
                {current.status === "active" ? (
                  <>
                    <Button
                      variant="consult"
                      className="w-full justify-start"
                      onClick={() => void setProjectStatus("done")}
                    >
                      {t("project.markDone")}
                    </Button>
                    <Button
                      variant="consult"
                      className="w-full justify-start"
                      onClick={() => void setProjectStatus("cancelled")}
                    >
                      {t("project.markCancelled")}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="consult"
                    className="w-full justify-start"
                    onClick={() => void setProjectStatus("active")}
                  >
                    {t("project.reopen")}
                  </Button>
                )}
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
      {!isActive ? <p className="text-[13px] text-fg-muted">{t("project.closedHint")}</p> : null}
      {tab === "notes" ? (
        <section className="flex flex-col gap-2">
          {isActive ? (
            <NewButton className="self-start" onClick={() => openCapture({ type: "note", projectId: current.id })}>
              {t("project.noteIn")}
            </NewButton>
          ) : null}
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
            {isActive ? (
              <NewButton onClick={() => openCapture({ type: "task", projectId: current.id })}>
                {t("tasks.new")}
              </NewButton>
            ) : (
              <span />
            )}
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
            <Board items={nested.roots} projectId={current.id} showProject={false} onOpen={setEditing} />
          ) : (
            <TaskList
              items={tasks.data?.items ?? []}
              showProject={false}
              onOpen={setEditing}
              onStatus={(row, status) => void setStatus(row, status)}
              onPriority={(row, priority) => void setPriority(row, priority)}
            />
          )}
        </section>
      ) : null}
      {tab === "meetings" ? (
        <section className="flex flex-col gap-2">
          {isActive ? (
            <NewButton className="self-start" onClick={() => openCapture({ type: "meeting", projectId: current.id })}>
              {t("home.meeting")}
            </NewButton>
          ) : null}
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
      {editingProject ? (
        <Modal title={t("project.editTitle")} onClose={() => setEditingProject(false)}>
          <form
            className="flex flex-col gap-4 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void saveProject();
            }}
          >
            <TextField
              label={t("project.name")}
              value={name}
              autoFocus
              onChange={(event) => setName(event.target.value)}
            />
            <label className="block">
              <span className="mb-1.5 block text-[13px] text-fg-secondary">{t("project.due")}</span>
              <input
                type="date"
                value={due}
                className="min-h-9 w-full rounded-[8px] border border-border bg-canvas px-3 text-[14px] outline-none focus:border-fg"
                onChange={(event) => setDue(event.target.value)}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="consult" onClick={() => setEditingProject(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" variant="go" disabled={name.trim().length === 0}>
                {t("common.save")}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
      {editing ? <TaskEditor item={editing} onClose={() => setEditing(null)} onOpen={setEditing} /> : null}
    </div>
  );
}
