import type { Item, ItemPriority, ItemStatus } from "../types/api";

export function todayLabel(now = new Date()): string {
  return now.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

export function todayISO(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + days);
  return todayISO(date);
}

export function tomorrowISO(now = new Date()): string {
  return addDays(todayISO(now), 1);
}

export function meetingTitle(now = new Date()): string {
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `Meeting - ${todayISO(now)} ${hours}:${minutes}`;
}

export function relativeTime(iso: string, now = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return iso;
  const delta = Math.max(0, now - then);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (delta < minute) return "just now";
  if (delta < hour) return `${Math.floor(delta / minute)}m`;
  if (delta < day) return `${Math.floor(delta / hour)}h`;
  if (delta < 7 * day) return `${Math.floor(delta / day)}d`;
  return iso.slice(0, 10);
}

const PRIORITY_RANK: Record<ItemPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

/** Higher priority first, then oldest created first. */
export function byPriorityThenCreated(left: Item, right: Item): number {
  const rank = PRIORITY_RANK[left.priority ?? "none"] - PRIORITY_RANK[right.priority ?? "none"];
  if (rank !== 0) return rank;
  const created = left.created_at.localeCompare(right.created_at);
  if (created !== 0) return created;
  return left.id.localeCompare(right.id);
}

function byPriority(left: Item, right: Item): number {
  return byPriorityThenCreated(left, right);
}

export function groupTasks(tasks: Item[], today: string) {
  const overdue = tasks.filter((task) => task.due_on !== null && task.due_on < today).sort(byPriority);
  const dueToday = tasks.filter((task) => task.due_on === today).sort(byPriority);
  const upcoming = tasks.filter((task) => task.due_on !== null && task.due_on > today).sort(byPriority);
  const undated = tasks.filter((task) => task.due_on === null).sort(byPriority);
  return { overdue, today: dueToday, upcoming, none: undated };
}

/** List view order — mirrors a simplified Linear workflow. */
export const LIST_STATUS_ORDER: ItemStatus[] = ["in_progress", "todo", "backlog", "cancelled", "done"];

/** Closed by default in list/board. */
export const COLLAPSED_BY_DEFAULT: ItemStatus[] = ["cancelled", "done"];

export function groupTasksByStatus(tasks: Item[]): Record<ItemStatus, Item[]> {
  const groups: Record<ItemStatus, Item[]> = {
    backlog: [],
    todo: [],
    in_progress: [],
    cancelled: [],
    done: [],
  };
  for (const task of tasks) {
    const status = task.status ?? "todo";
    groups[status].push(task);
  }
  for (const status of LIST_STATUS_ORDER) {
    groups[status].sort(byPriorityThenCreated);
  }
  return groups;
}

export function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}

export function searchTokens(query: string): string[] {
  return query
    .split(/\s+/)
    .map((token) => token.replace(/["*:()^]/g, "").trim())
    .filter((token) => token.length >= 2);
}
