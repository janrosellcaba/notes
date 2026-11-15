import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Board } from "../components/kanban/Board";
import { TaskEditor } from "../components/items/TaskEditor";
import { ContextBadge } from "../components/ui/ContextBadge";
import { PriorityMark } from "../components/ui/PriorityMark";
import { groupTasks, todayISO } from "../lib/dates";
import { listItems, patchItem } from "../lib/api";
import { mapItem, restoreLists, snapshotLists } from "../lib/cache";
import { queryKeys } from "../lib/queryKeys";
import { useI18n } from "../lib/i18n";
import { useUi } from "../stores/ui";
import type { Item, ItemFilters } from "../types/api";

export function TasksPage() {
  const [params, setParams] = useSearchParams();
  const setTasksView = useUi((state) => state.setTasksView);
  const contextId = useUi((state) => state.contextId);
  const pushToast = useUi((state) => state.pushToast);
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const view = params.get("view") === "board" ? "board" : "list";
  const today = todayISO();
  const [editing, setEditing] = useState<Item | null>(null);
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
  const groups = groupTasks(tasks.data?.items ?? [], today);
  const sections = [
    [t("tasks.overdue"), groups.overdue],
    [t("tasks.today"), groups.today],
    [t("tasks.upcoming"), groups.upcoming],
    [t("tasks.none"), groups.none],
  ] as const;

  function setView(next: "list" | "board") {
    const copy = new URLSearchParams(params);
    if (next === "list") copy.delete("view");
    else copy.set("view", next);
    setParams(copy, { replace: true });
    setTasksView(next);
  }

  async function toggle(item: Item) {
    const status = item.status === "done" ? "todo" : "done";
    const lists = snapshotLists(queryClient);
    mapItem(queryClient, item.id, (current) => ({ ...current, status }));
    try {
      const saved = await patchItem(item.id, { status });
      mapItem(queryClient, item.id, () => saved);
    } catch (error) {
      restoreLists(queryClient, lists);
      pushToast(error instanceof Error ? error.message : "Could not update the task");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[20px]">{t("tasks.title")}</h1>
        <div className="flex rounded-[8px] border border-border p-1">
          {(["list", "board"] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={`min-h-8 rounded-[8px] px-3 text-[13px] ${view === option ? "bg-interactive" : "text-fg-muted"}`}
              onClick={() => setView(option)}
            >
              {t(option === "list" ? "tasks.list" : "tasks.board")}
            </button>
          ))}
        </div>
      </div>
      {view === "board" ? (
        <Board items={tasks.data?.items ?? []} projectId={null} showProject />
      ) : (
        <div className="flex flex-col gap-6">
          {sections.every(([, rows]) => rows.length === 0) ? <p className="text-fg-muted">{t("tasks.empty")}</p> : null}
          {sections.map(([label, rows]) =>
            rows.length === 0 ? null : (
              <section key={label}>
                <h2 className="mb-2 text-[13px] text-fg-muted">{label}</h2>
                <ul>
                  {rows.map((item) => (
                    <li key={item.id} className="flex min-h-11 items-center gap-3 rounded-[8px] px-1 hover:bg-interactive">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={item.status === "done"}
                        aria-label={`${t("board.done")} ${item.title || t("common.untitled")}`}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => void toggle(item)}
                      />
                      <button type="button" className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setEditing(item)}>
                        <span className="min-w-0 flex-1 truncate">{item.title || t("common.untitled")}</span>
                        <span className="font-mono text-[13px] text-fg-muted">{item.due_on ?? ""}</span>
                        <PriorityMark priority={item.priority} />
                        <ContextBadge
                          color={item.project?.context.color ?? "#71717A"}
                          icon={item.project?.context.icon ?? "layers"}
                          name={item.project?.name ?? t("inbox.title")}
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ),
          )}
        </div>
      )}
      {editing ? <TaskEditor item={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
