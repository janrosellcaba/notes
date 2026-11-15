import type { ItemFilters } from "../types/api";

export const queryKeys = {
  me: ["me"] as const,
  contexts: ["contexts"] as const,
  settings: ["settings"] as const,
  integrations: ["integrations"] as const,
  home: (contextId: string, today: string) => ["home", contextId, today] as const,
  items: (filters: ItemFilters) => ["items", filters] as const,
  item: (id: string) => ["item", id] as const,
  project: (id: string) => ["project", id] as const,
  projects: (contextId: string) => ["projects", contextId] as const,
  search: (q: string, contextId: string) => ["search", q, contextId] as const,
};
