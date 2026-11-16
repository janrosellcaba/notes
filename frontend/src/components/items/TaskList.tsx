import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

import { groupTasksByStatus, LIST_STATUS_ORDER } from "../../lib/dates";
import { useI18n, type MessageKey } from "../../lib/i18n";
import type { Item, ItemStatus } from "../../types/api";
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
  const nested = nestTasks(items);
  const groups = groupTasksByStatus(nested.roots);
  const [doneOpen, setDoneOpen] = useState(false);
  const empty = LIST_STATUS_ORDER.every((status) => groups[status].length === 0);

  if (empty) return <p className="text-fg-muted">{t("tasks.empty")}</p>;

  return (
    <div className="flex flex-col gap-5">
      {LIST_STATUS_ORDER.map((status) => {
        const rows = groups[status];
        if (rows.length === 0) return null;
        const isDone = status === "done";
        if (isDone && !doneOpen) {
          return (
            <button
              key={status}
              type="button"
              className="flex items-center gap-1.5 self-start text-[13px] text-fg-muted hover:text-fg"
              onClick={() => setDoneOpen(true)}
            >
              <ChevronRight size={14} />
              {t("board.done")}
              <span className="font-mono text-[12px]">{rows.length}</span>
            </button>
          );
        }
        return (
          <section key={status}>
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
            <ul>
              {rows.map((item) => (
                <li key={item.id}>
                  <TaskListRow
                    item={item}
                    showProject={showProject}
                    onOpen={onOpen}
                    onStatus={onStatus}
                  />
                  {(nested.children.get(item.id) ?? []).map((child) => (
                    <div key={child.id} className="pl-7">
                      <TaskListRow
                        item={child}
                        showProject={showProject}
                        onOpen={onOpen}
                        onStatus={onStatus}
                      />
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function TaskListRow({
  item,
  showProject,
  onOpen,
  onStatus,
}: {
  item: Item;
  showProject: boolean;
  onOpen: (item: Item) => void;
  onStatus: (item: Item, status: ItemStatus) => void;
}) {
  const { t } = useI18n();
  const badge = item.project
    ? { color: item.project.context.color, icon: item.project.context.icon, name: item.project.name }
    : item.context
      ? { color: item.context.color, icon: item.context.icon, name: item.context.name }
      : null;
  const done = item.status === "done";
  return (
    <div className="group flex min-h-9 items-center gap-2 rounded-md px-1 hover:bg-interactive">
      <StatusSelect status={item.status ?? "todo"} showLabel={false} onChange={(status) => onStatus(item, status)} />
      <button type="button" className="flex min-h-9 min-w-0 flex-1 items-center gap-2.5 text-left" onClick={() => onOpen(item)}>
        <span className={`min-w-0 flex-1 truncate text-[13px] ${done ? "text-fg-muted line-through" : ""}`}>
          {item.title || t("common.untitled")}
        </span>
        {item.subtask_total > 0 ? (
          <span className="font-mono text-[11px] text-fg-muted">
            {item.subtask_done}/{item.subtask_total}
          </span>
        ) : null}
        {item.due_on ? <span className="font-mono text-[12px] text-fg-muted">{item.due_on}</span> : null}
        <PriorityMark priority={item.priority} />
        {showProject && badge ? <ContextBadge color={badge.color} icon={badge.icon} name={badge.name} /> : null}
      </button>
    </div>
  );
}
