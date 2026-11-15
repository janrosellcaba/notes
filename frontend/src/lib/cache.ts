import type { QueryClient, QueryKey } from "@tanstack/react-query";

import type { HomeFeed, Item, ItemList, Project, ProjectRef } from "../types/api";

type Snapshot = {
  items: Array<[QueryKey, ItemList | undefined]>;
  home: Array<[QueryKey, HomeFeed | undefined]>;
};

export function snapshotLists(queryClient: QueryClient): Snapshot {
  return {
    items: queryClient.getQueriesData<ItemList>({ queryKey: ["items"] }),
    home: queryClient.getQueriesData<HomeFeed>({ queryKey: ["home"] }),
  };
}

export function restoreLists(queryClient: QueryClient, snapshot: Snapshot): void {
  for (const [key, data] of snapshot.items) queryClient.setQueryData(key, data);
  for (const [key, data] of snapshot.home) queryClient.setQueryData(key, data);
}

function mapList(list: Item[], id: string, map: (item: Item) => Item | null): Item[] {
  return list.flatMap((item) => {
    if (item.id !== id) return [item];
    const next = map(item);
    return next ? [next] : [];
  });
}

export function mapItem(queryClient: QueryClient, id: string, map: (item: Item) => Item | null): void {
  queryClient.setQueriesData<ItemList>({ queryKey: ["items"] }, (old) => {
    if (!old) return old;
    return { ...old, items: mapList(old.items, id, map) };
  });
  queryClient.setQueriesData<HomeFeed>({ queryKey: ["home"] }, (old) => {
    if (!old) return old;
    return {
      ...old,
      pinned: mapList(old.pinned, id, map),
      today_tasks: mapList(old.today_tasks, id, map),
    };
  });
}

export function dropInboxItem(queryClient: QueryClient, id: string): void {
  queryClient.setQueriesData<ItemList>({ queryKey: ["items"] }, (old) => {
    if (!old) return old;
    const items = old.items.filter((item) => item.id !== id);
    return items.length === old.items.length ? old : { ...old, items };
  });
  queryClient.setQueriesData<HomeFeed>({ queryKey: ["home"] }, (old) => {
    if (!old) return old;
    return {
      ...old,
      inbox_count: Math.max(0, old.inbox_count - 1),
      pinned: old.pinned.filter((item) => item.id !== id),
      today_tasks: old.today_tasks.filter((item) => item.id !== id),
    };
  });
}

function visibleInContext(item: Item, contextKey: string): boolean {
  if (contextKey === "all" || item.project === null) return true;
  return item.project.context.id === contextKey;
}

export function insertTodayTask(queryClient: QueryClient, item: Item, today: string): void {
  if (item.due_on !== today) return;
  for (const [key, data] of queryClient.getQueriesData<HomeFeed>({ queryKey: ["home"] })) {
    if (!data || data.today !== today) continue;
    const contextKey = String(key[1] ?? "all");
    if (!visibleInContext(item, contextKey)) continue;
    if (data.today_tasks.some((task) => task.id === item.id)) continue;
    queryClient.setQueryData<HomeFeed>(key, {
      ...data,
      today_tasks: [item, ...data.today_tasks],
    });
  }
}

export function projectRefFromCache(queryClient: QueryClient, projectId: string | null): ProjectRef | null {
  if (!projectId) return null;
  const lists = queryClient.getQueriesData<{ projects: Project[] }>({ queryKey: ["projects"] });
  for (const [, data] of lists) {
    const project = data?.projects.find((entry) => entry.id === projectId);
    if (!project) continue;
    return { id: project.id, name: project.name, color: project.color, context: project.context };
  }
  return null;
}

export function invalidateItemViews(queryClient: QueryClient, id?: string): void {
  void queryClient.invalidateQueries({ queryKey: ["home"] });
  void queryClient.invalidateQueries({ queryKey: ["items"] });
  if (id) void queryClient.invalidateQueries({ queryKey: ["item", id] });
}
