export type NavId = "home" | "tasks" | "notes" | "meetings" | "calendar" | "projects" | "trash";

/** Desktop sidebar order. */
export const DEFAULT_NAV_ORDER: readonly NavId[] = [
  "home",
  "tasks",
  "notes",
  "meetings",
  "calendar",
  "projects",
  "trash",
] as const;

/** Primary mobile tabs (More holds the rest). */
export const MOBILE_PRIMARY: readonly ("home" | "tasks")[] = ["home", "tasks"] as const;

export const MOBILE_MORE: readonly NavId[] = [
  "notes",
  "meetings",
  "calendar",
  "projects",
  "trash",
] as const;
