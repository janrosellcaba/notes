import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Board } from "../components/kanban/Board";
import { TaskCreateDialog, TaskEditor } from "../components/items/TaskEditor";
import { Button } from "../components/ui/Button";
import { ContextBadge } from "../components/ui/ContextBadge";
import { PageHeader } from "../components/ui/PageHeader";
import { PriorityMark } from "../components/ui/PriorityMark";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { StatusSelect } from "../components/ui/StatusSelect";
import { groupTasks, todayISO } from "../lib/dates";
import { listItems, patchItem } from "../lib/api";
import { mapItem, restoreLists, snapshotLists } from "../lib/cache";
import { queryKeys } from "../lib/queryKeys";
import { useI18n } from "../lib/i18n";
import { useUi } from "../stores/ui";
import type { Item, ItemFilters, ItemStatus } from "../types/api";

export function TasksPage() {
  const [params, setParams] = useSearchParams();
  const tasksView = useUi((state) => state.tasksView);
  const contextId = useUi((state) => state.contextId);
  const pushToast = useUi((state) => state.pushToast);
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const queryView = params.get("view");
  const view = queryView === "board" || queryView === "list" ? queryView : tasksView;
  const today = todayISO();
  const [editing, setEditing] = useState<Item | null>(null);
  const [creating, setCreating] = useState(false);
  const filters = useMemo<ItemFilters>(() => {
    const next: ItemFilters = {
      type: "task",
      include_done: view === "board",
      limit: 200,
      today,
    };
    if (contextId !== "all") next.context_id = contextId;
    return next;
  }, [view, today, contextId]);
  const tasks = useQuery({ queryKey: queryKeys.items(filters), queryFn: () => listItems(filters) });
  const nested = nestTasks(tasks.data?.items ?? []);
  const groups = groupTasks(nested.roots, today);
  const sections = [
    [t("tasks.overdue"), groups.overdue],
    [t("tasks.today"), groups.today],
    [t("tasks.upcoming"), groups.upcoming],
    [t("tasks.none"), groups.none],
  ] as const;

  function setView(next: "list" | "board") {
    const copy = new URLSearchParams(params);
    copy.set("view", next);
    setParams(copy, { replace: true });
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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <PageHeader
        title={t("tasks.title")}
        actions={
          <>
            <Button variant="add" onClick={() => setCreating(true)}>
              {t("tasks.new")}
            </Button>
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
      {view === "board" ? (
        <Board items={nested.roots} projectId={null} showProject />
      ) : (
        <div className="flex flex-col gap-6">
          {sections.every(([, rows]) => rows.length === 0) ? <p className="text-fg-muted">{t("tasks.empty")}</p> : null}
          {sections.map(([label, rows]) =>
            rows.length === 0 ? null : (
              <section key={label}>
                <h2 className="mb-2 text-[13px] text-fg-muted">{label}</h2>
                <ul>
                  {rows.map((item) => (
                    <li key={item.id}>
                      <TaskRow
                        item={item}
                        onOpen={setEditing}
                        onStatus={(row, status) => void setStatus(row, status)}
                      />
                      {(nested.children.get(item.id) ?? []).map((child) => (
                        <div key={child.id} className="pl-7">
                          <TaskRow
                            item={child}
                            onOpen={setEditing}
                            onStatus={(row, status) => void setStatus(row, status)}
                          />
                        </div>
                      ))}
                    </li>
                  ))}
                </ul>
              </section>
            ),
          )}
        </div>
      )}
      {editing ? <TaskEditor item={editing} onClose={() => setEditing(null)} onOpen={setEditing} /> : null}
      {creating ? <TaskCreateDialog onClose={() => setCreating(false)} /> : null}
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

function TaskRow({
  item,
  onOpen,
  onStatus,
}: {
  item: Item;
  onOpen: (item: Item) => void;
  onStatus: (item: Item, status: ItemStatus) => void;
}) {
  const { t } = useI18n();
  const badge = item.project
    ? { color: item.project.context.color, icon: item.project.context.icon, name: item.project.name }
    : item.context
      ? { color: item.context.color, icon: item.context.icon, name: item.context.name }
      : null;
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
        {badge ? <ContextBadge color={badge.color} icon={badge.icon} name={badge.name} /> : null}
      </button>
    </div>
  );
}
