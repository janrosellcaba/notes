import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";

import { errorMessage, patchItem } from "../../lib/api";
import { invalidateItemViews, mapItem, restoreLists, snapshotLists } from "../../lib/cache";
import { useUi } from "../../stores/ui";
import type { Item, ItemStatus } from "../../types/api";
import { ContextBadge } from "../ui/ContextBadge";
import { PriorityMark } from "../ui/PriorityMark";
import { StatusSelect } from "../ui/StatusSelect";

export function TaskRow({ item }: { item: Item }) {
  const queryClient = useQueryClient();
  const pushToast = useUi((state) => state.pushToast);
  const setStatus = useMutation({
    mutationFn: (status: ItemStatus) => patchItem(item.id, { status }),
    onMutate: async (status) => {
      await queryClient.cancelQueries({ queryKey: ["home"] });
      await queryClient.cancelQueries({ queryKey: ["items"] });
      const snapshot = snapshotLists(queryClient);
      mapItem(queryClient, item.id, (current) => ({
        ...current,
        status,
        completed_at: status === "done" ? new Date().toISOString() : null,
      }));
      return { snapshot };
    },
    onError: (error, _vars, context) => {
      if (context) restoreLists(queryClient, context.snapshot);
      const message = errorMessage(error);
      if (message) pushToast(message);
    },
    onSuccess: (saved) => {
      mapItem(queryClient, saved.id, () => saved);
    },
    onSettled: () => {
      invalidateItemViews(queryClient, item.id);
    },
  });
  const done = item.status === "done";
  return (
    <li className="flex min-h-11 items-center gap-2 border-b border-border-subtle py-1">
      <StatusSelect
        status={item.status ?? "todo"}
        showLabel={false}
        onChange={(status) => setStatus.mutate(status)}
      />
      <Link to={`/item/${item.id}`} className={`min-w-0 flex-1 truncate ${done ? "text-fg-muted line-through" : ""}`}>
        {item.title}
      </Link>
      <PriorityMark priority={item.priority} />
      {item.project ? (
        <ContextBadge name={item.project.name} color={item.project.context.color} icon={item.project.context.icon} />
      ) : null}
    </li>
  );
}
