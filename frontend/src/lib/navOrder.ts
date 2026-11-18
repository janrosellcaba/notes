export type NavId = "home" | "tasks" | "notes" | "meetings" | "calendar" | "projects";

export const DEFAULT_NAV_ORDER: readonly NavId[] = [
  "home",
  "tasks",
  "notes",
  "meetings",
  "calendar",
  "projects",
] as const;

const KEY = "notes.navOrder";

const VALID = new Set<string>(DEFAULT_NAV_ORDER);

export function readNavOrder(): NavId[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [...DEFAULT_NAV_ORDER];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_NAV_ORDER];
    const cleaned = parsed.filter((entry): entry is NavId => typeof entry === "string" && VALID.has(entry));
    for (const id of DEFAULT_NAV_ORDER) {
      if (!cleaned.includes(id)) cleaned.push(id);
    }
    return cleaned;
  } catch {
    return [...DEFAULT_NAV_ORDER];
  }
}

export function writeNavOrder(order: NavId[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(order));
  } catch {
    // Private browsing can reject storage.
  }
}

export function moveNavItem(order: NavId[], id: NavId, direction: -1 | 1): NavId[] {
  const index = order.indexOf(id);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= order.length) return order;
  const copy = [...order];
  const swap = copy[next];
  if (!swap) return order;
  copy[next] = id;
  copy[index] = swap;
  return copy;
}
