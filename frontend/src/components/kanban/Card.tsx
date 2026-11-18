import type { DraggableAttributes } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties } from "react";

import { useI18n } from "../../lib/i18n";
import type { Item } from "../../types/api";
import { useQueryClient } from "@tanstack/react-query";

import { patchItem } from "../../lib/api";
import { cn } from "../../lib/cn";
import { ContextBadge } from "../ui/ContextBadge";
import { PrioritySelect } from "../ui/PrioritySelect";
import { MoveToMenu } from "./MoveToMenu";
import type { ColumnStatus } from "./columns";

export function TaskCard({
  item,
  showProject,
  selected = false,
  onOpen,
  onMove,
  onSelect,
  onAnchor,
  drag,
}: {
  item: Item;
  showProject: boolean;
  selected?: boolean;
  onOpen: (item: Item) => void;
  onMove: (status: ColumnStatus) => void;
  onSelect?: (item: Item, event: { shiftKey: boolean }) => void;
  onAnchor?: () => void;
  drag?: {
    setNodeRef: (node: HTMLElement | null) => void;
    style: CSSProperties;
    attributes: DraggableAttributes;
    listeners: ReturnType<typeof useSortable>["listeners"];
  };
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const badge = item.project
    ? { color: item.project.context.color, icon: item.project.context.icon, name: item.project.name }
    : item.context
      ? { color: item.context.color, icon: item.context.icon, name: item.context.name }
      : null;
  return (
    <article
      ref={drag?.setNodeRef}
      style={drag?.style}
      className={cn(
        "cursor-grab rounded-[10px] border bg-elevated p-3 active:cursor-grabbing",
        selected ? "border-border-strong ring-1 ring-border-strong" : "border-border-subtle",
      )}
      {...drag?.attributes}
      {...drag?.listeners}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5" onPointerDown={(event) => event.stopPropagation()}>
          <PrioritySelect
            priority={item.priority ?? "none"}
            onChange={(priority) =>
              void patchItem(item.id, { priority }).then(() => queryClient.invalidateQueries({ queryKey: ["items"] }))
            }
          />
        </div>
        <button
          type="button"
          className="min-w-0 flex-1 cursor-inherit text-left text-[13px] font-medium hover:underline"
          onClick={(event) => {
            if (event.shiftKey && onSelect) {
              event.preventDefault();
              onSelect(item, event);
              return;
            }
            onAnchor?.();
            onOpen(item);
          }}
        >
          {item.title || t("common.untitled")}
        </button>
      </div>
      {item.subtask_total > 0 ? (
        <p className="mt-1 font-mono text-[12px] text-fg-muted">
          {item.subtask_done}/{item.subtask_total}
        </p>
      ) : null}
      {showProject && badge ? (
        <div className="mt-2">
          <ContextBadge color={badge.color} icon={badge.icon} name={badge.name} />
        </div>
      ) : null}
      <div className="mt-1" onPointerDown={(event) => event.stopPropagation()}>
        <MoveToMenu status={(item.status ?? "todo") as ColumnStatus} onMove={onMove} />
      </div>
    </article>
  );
}

export function SortableTaskCard({
  item,
  showProject,
  selected,
  onOpen,
  onMove,
  onSelect,
  onAnchor,
}: {
  item: Item;
  showProject: boolean;
  selected?: boolean;
  onOpen: (item: Item) => void;
  onMove: (status: ColumnStatus) => void;
  onSelect?: (item: Item, event: { shiftKey: boolean }) => void;
  onAnchor?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <TaskCard
      item={item}
      showProject={showProject}
      selected={selected}
      onOpen={onOpen}
      onMove={onMove}
      onSelect={onSelect}
      onAnchor={onAnchor}
      drag={{
        setNodeRef,
        listeners,
        attributes,
        style: {
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.4 : 1,
        },
      }}
    />
  );
}
