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
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { COLLAPSED_BY_DEFAULT, groupTasksByStatus, LIST_STATUS_ORDER } from "../../lib/dates";
import { useI18n, type MessageKey } from "../../lib/i18n";
import { isEditableTarget } from "../../lib/shortcuts";
import { useDesktop } from "../../lib/useDesktop";
import type { Item, ItemPriority, ItemStatus } from "../../types/api";
import { columnId, statusFromDrop } from "../kanban/columns";
import { Button } from "../ui/Button";
import { ContextBadge } from "../ui/ContextBadge";
import { Popover } from "../ui/Popover";
import { PrioritySelect } from "../ui/PrioritySelect";
import { StatusSelect } from "../ui/StatusSelect";

const STATUS_CYCLE: ItemStatus[] = ["backlog", "todo", "in_progress", "done", "cancelled"];
const PRIORITY_KEYS: Record<string, ItemPriority> = {
  "1": "urgent",
  "2": "high",
  "3": "medium",
  "4": "low",
  "0": "none",
};

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
  onPriority,
  onBulkStatus,
  onDelete,
}: {
  items: Item[];
  showProject?: boolean;
  onOpen: (item: Item) => void;
  onStatus: (item: Item, status: ItemStatus) => void;
  onPriority?: (item: Item, priority: ItemPriority) => void;
  onBulkStatus?: (items: Item[], status: ItemStatus) => void;
  onDelete?: (item: Item) => void;
}) {
  const { t } = useI18n();
  const desktop = useDesktop();
  const nested = nestTasks(items);
  const groups = groupTasksByStatus(nested.roots);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(COLLAPSED_BY_DEFAULT.map((status) => [status, true])),
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [lastClicked, setLastClicked] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const flatRoots = useMemo(
    () => LIST_STATUS_ORDER.flatMap((status) => groups[status]),
    [groups],
  );

  useEffect(() => {
    if (focusedId && !flatRoots.some((item) => item.id === focusedId)) {
      setFocusedId(flatRoots[0]?.id ?? null);
    }
  }, [flatRoots, focusedId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelected([]);
        setFocusedId(null);
        return;
      }
      if (isEditableTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (flatRoots.length === 0) return;
      const index = focusedId ? flatRoots.findIndex((item) => item.id === focusedId) : -1;
      const current = index >= 0 ? flatRoots[index] : null;

      if (event.key === "j" || event.key === "ArrowDown") {
        event.preventDefault();
        const next = flatRoots[Math.min(Math.max(index, -1) + 1, flatRoots.length - 1)];
        if (next) setFocusedId(next.id);
        return;
      }
      if (event.key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        const next = flatRoots[Math.max(index <= 0 ? 0 : index - 1, 0)];
        if (next) setFocusedId(next.id);
        return;
      }
      if (!current) {
        if (event.key === "j" || event.key === "k") setFocusedId(flatRoots[0]?.id ?? null);
        return;
      }
      if (event.key === "e" || event.key === "Enter") {
        event.preventDefault();
        onOpen(current);
        return;
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        if (!onDelete) return;
        event.preventDefault();
        onDelete(current);
        return;
      }
      if (event.key === "]" || event.key === "[") {
        event.preventDefault();
        const at = STATUS_CYCLE.indexOf((current.status ?? "todo") as ItemStatus);
        const next =
          event.key === "]"
            ? STATUS_CYCLE[(at + 1) % STATUS_CYCLE.length]
            : STATUS_CYCLE[(at - 1 + STATUS_CYCLE.length) % STATUS_CYCLE.length];
        if (next) onStatus(current, next);
        return;
      }
      const priority = PRIORITY_KEYS[event.key];
      if (priority && onPriority) {
        event.preventDefault();
        onPriority(current, priority);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flatRoots, focusedId, onDelete, onOpen, onPriority, onStatus]);

  function toggleCollapsed(status: ItemStatus) {
    setCollapsed((current) => ({ ...current, [status]: !current[status] }));
  }

  function selectRange(fromId: string, toId: string) {
    const from = flatRoots.findIndex((item) => item.id === fromId);
    const to = flatRoots.findIndex((item) => item.id === toId);
    if (from < 0 || to < 0) return;
    const [start, end] = from < to ? [from, to] : [to, from];
    setSelected(flatRoots.slice(start, end + 1).map((item) => item.id));
  }

  function onRowSelect(item: Item, event: { shiftKey: boolean }) {
    if (!event.shiftKey) return;
    if (lastClicked) selectRange(lastClicked, item.id);
    else setSelected([item.id]);
    setLastClicked(item.id);
  }

  function bulkStatus(status: ItemStatus) {
    const chosen = nested.roots.filter((item) => selected.includes(item.id));
    if (onBulkStatus) onBulkStatus(chosen, status);
    else {
      for (const item of chosen) {
        if (item.status !== status) onStatus(item, status);
      }
    }
    setSelected([]);
  }

  function onDragEnd(event: DragEndEvent) {
    const active = nested.roots.find((item) => item.id === String(event.active.id));
    if (!active || !event.over) return;
    const overId = String(event.over.id);
    if (overId === active.id) return;
    const overItem = nested.roots.find((item) => item.id === overId);
    const status = statusFromDrop(overId) ?? overItem?.status ?? null;
    if (!status || status === active.status) return;
    const moving = selected.includes(active.id)
      ? nested.roots.filter((item) => selected.includes(item.id))
      : [active];
    if (onBulkStatus && moving.length > 1) onBulkStatus(moving, status);
    else {
      for (const item of moving) {
        if (item.status !== status) onStatus(item, status);
      }
    }
    if (moving.length > 1) setSelected([]);
  }

  const body = (
    <div className="flex flex-col gap-5">
      {selected.length > 0 ? (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-md border border-border bg-elevated px-3 py-2">
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
        </div>
      ) : null}
      {LIST_STATUS_ORDER.map((status) => {
        const rows = groups[status];
        const isCollapsed = Boolean(collapsed[status]);
        if (isCollapsed) {
          return (
            <DropSection key={status} status={status}>
              <button
                type="button"
                className="flex items-center gap-1.5 self-start text-[13px] text-fg-muted hover:text-fg"
                onClick={() => toggleCollapsed(status)}
              >
                <ChevronRight size={14} />
                {t(`board.${status}` as MessageKey)}
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
              onClick={() => toggleCollapsed(status)}
            >
              <ChevronDown size={14} />
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
                      selected={selected.includes(item.id)}
                      focused={focusedId === item.id}
                      draggable={desktop}
                      onOpen={onOpen}
                      onSelect={onRowSelect}
                      onStatus={onStatus}
                      onPriority={onPriority}
                      onDelete={onDelete}
                      onAnchor={() => {
                        setLastClicked(item.id);
                        setFocusedId(item.id);
                      }}
                    />
                    {(nested.children.get(item.id) ?? []).map((child) => (
                      <div key={child.id} className="pl-7">
                        <TaskListRow
                          item={child}
                          showProject={showProject}
                          selected={selected.includes(child.id)}
                          focused={focusedId === child.id}
                          draggable={false}
                          onOpen={onOpen}
                          onSelect={onRowSelect}
                          onStatus={onStatus}
                          onPriority={onPriority}
                          onDelete={onDelete}
                          onAnchor={() => {
                            setLastClicked(child.id);
                            setFocusedId(child.id);
                          }}
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
  selected,
  focused,
  draggable,
  onOpen,
  onSelect,
  onStatus,
  onPriority,
  onDelete,
  onAnchor,
}: {
  item: Item;
  showProject: boolean;
  selected: boolean;
  focused: boolean;
  draggable: boolean;
  onOpen: (item: Item) => void;
  onSelect: (item: Item, event: { shiftKey: boolean }) => void;
  onStatus: (item: Item, status: ItemStatus) => void;
  onPriority?: (item: Item, priority: ItemPriority) => void;
  onDelete?: (item: Item) => void;
  onAnchor: () => void;
}) {
  const { t } = useI18n();
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
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
      className={`group flex min-h-9 cursor-grab items-center gap-1.5 rounded-md px-1.5 active:cursor-grabbing ${
        selected || focused ? "bg-interactive ring-1 ring-border-strong" : "hover:bg-interactive"
      }`}
      {...(draggable ? drag.listeners : {})}
      {...(draggable ? drag.attributes : {})}
    >
      <div
        className="shrink-0"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <StatusSelect status={item.status ?? "todo"} showLabel={false} onChange={(status) => onStatus(item, status)} />
      </div>
      {onPriority ? (
        <div
          className="shrink-0"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <PrioritySelect priority={item.priority} onChange={(priority) => onPriority(item, priority)} />
        </div>
      ) : null}
      <button
        type="button"
        className="flex min-h-9 min-w-0 flex-1 cursor-inherit items-center gap-2.5 text-left"
        onClick={(event) => {
          if (event.shiftKey) {
            event.preventDefault();
            onSelect(item, event);
            return;
          }
          onAnchor();
          onOpen(item);
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
      {onDelete ? (
        <div
          className="shrink-0"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <Popover
            open={menu}
            onClose={() => {
              setMenu(false);
              setConfirmDelete(false);
            }}
            className="right-0 left-auto"
            trigger={
              <button
                type="button"
                aria-label={t("tasks.actions")}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-[13px] text-fg-muted hover:bg-canvas hover:text-fg ${
                  menu ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                }`}
                onClick={() => setMenu((open) => !open)}
              >
                ···
              </button>
            }
          >
            <div className="flex min-w-36 flex-col p-1">
              <Button
                variant="consult"
                className="w-full justify-start"
                onClick={() => {
                  setMenu(false);
                  onOpen(item);
                }}
              >
                {t("tasks.open")}
              </Button>
              {confirmDelete ? (
                <Button
                  variant="consult"
                  tone="danger"
                  className="w-full justify-start"
                  onClick={() => {
                    setMenu(false);
                    setConfirmDelete(false);
                    onDelete(item);
                  }}
                >
                  {t("inbox.deleteConfirm")}
                </Button>
              ) : (
                <Button variant="consult" className="w-full justify-start" onClick={() => setConfirmDelete(true)}>
                  {t("inbox.delete")}
                </Button>
              )}
            </div>
          </Popover>
        </div>
      ) : null}
    </div>
  );
}
