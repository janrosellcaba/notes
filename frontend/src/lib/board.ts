export const BOARD_STATUSES = ["backlog", "todo", "in_progress", "done", "cancelled"] as const;

export type BoardStatus = (typeof BOARD_STATUSES)[number];

const KEY = "notes.board.order";

function normalizeOrder(parsed: unknown): BoardStatus[] | null {
  if (!Array.isArray(parsed)) return null;
  const mapped = parsed.map((entry) => (entry === "blocked" ? "cancelled" : entry));
  if (mapped.length !== BOARD_STATUSES.length) return null;
  const unique = new Set(mapped);
  if (unique.size !== BOARD_STATUSES.length) return null;
  if (!BOARD_STATUSES.every((status) => unique.has(status))) return null;
  return mapped as BoardStatus[];
}

export function readBoardOrder(): BoardStatus[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [...BOARD_STATUSES];
    const normalized = normalizeOrder(JSON.parse(raw) as unknown);
    if (!normalized) return [...BOARD_STATUSES];
    return normalized;
  } catch {
    return [...BOARD_STATUSES];
  }
}

export function writeBoardOrder(order: BoardStatus[]): void {
  localStorage.setItem(KEY, JSON.stringify(order));
}
