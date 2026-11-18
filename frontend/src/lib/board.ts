export const BOARD_STATUSES = ["backlog", "todo", "in_progress", "done", "cancelled"] as const;

export type BoardStatus = (typeof BOARD_STATUSES)[number];
