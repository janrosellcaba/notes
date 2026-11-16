import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Board } from "../components/kanban/Board";
import { TaskCreateDialog, TaskEditor } from "../components/items/TaskEditor";
import { nestTasks, TaskList } from "../components/items/TaskList";
import { NewButton } from "../components/ui/NewButton";
import { PageHeader } from "../components/ui/PageHeader";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { todayISO } from "../lib/dates";
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
      include_done: true,
      limit: 200,
      today,
    };
    if (contextId !== "all") next.context_id = contextId;
    return next;
  }, [today, contextId]);
  const tasks = useQuery({ queryKey: queryKeys.items(filters), queryFn: () => listItems(filters) });
  const nested = nestTasks(tasks.data?.items ?? []);

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
            <NewButton onClick={() => setCreating(true)}>{t("tasks.new")}</NewButton>
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
        <Board items={nested.roots} projectId={null} showProject onOpen={setEditing} />
      ) : (
        <TaskList
          items={tasks.data?.items ?? []}
          onOpen={setEditing}
          onStatus={(row, status) => void setStatus(row, status)}
        />
      )}
      {editing ? <TaskEditor item={editing} onClose={() => setEditing(null)} onOpen={setEditing} /> : null}
      {creating ? <TaskCreateDialog onClose={() => setCreating(false)} /> : null}
    </div>
  );
}
