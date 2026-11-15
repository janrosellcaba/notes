import { BOARD_STATUSES, type BoardStatus } from "../../lib/board";
import type { ItemStatus } from "../../types/api";

export type ColumnStatus = ItemStatus;

export function columnId(status: ColumnStatus): string {
  return `col:${status}`;
}

export function statusFromDrop(id: string): ColumnStatus | null {
  if (!id.startsWith("col:")) return null;
  const status = id.slice(4);
  return BOARD_STATUSES.includes(status as BoardStatus) ? (status as ColumnStatus) : null;
}
