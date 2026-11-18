import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { mapItem, restoreLists, snapshotLists } from "../../lib/cache";
import { filedContext } from "../../lib/capture";
import { createItem, moveItem, newIdempotencyKey, patchItem } from "../../lib/api";
import { byPriorityThenCreated, COLLAPSED_BY_DEFAULT } from "../../lib/dates";
import { useI18n, type MessageKey } from "../../lib/i18n";
import { useDesktop } from "../../lib/useDesktop";
import { useUi } from "../../stores/ui";
import type { Item, ItemStatus } from "../../types/api";
import { Button } from "../ui/Button";
import { DropColumn, PlainColumn } from "./Column";
import { statusFromDrop, type ColumnStatus } from "./columns";

function sameProject(left: Item, right: Item): boolean {
  return (left.project?.id ?? null) === (right.project?.id ?? null);
}

function columnItems(items: Item[], status: ItemStatus): Item[] {
  return items.filter((item) => item.status === status).sort(byPriorityThenCreated);
}

function around(items: Item[], item: Item, status: ItemStatus): { before: string | null; after: string | null } {
  const column = columnItems(items, status).filter((candidate) => sameProject(candidate, item));
  const index = column.findIndex((candidate) => candidate.id === item.id);
  return { before: column[index - 1]?.id ?? null, after: column[index + 1]?.id ?? null };
}

