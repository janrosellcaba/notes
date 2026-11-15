export const BOARD_STATUSES = ["backlog", "todo", "in_progress", "done", "blocked"] as const;

export type BoardStatus = (typeof BOARD_STATUSES)[number];

const KEY = "notes.board.order";

export function readBoardOrder(): BoardStatus[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [...BOARD_STATUSES];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== BOARD_STATUSES.length) return [...BOARD_STATUSES];
    const unique = new Set(parsed);
    if (unique.size !== BOARD_STATUSES.length) return [...BOARD_STATUSES];
    if (!BOARD_STATUSES.every((status) => unique.has(status))) return [...BOARD_STATUSES];
    return parsed as BoardStatus[];
  } catch {
    return [...BOARD_STATUSES];
  }
}

export function writeBoardOrder(order: BoardStatus[]): void {
  localStorage.setItem(KEY, JSON.stringify(order));
}
