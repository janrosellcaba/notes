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
import { useQueryClient } from "@tanstack/react-query";

import { mapItem, restoreLists, snapshotLists } from "../../lib/cache";
import { createItem, moveItem, newIdempotencyKey } from "../../lib/api";
import { useDesktop } from "../../lib/useDesktop";
import { useUi } from "../../stores/ui";
import type { Item, ItemStatus } from "../../types/api";
import { DropColumn, PlainColumn } from "./Column";
import { COLUMNS, statusFromDrop, type ColumnStatus } from "./columns";

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
}: {
  items: Item[];
  projectId: string | null;
  showProject: boolean;
}) {
  const desktop = useDesktop();
  const queryClient = useQueryClient();
  const pushToast = useUi((state) => state.pushToast);

  async function addCard(status: ColumnStatus, title: string) {
    try {
      await createItem({ type: "task", title, status, project_id: projectId }, newIdempotencyKey());
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
        {COLUMNS.map((column) => (
          <PlainColumn
            key={column.status}
            label={column.label}
            items={columnItems(items, column.status)}
            showProject={showProject}
            onAdd={(title) => void addCard(column.status, title)}
            onMove={(item, status) => void move(item, status, null, null)}
          />
        ))}
      </div>
    );
  }

  return <DesktopBoard items={items} showProject={showProject} onAdd={addCard} onMove={move} onDragEnd={onDragEnd} />;
}

function DesktopBoard({
  items,
  showProject,
  onAdd,
  onMove,
  onDragEnd,
}: {
  items: Item[];
  showProject: boolean;
  onAdd: (status: ColumnStatus, title: string) => Promise<void>;
  onMove: (item: Item, status: ColumnStatus, beforeId: string | null, afterId: string | null) => Promise<void>;
  onDragEnd: (event: DragEndEvent) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((column) => (
          <DropColumn
            key={column.status}
            status={column.status}
            label={column.label}
            items={columnItems(items, column.status)}
            showProject={showProject}
            onAdd={(title) => void onAdd(column.status, title)}
            onMove={(item, status) => void onMove(item, status, null, null)}
          />
        ))}
      </div>
    </DndContext>
  );
}
