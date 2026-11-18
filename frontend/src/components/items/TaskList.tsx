import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";

import { groupTasksByStatus, LIST_STATUS_ORDER } from "../../lib/dates";
import { useI18n, type MessageKey } from "../../lib/i18n";
import { useDesktop } from "../../lib/useDesktop";
import type { Item, ItemStatus } from "../../types/api";
import { columnId, statusFromDrop } from "../kanban/columns";
import { ContextBadge } from "../ui/ContextBadge";
import { PriorityMark } from "../ui/PriorityMark";
import { StatusSelect } from "../ui/StatusSelect";

export function nestTasks(items: Item[]): { roots: Item[]; children: Map<string, Item[]> } {
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

export function TaskList({
  items,
  showProject = true,
  onOpen,
  onStatus,
}: {
  items: Item[];
  showProject?: boolean;
  onOpen: (item: Item) => void;
  onStatus: (item: Item, status: ItemStatus) => void;
}) {
  const { t } = useI18n();
  const desktop = useDesktop();
  const nested = nestTasks(items);
  const groups = groupTasksByStatus(nested.roots);
  const [doneOpen, setDoneOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function onDragEnd(event: DragEndEvent) {
    const active = nested.roots.find((item) => item.id === String(event.active.id));
    if (!active || !event.over) return;
    const overId = String(event.over.id);
    if (overId === active.id) return;
    const overItem = nested.roots.find((item) => item.id === overId);
    const status = statusFromDrop(overId) ?? overItem?.status ?? null;
    if (!status || status === active.status) return;
    onStatus(active, status);
  }

  const body = (
    <div className="flex flex-col gap-5">
      {LIST_STATUS_ORDER.map((status) => {
        const rows = groups[status];
        const isDone = status === "done";
        if (isDone && !doneOpen) {
          return (
            <DropSection key={status} status={status}>
              <button
                type="button"
                className="flex items-center gap-1.5 self-start text-[13px] text-fg-muted hover:text-fg"
                onClick={() => setDoneOpen(true)}
              >
                <ChevronRight size={14} />
                {t("board.done")}
                <span className="font-mono text-[12px]">{rows.length}</span>
              </button>
            </DropSection>
          );
        }
        return (
          <DropSection key={status} status={status}>
            <button
              type="button"
              className="mb-1.5 flex items-center gap-1.5 text-[13px] text-fg-muted hover:text-fg"
              onClick={() => {
                if (isDone) setDoneOpen(false);
              }}
              disabled={!isDone}
            >
              {isDone ? <ChevronDown size={14} /> : null}
              {t(`board.${status}` as MessageKey)}
              <span className="font-mono text-[12px]">{rows.length}</span>
            </button>
            {rows.length === 0 ? (
              <p className="rounded-md border border-dashed border-border-subtle px-2 py-3 text-[12px] text-fg-muted">
                {t("tasks.emptyCategory")}
              </p>
            ) : (
              <ul>
                {rows.map((item) => (
                  <li key={item.id}>
                    <TaskListRow
                      item={item}
                      showProject={showProject}
                      draggable={desktop}
                      onOpen={onOpen}
                      onStatus={onStatus}
                    />
                    {(nested.children.get(item.id) ?? []).map((child) => (
                      <div key={child.id} className="pl-7">
                        <TaskListRow
                          item={child}
                          showProject={showProject}
                          draggable={false}
                          onOpen={onOpen}
                          onStatus={onStatus}
                        />
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </DropSection>
        );
      })}
    </div>
  );

  if (!desktop) return body;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
      {body}
    </DndContext>
  );
}

function DropSection({ status, children }: { status: ItemStatus; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId(status) });
  return (
    <section
      ref={setNodeRef}
      className={isOver ? "rounded-md bg-interactive/60 ring-1 ring-border-strong" : undefined}
    >
      {children}
    </section>
  );
}

function TaskListRow({
  item,
  showProject,
  draggable,
  onOpen,
  onStatus,
}: {
  item: Item;
  showProject: boolean;
  draggable: boolean;
  onOpen: (item: Item) => void;
  onStatus: (item: Item, status: ItemStatus) => void;
}) {
  const { t } = useI18n();
  const drag = useDraggable({ id: item.id, disabled: !draggable });
  const badge = item.project
    ? { color: item.project.context.color, icon: item.project.context.icon, name: item.project.name }
    : item.context
      ? { color: item.context.color, icon: item.context.icon, name: item.context.name }
      : null;
  const done = item.status === "done";
  const style = draggable
    ? {
        transform: CSS.Translate.toString(drag.transform),
        opacity: drag.isDragging ? 0.45 : 1,
      }
    : undefined;

  return (
    <div
      ref={draggable ? drag.setNodeRef : undefined}
      style={style}
      className="group flex min-h-9 items-center gap-1.5 rounded-md px-1 hover:bg-interactive"
      {...(draggable ? { ...drag.attributes, ...drag.listeners } : {})}
    >
      <StatusSelect status={item.status ?? "todo"} showLabel={false} onChange={(status) => onStatus(item, status)} />
      <PriorityMark priority={item.priority} />
      <button
        type="button"
        className="flex min-h-9 min-w-0 flex-1 items-center gap-2.5 text-left"
        onClick={() => onOpen(item)}
        onPointerDown={(event) => {
          if (draggable) event.stopPropagation();
        }}
      >
        <span className={`min-w-0 flex-1 truncate text-[13px] ${done ? "text-fg-muted line-through" : ""}`}>
          {item.title || t("common.untitled")}
        </span>
        {item.subtask_total > 0 ? (
          <span className="font-mono text-[11px] text-fg-muted">
            {item.subtask_done}/{item.subtask_total}
          </span>
        ) : null}
        {item.due_on ? <span className="font-mono text-[12px] text-fg-muted">{item.due_on}</span> : null}
        {showProject && badge ? <ContextBadge color={badge.color} icon={badge.icon} name={badge.name} /> : null}
      </button>
    </div>
  );
}
