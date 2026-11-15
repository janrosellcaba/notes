import type { DraggableAttributes } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties } from "react";
import { Link } from "react-router";

import type { Item } from "../../types/api";
import { ContextBadge } from "../ui/ContextBadge";
import { PriorityMark } from "../ui/PriorityMark";
import { MoveToMenu } from "./MoveToMenu";
import type { ColumnStatus } from "./columns";

export function TaskCard({
  item,
  showProject,
  onMove,
  drag,
}: {
  item: Item;
  showProject: boolean;
  onMove: (status: ColumnStatus) => void;
  drag?: {
    setNodeRef: (node: HTMLElement | null) => void;
    style: CSSProperties;
    attributes: DraggableAttributes;
    listeners: ReturnType<typeof useSortable>["listeners"];
  };
}) {
  return (
    <article
      ref={drag?.setNodeRef}
      style={drag?.style}
      className="rounded-[10px] border border-border-subtle bg-elevated p-3"
      {...drag?.attributes}
      {...drag?.listeners}
    >
      <div className="flex items-start justify-between gap-2">
        <Link to={`/item/${item.id}`} className="min-w-0 flex-1 font-medium">
          {item.title || "Untitled"}
        </Link>
        <PriorityMark priority={item.priority ?? "none"} />
      </div>
      {showProject ? (
        <div className="mt-2">
          <ContextBadge color={item.project?.color ?? "#71717A"} name={item.project?.name ?? "Inbox"} />
        </div>
      ) : null}
      <div className="mt-1">
        <MoveToMenu status={(item.status ?? "todo") as ColumnStatus} onMove={onMove} />
      </div>
    </article>
  );
}

export function SortableTaskCard({
  item,
  showProject,
  onMove,
}: {
  item: Item;
  showProject: boolean;
  onMove: (status: ColumnStatus) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <TaskCard
      item={item}
      showProject={showProject}
      onMove={onMove}
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
