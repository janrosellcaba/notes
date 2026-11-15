import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useState, type ReactNode } from "react";

import type { Item } from "../../types/api";
import { SortableTaskCard, TaskCard } from "./Card";
import { columnId, type ColumnStatus } from "./columns";

function AddCard({ label, onAdd }: { label: string; onAdd: (title: string) => void }) {
  const [title, setTitle] = useState("");
  return (
    <input
      value={title}
      aria-label={`Add card to ${label}`}
      placeholder="+ Add card"
      className="min-h-11 rounded-[8px] border border-dashed border-border bg-transparent px-3 text-[16px] outline-none focus:border-fg"
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
  children,
}: {
  label: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="w-[85%] shrink-0 snap-center rounded-[10px] border border-border-subtle bg-canvas p-3 md:w-64">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="font-medium">{label}</h2>
        <span className="font-mono text-[13px] text-fg-muted">{count}</span>
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
}: {
  label: string;
  items: Item[];
  showProject: boolean;
  onAdd: (title: string) => void;
  onMove: (item: Item, status: ColumnStatus) => void;
}) {
  return (
    <Frame label={label} count={items.length}>
      <div className="flex min-h-40 flex-col gap-2">
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
}: {
  status: ColumnStatus;
  label: string;
  items: Item[];
  showProject: boolean;
  onAdd: (title: string) => void;
  onMove: (item: Item, status: ColumnStatus) => void;
}) {
  const droppable = useDroppable({ id: columnId(status) });
  return (
    <Frame label={label} count={items.length}>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div ref={droppable.setNodeRef} className="flex min-h-40 flex-col gap-2">
          {items.map((item) => (
            <SortableTaskCard key={item.id} item={item} showProject={showProject} onMove={(next) => onMove(item, next)} />
          ))}
          <AddCard label={label} onAdd={onAdd} />
        </div>
      </SortableContext>
    </Frame>
  );
}
