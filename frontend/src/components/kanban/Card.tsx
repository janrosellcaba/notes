import type { DraggableAttributes } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties } from "react";
import { Link } from "react-router";

import { useI18n } from "../../lib/i18n";
import { useUi } from "../../stores/ui";
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
  const { t } = useI18n();
  const taskFields = useUi((state) => state.taskFields);
  const badge = item.project
    ? { color: item.project.context.color, icon: item.project.context.icon, name: item.project.name }
    : item.context
      ? { color: item.context.color, icon: item.context.icon, name: item.context.name }
      : null;
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
          {item.title || t("common.untitled")}
        </Link>
        {taskFields.priority ? <PriorityMark priority={item.priority ?? "none"} /> : null}
      </div>
      {taskFields.subtasks && item.subtask_total > 0 ? (
        <p className="mt-1 font-mono text-[12px] text-fg-muted">
          {item.subtask_done}/{item.subtask_total}
        </p>
      ) : null}
      {showProject && taskFields.project && badge ? (
        <div className="mt-2">
          <ContextBadge color={badge.color} icon={badge.icon} name={badge.name} />
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
