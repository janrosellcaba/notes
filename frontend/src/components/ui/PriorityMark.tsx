import type { ItemPriority } from "../../types/api";

const COLOR: Record<Exclude<ItemPriority, "none">, string> = {
  urgent: "var(--color-priority-urgent)",
  high: "var(--color-priority-high)",
  medium: "var(--color-priority-medium)",
  low: "var(--color-priority-low)",
};

const LABEL: Record<Exclude<ItemPriority, "none">, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function PriorityMark({ priority }: { priority: ItemPriority | null }) {
  if (!priority || priority === "none") return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] text-fg-secondary">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: COLOR[priority] }} />
      {LABEL[priority]}
    </span>
  );
}
