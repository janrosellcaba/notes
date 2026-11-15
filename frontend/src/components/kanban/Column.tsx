import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronRight, Minus } from "lucide-react";
import { useState, type ReactNode } from "react";

import { useI18n } from "../../lib/i18n";
import type { Item } from "../../types/api";
import { SortableTaskCard, TaskCard } from "./Card";
import { columnId, type ColumnStatus } from "./columns";

function AddCard({ label, onAdd }: { label: string; onAdd: (title: string) => void }) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  return (
    <input
      value={title}
      aria-label={`${t("board.add")} ${label}`}
      placeholder={t("board.add")}
      className="min-h-8 rounded-[8px] border border-dashed border-border bg-transparent px-2 text-[13px] outline-none focus:border-fg"
      onChange={(event) => setTitle(event.target.value)}
      onKeyDown={(event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        const next = title.trim();
        if (!next) return;
        onAdd(next);
        setTitle("");
      }}
    />
  );
}

function Frame({
  label,
  count,
  minimized,
  onToggle,
  children,
}: {
  label: string;
  count: number;
  minimized: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  if (minimized) {
    return (
      <button
        type="button"
        aria-label={`${t("board.expand")} ${label}`}
        className="flex min-h-40 w-10 shrink-0 snap-center flex-col items-center gap-2 rounded-[10px] border border-border-subtle bg-canvas px-1 py-3 text-fg-secondary hover:bg-interactive"
        onClick={onToggle}
      >
        <ChevronRight size={14} />
        <span className="font-mono text-[12px] text-fg-muted">{count}</span>
        <span className="text-[12px] [writing-mode:vertical-rl]">{label}</span>
      </button>
    );
  }
  return (
    <section className="w-[85%] shrink-0 snap-center rounded-[10px] border border-border-subtle bg-canvas p-3 md:w-60">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="truncate text-[13px] font-medium">{label}</h2>
        <span className="font-mono text-[12px] text-fg-muted">{count}</span>
        <button type="button" aria-label={`${t("board.minimise")} ${label}`} className="text-fg-muted hover:text-fg" onClick={onToggle}>
          <Minus size={14} />
        </button>
      </header>
      {children}
    </section>
  );
}

export function PlainColumn({
  label,
  items,
  showProject,
  onAdd,
  onMove,
  minimized,
  onToggle,
}: {
  label: string;
  items: Item[];
  showProject: boolean;
  onAdd: (title: string) => void;
  onMove: (item: Item, status: ColumnStatus) => void;
  minimized: boolean;
  onToggle: () => void;
}) {
  return (
    <Frame label={label} count={items.length} minimized={minimized} onToggle={onToggle}>
      <div className="flex min-h-24 flex-col gap-2">
        {items.map((item) => (
          <TaskCard key={item.id} item={item} showProject={showProject} onMove={(status) => onMove(item, status)} />
        ))}
        <AddCard label={label} onAdd={onAdd} />
      </div>
    </Frame>
  );
}

export function DropColumn({
  status,
  label,
  items,
  showProject,
  onAdd,
  onMove,
  minimized,
  onToggle,
}: {
  status: ColumnStatus;
  label: string;
  items: Item[];
  showProject: boolean;
  onAdd: (title: string) => void;
  onMove: (item: Item, status: ColumnStatus) => void;
  minimized: boolean;
  onToggle: () => void;
}) {
  const droppable = useDroppable({ id: columnId(status) });
  return (
    <Frame label={label} count={items.length} minimized={minimized} onToggle={onToggle}>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div ref={droppable.setNodeRef} className="flex min-h-24 flex-col gap-2">
          {items.map((item) => (
            <SortableTaskCard key={item.id} item={item} showProject={showProject} onMove={(next) => onMove(item, next)} />
          ))}
          <AddCard label={label} onAdd={onAdd} />
        </div>
      </SortableContext>
    </Frame>
  );
}
