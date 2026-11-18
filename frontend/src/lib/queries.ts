import { useQuery } from "@tanstack/react-query";

import { getHome, listContexts, listProjects } from "./api";
import { todayISO } from "./dates";
import { queryKeys } from "./queryKeys";
import { useUi } from "../stores/ui";

export function useContexts() {
  return useQuery({
    queryKey: queryKeys.contexts,
    queryFn: listContexts,
    staleTime: 60_000,
  });
}

export function useProjectList(contextId: string, options: { includeArchived?: boolean } = {}) {
  const includeArchived = options.includeArchived ?? false;
  return useQuery({
    queryKey: [...queryKeys.projects(contextId), includeArchived ? "archived" : "active"] as const,
    queryFn: () => listProjects(contextId === "all" ? null : contextId, { includeArchived }),
    staleTime: 30_000,
  });
}

export function useHomeFeed() {
  const contextId = useUi((state) => state.contextId);
  const today = todayISO();
  return useQuery({
    queryKey: queryKeys.home(contextId, today),
    queryFn: () => getHome(today, contextId === "all" ? null : contextId),
  });
}
