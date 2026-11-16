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
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { mapItem, restoreLists, snapshotLists } from "../../lib/cache";
import { filedContext } from "../../lib/capture";
import { createItem, moveItem, newIdempotencyKey } from "../../lib/api";
import { useI18n, type MessageKey } from "../../lib/i18n";
import { useDesktop } from "../../lib/useDesktop";
import { useUi } from "../../stores/ui";
import type { Item, ItemStatus } from "../../types/api";
import { DropColumn, PlainColumn } from "./Column";
import { statusFromDrop, type ColumnStatus } from "./columns";

function sameProject(left: Item, right: Item): boolean {
  return (left.project?.id ?? null) === (right.project?.id ?? null);
}

function columnItems(items: Item[], status: ItemStatus): Item[] {
  return items
    .filter((item) => item.status === status)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.created_at.localeCompare(b.created_at));
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
  const [openEmpty, setOpenEmpty] = useState<string[]>([]);
  const [closed, setClosed] = useState<string[]>([]);

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
    const lists = snapshotLists(queryClient);
    mapItem(queryClient, item.id, (current) => ({ ...current, status }));
    try {
      const saved = await moveItem(item.id, { status, before_id: beforeId, after_id: afterId });
      mapItem(queryClient, item.id, () => saved);
      await queryClient.invalidateQueries({ queryKey: ["items"] });
    } catch (error) {
      restoreLists(queryClient, lists);
      pushToast(error instanceof Error ? error.message : "Could not move the card");
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

  if (!desktop) {
    return (
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4">
        {order.map((status) => {
          const rows = columnItems(items, status);
          return (
            <PlainColumn
              key={status}
              label={t(`board.${status}` as MessageKey)}
              items={rows}
              showProject={showProject}
              minimized={minimized(status, rows.length)}
              onToggle={() => toggle(status, rows.length)}
              onOpen={onOpen}
              onAdd={(title) => void addCard(status, title)}
              onMove={(item, next) => void move(item, next, null, null)}
            />
          );
        })}
      </div>
    );
  }

  return (
    <DesktopBoard
      items={items}
      showProject={showProject}
      onOpen={onOpen}
      onAdd={addCard}
      onMove={move}
      onDragEnd={onDragEnd}
      minimized={minimized}
      onToggle={toggle}
    />
  );
}

function DesktopBoard({
  items,
  showProject,
  onOpen,
  onAdd,
  onMove,
  onDragEnd,
  minimized,
  onToggle,
}: {
  items: Item[];
  showProject: boolean;
  onOpen: (item: Item) => void;
  onAdd: (status: ColumnStatus, title: string) => Promise<void>;
  onMove: (item: Item, status: ColumnStatus, beforeId: string | null, afterId: string | null) => Promise<void>;
  onDragEnd: (event: DragEndEvent) => void;
  minimized: (status: ColumnStatus, count: number) => boolean;
  onToggle: (status: ColumnStatus, count: number) => void;
}) {
  const order = useUi((state) => state.boardOrder);
  const { t } = useI18n();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {order.map((status) => {
          const rows = columnItems(items, status);
          return (
            <DropColumn
              key={status}
              status={status}
              label={t(`board.${status}` as MessageKey)}
              items={rows}
              showProject={showProject}
              minimized={minimized(status, rows.length)}
              onToggle={() => onToggle(status, rows.length)}
              onOpen={onOpen}
              onAdd={(title) => void onAdd(status, title)}
              onMove={(item, next) => void onMove(item, next, null, null)}
            />
          );
        })}
      </div>
    </DndContext>
  );
}
