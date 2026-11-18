import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Board } from "../components/kanban/Board";
import { TaskEditor } from "../components/items/TaskEditor";
import { nestTasks, TaskList } from "../components/items/TaskList";
import { EmptyState } from "../components/ui/EmptyState";
import { ListFilter, matchesQuery } from "../components/ui/ListFilter";
import { NewButton } from "../components/ui/NewButton";
import { PageHeader } from "../components/ui/PageHeader";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { todayISO } from "../lib/dates";
import { listItems, patchItem } from "../lib/api";
import { mapItem, restoreLists, snapshotLists } from "../lib/cache";
import { FIELD_SELECT } from "../lib/field";
import { applyTaskStatuses, softDeleteItems } from "../lib/taskActions";
import { queryKeys } from "../lib/queryKeys";
import { useI18n } from "../lib/i18n";
import { useProjectList } from "../lib/queries";
import { useUi } from "../stores/ui";
import type { Item, ItemFilters, ItemPriority, ItemStatus } from "../types/api";

export function TasksPage() {
  const [params, setParams] = useSearchParams();
  const tasksView = useUi((state) => state.tasksView);
  const contextId = useUi((state) => state.contextId);
  const pushToast = useUi((state) => state.pushToast);
  const openCapture = useUi((state) => state.openCapture);
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const queryView = params.get("view");
  const view = queryView === "board" || queryView === "list" ? queryView : tasksView;
  const dueFilter = params.get("due") === "today" ? "today" : "all";
  const today = todayISO();
  const [editing, setEditing] = useState<Item | null>(null);
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const projects = useProjectList(contextId);
  const filters = useMemo<ItemFilters>(() => {
    const next: ItemFilters = {
      type: "task",
      include_done: true,
      limit: 200,
      today,
    };
    if (contextId !== "all") next.context_id = contextId;
    return next;
  }, [today, contextId]);
  const tasks = useQuery({ queryKey: queryKeys.items(filters), queryFn: () => listItems(filters) });
  const filteredItems = useMemo(() => {
    return (tasks.data?.items ?? [])
      .filter((item) => (dueFilter === "today" ? item.due_on === today : true))
      .filter((item) => (projectFilter === "all" ? true : item.project?.id === projectFilter))
      .filter((item) =>
        priorityFilter === "all" ? true : (item.priority ?? "none") === priorityFilter,
      )
      .filter((item) =>
        matchesQuery(`${item.title} ${item.project?.name ?? ""} ${item.assignee ?? ""}`, query),
      );
  }, [tasks.data?.items, projectFilter, priorityFilter, query, dueFilter, today]);
  const nested = nestTasks(filteredItems);

  function setView(next: "list" | "board") {
    const copy = new URLSearchParams(params);
    copy.set("view", next);
    setParams(copy, { replace: true });
  }

  async function setStatus(item: Item, status: ItemStatus) {
    await applyTaskStatuses(
      queryClient,
      [{ item, status }],
      {
        pushToast,
        message: t("tasks.statusUpdated"),
        undoLabel: t("common.undo"),
      },
    );
  }

  async function setBulkStatus(rows: Item[], status: ItemStatus) {
    await applyTaskStatuses(
      queryClient,
      rows.map((item) => ({ item, status })),
      {
        pushToast,
        message: t("tasks.bulkUpdated", { count: String(rows.length) }),
        undoLabel: t("common.undo"),
      },
    );
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

  async function removeTask(item: Item) {
    await softDeleteItems(queryClient, [item], {
      pushToast,
      message: t("tasks.deleted"),
      undoLabel: t("common.undo"),
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <PageHeader
        title={t("tasks.title")}
        actions={
          <>
            <NewButton onClick={() => openCapture({ type: "task" })}>{t("tasks.new")}</NewButton>
            <SegmentedControl
              label={t("settings.tasksView")}
              value={view}
              onChange={setView}
              options={[
                { value: "list", label: t("tasks.list") },
                { value: "board", label: t("tasks.board") },
              ]}
            />
          </>
        }
      />
      <ListFilter value={query} onChange={setQuery} placeholder={t("filter.tasks")}>
        <select
          aria-label={t("filter.project")}
          value={projectFilter}
          className={`${FIELD_SELECT} w-auto`}
          onChange={(event) => setProjectFilter(event.target.value)}
        >
          <option value="all">{t("filter.anyProject")}</option>
          {(projects.data?.projects ?? []).map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <select
          aria-label={t("filter.priority")}
          value={priorityFilter}
          className={`${FIELD_SELECT} w-auto`}
          onChange={(event) => setPriorityFilter(event.target.value)}
        >
          <option value="all">{t("filter.anyPriority")}</option>
          <option value="urgent">{t("task.urgent")}</option>
          <option value="high">{t("task.high")}</option>
          <option value="medium">{t("task.medium")}</option>
          <option value="low">{t("task.low")}</option>
          <option value="none">{t("task.none")}</option>
        </select>
      </ListFilter>
      {!tasks.isPending && filteredItems.length === 0 ? (
        <EmptyState action={<NewButton onClick={() => openCapture({ type: "task" })}>{t("tasks.new")}</NewButton>}>
          {dueFilter === "today" ? t("tasks.emptyToday") : t("tasks.empty")}
        </EmptyState>
      ) : view === "board" ? (
        <Board items={nested.roots} projectId={null} showProject onOpen={setEditing} />
      ) : (
        <TaskList
          items={filteredItems}
          onOpen={setEditing}
          onStatus={(row, status) => void setStatus(row, status)}
          onBulkStatus={(rows, status) => void setBulkStatus(rows, status)}
          onPriority={(row, priority) => void setPriority(row, priority)}
          onDelete={(row) => void removeTask(row)}
        />
      )}
      {editing ? <TaskEditor item={editing} onClose={() => setEditing(null)} onOpen={setEditing} /> : null}
    </div>
  );
}
