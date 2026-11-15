import type { ItemStatus } from "../../types/api";

export const COLUMNS = [
  { status: "backlog", label: "Backlog" },
  { status: "todo", label: "Todo" },
  { status: "in_progress", label: "In Progress" },
  { status: "blocked", label: "Blocked" },
  { status: "done", label: "Done" },
] as const;

export type ColumnStatus = ItemStatus;

export function columnId(status: ColumnStatus): string {
  return `col:${status}`;
}

export function statusFromDrop(id: string): ColumnStatus | null {
  if (!id.startsWith("col:")) return null;
  const status = id.slice(4);
  return COLUMNS.some((column) => column.status === status) ? (status as ColumnStatus) : null;
}