export function Board({
  items,
  projectId,
  showProject,
  onOpen,
}: {
  items: Item[];
  projectId: string | null;
  showProject: boolean;
  onOpen: (item: Item) => void;
}) {
  const desktop = useDesktop();
  const queryClient = useQueryClient();
  const pushToast = useUi((state) => state.pushToast);
  const contextId = useUi((state) => state.contextId);
  const order = useUi((state) => state.boardOrder);
  const { t } = useI18n();
  const [showClosed, setShowClosed] = useState(false);
  const [openEmpty, setOpenEmpty] = useState<string[]>([]);
  const [closed, setClosed] = useState<string[]>(() => [...COLLAPSED_BY_DEFAULT]);
  const [selected, setSelected] = useState<string[]>([]);
  const [lastClicked, setLastClicked] = useState<string | null>(null);
  const visibleOrder = useMemo(
    () => (showClosed ? order : order.filter((status) => status !== "done" && status !== "cancelled")),
    [order, showClosed],
  );
  const closedCount = useMemo(
    () => columnItems(items, "done").length + columnItems(items, "cancelled").length,
    [items],
  );

  const flatItems = useMemo(
    () => visibleOrder.flatMap((status) => columnItems(items, status)),
    [items, visibleOrder],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSelected([]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function minimized(status: ColumnStatus, count: number) {
    if (count === 0) return !openEmpty.includes(status);
    return closed.includes(status);
  }

  function toggle(status: ColumnStatus, count: number) {
    if (count === 0) {
      setOpenEmpty((current) =>
        current.includes(status) ? current.filter((entry) => entry !== status) : [...current, status],
      );
      return;
    }
    setClosed((current) =>
      current.includes(status) ? current.filter((entry) => entry !== status) : [...current, status],
    );
  }

  function selectRange(fromId: string, toId: string) {
    const from = flatItems.findIndex((item) => item.id === fromId);
    const to = flatItems.findIndex((item) => item.id === toId);
    if (from < 0 || to < 0) return;
    const [start, end] = from < to ? [from, to] : [to, from];
    setSelected(flatItems.slice(start, end + 1).map((item) => item.id));
  }

  function onCardSelect(item: Item, event: { shiftKey: boolean }) {
    if (!event.shiftKey) return;
    if (lastClicked) selectRange(lastClicked, item.id);
    else setSelected([item.id]);
    setLastClicked(item.id);
  }

  async function addCard(status: ColumnStatus, title: string) {
    try {
      await createItem(
        {
          type: "task",
          title,
          status,
          project_id: projectId,
          context_id: filedContext(contextId, projectId),
        },
        newIdempotencyKey(),
      );
      await queryClient.invalidateQueries({ queryKey: ["items"] });
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not add the card");
    }
  }

  async function move(item: Item, status: ColumnStatus, beforeId: string | null, afterId: string | null) {
    const previous = (item.status ?? "todo") as ItemStatus;
    const lists = snapshotLists(queryClient);
    mapItem(queryClient, item.id, (current) => ({ ...current, status }));
    try {
      const saved = await moveItem(item.id, { status, before_id: beforeId, after_id: afterId });
      mapItem(queryClient, item.id, () => saved);
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      if (previous !== status) {
        pushToast(t("tasks.statusUpdated"), undefined, {
          label: t("common.undo"),
          run: () => {
            void move(saved, previous, null, null);
          },
        });
      }
    } catch (error) {
      restoreLists(queryClient, lists);
      pushToast(error instanceof Error ? error.message : "Could not move the card");
    }
  }

  async function moveMany(moving: Item[], status: ColumnStatus) {
    const previous = moving.map((item) => ({
      item,
      status: (item.status ?? "todo") as ItemStatus,
    }));
    const lists = snapshotLists(queryClient);
    for (const item of moving) {
      mapItem(queryClient, item.id, (current) => ({ ...current, status }));
    }
    try {
      await Promise.all(moving.map((item) => patchItem(item.id, { status })));
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      pushToast(t("tasks.bulkUpdated", { count: String(moving.length) }), undefined, {
        label: t("common.undo"),
        run: () => {
          void (async () => {
            for (const entry of previous) {
              await patchItem(entry.item.id, { status: entry.status });
            }
            await queryClient.invalidateQueries({ queryKey: ["items"] });
          })();
        },
      });
    } catch (error) {
      restoreLists(queryClient, lists);
      pushToast(error instanceof Error ? error.message : "Could not move the cards");
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const active = items.find((item) => item.id === String(event.active.id));
    if (!active || !event.over) return;
    const overId = String(event.over.id);
    if (overId === active.id) return;
    const overItem = items.find((item) => item.id === overId);
    const status = statusFromDrop(overId) ?? overItem?.status ?? null;
    if (!status) return;

    const cohort =
      selected.includes(active.id) && selected.length > 1
        ? items.filter((item) => selected.includes(item.id))
        : [active];

    if (cohort.length > 1) {
      const needsMove = cohort.some((item) => item.status !== status);
      if (!needsMove) return;
      void moveMany(cohort, status);
      setSelected([]);
      return;
    }

    const column = columnItems(items, status).filter(
      (candidate) => candidate.id !== active.id && sameProject(candidate, active),
    );
    let beforeId: string | null;
    let afterId: string | null;
    if (overItem && sameProject(overItem, active) && overItem.status === status) {
      const index = column.findIndex((item) => item.id === overItem.id);
      beforeId = column[index - 1]?.id ?? null;
      afterId = overItem.id;
    } else {
      beforeId = column.at(-1)?.id ?? null;
      afterId = null;
    }
    if (!active.status) return;
    const current = around(items, active, active.status);
    const unchanged = status === active.status && beforeId === current.before && afterId === current.after;
    if (unchanged) return;
    void move(active, status, beforeId, afterId);
  }

  function bulkStatus(status: ItemStatus) {
    const chosen = items.filter((item) => selected.includes(item.id));
    if (chosen.length === 0) return;
    void moveMany(chosen, status);
    setSelected([]);
  }

  const toolbar = (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Button type="button" variant="consult" onClick={() => setShowClosed((value) => !value)}>
        {showClosed ? t("board.hideClosed") : t("board.showClosed", { count: String(closedCount) })}
      </Button>
      {selected.length > 0 ? (
        <>
          <span className="text-[13px] text-fg-secondary">{t("tasks.selected", { count: String(selected.length) })}</span>
          <Button type="button" variant="consult" onClick={() => bulkStatus("in_progress")}>
            {t("tasks.bulkInProgress")}
          </Button>
          <Button type="button" variant="consult" onClick={() => bulkStatus("todo")}>
            {t("tasks.bulkTodo")}
          </Button>
          <Button type="button" variant="consult" onClick={() => bulkStatus("done")}>
            {t("tasks.bulkDone")}
          </Button>
          <Button type="button" variant="consult" onClick={() => setSelected([])}>
            {t("tasks.clearSelection")}
          </Button>
        </>
      ) : null}
    </div>
  );

  if (!desktop) {
    return (
      <div>
        {toolbar}
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4">
          {visibleOrder.map((status) => {
            const rows = columnItems(items, status);
            return (
              <PlainColumn
                key={status}
                label={`${t(`board.${status}` as MessageKey)} · ${rows.length}`}
                items={rows}
                showProject={showProject}
                selectedIds={selected}
                minimized={minimized(status, rows.length)}
                onToggle={() => toggle(status, rows.length)}
                onOpen={onOpen}
                onAdd={(title) => void addCard(status, title)}
                onMove={(item, next) => void move(item, next, null, null)}
                onSelect={onCardSelect}
                onAnchor={(item) => setLastClicked(item.id)}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <DesktopBoard
      items={items}
      order={visibleOrder}
      showProject={showProject}
      selected={selected}
      toolbar={toolbar}
      onOpen={onOpen}
      onAdd={addCard}
      onMove={move}
      onDragEnd={onDragEnd}
      minimized={minimized}
      onToggle={toggle}
      onSelect={onCardSelect}
      onAnchor={(item) => setLastClicked(item.id)}
    />
  );
}

function DesktopBoard({
  items,
  order,
  showProject,
  selected,
  toolbar,
  onOpen,
  onAdd,
  onMove,
  onDragEnd,
  minimized,
  onToggle,
  onSelect,
  onAnchor,
}: {
  items: Item[];
  order: ColumnStatus[];
  showProject: boolean;
  selected: string[];
  toolbar: ReactNode;
  onOpen: (item: Item) => void;
  onAdd: (status: ColumnStatus, title: string) => Promise<void>;
  onMove: (item: Item, status: ColumnStatus, beforeId: string | null, afterId: string | null) => Promise<void>;
  onDragEnd: (event: DragEndEvent) => void;
  minimized: (status: ColumnStatus, count: number) => boolean;
  onToggle: (status: ColumnStatus, count: number) => void;
  onSelect: (item: Item, event: { shiftKey: boolean }) => void;
  onAnchor: (item: Item) => void;
}) {
  const { t } = useI18n();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  return (
    <div>
      {toolbar}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {order.map((status) => {
            const rows = columnItems(items, status);
            return (
              <DropColumn
                key={status}
                status={status}
                label={`${t(`board.${status}` as MessageKey)} · ${rows.length}`}
                items={rows}
                showProject={showProject}
                selectedIds={selected}
                minimized={minimized(status, rows.length)}
                onToggle={() => onToggle(status, rows.length)}
                onOpen={onOpen}
                onAdd={(title) => void onAdd(status, title)}
                onMove={(item, next) => void onMove(item, next, null, null)}
                onSelect={onSelect}
                onAnchor={onAnchor}
              />
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}
