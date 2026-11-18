export type NavId = "home" | "tasks" | "notes" | "meetings" | "calendar" | "projects";

export const DEFAULT_NAV_ORDER: readonly NavId[] = [
  "home",
  "tasks",
  "notes",
  "meetings",
  "calendar",
  "projects",
] as const;
