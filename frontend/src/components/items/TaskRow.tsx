import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";

import { errorMessage, patchItem } from "../../lib/api";
import { invalidateItemViews, mapItem, restoreLists, snapshotLists } from "../../lib/cache";
import { useUi } from "../../stores/ui";
import type { Item } from "../../types/api";
import { ContextBadge } from "../ui/ContextBadge";
import { PriorityMark } from "../ui/PriorityMark";

export function TaskRow({ item }: { item: Item }) {
  const queryClient = useQueryClient();
  const pushToast = useUi((state) => state.pushToast);
  const toggle = useMutation({
    mutationFn: () => patchItem(item.id, { status: item.status === "done" ? "todo" : "done" }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["home"] });
      await queryClient.cancelQueries({ queryKey: ["items"] });
      const snapshot = snapshotLists(queryClient);
      const done = item.status !== "done";
      mapItem(queryClient, item.id, (current) => ({
        ...current,
        status: done ? "done" : "todo",
        completed_at: done ? new Date().toISOString() : null,
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
  const checked = item.status === "done";
  return (
    <li className="flex min-h-11 items-center gap-3 border-b border-border-subtle py-1">
      <label className="inline-flex min-h-11 min-w-11 items-center justify-center">
        <input
          type="checkbox"
          className="h-4 w-4 accent-fg"
          checked={checked}
          aria-label={checked ? `Mark ${item.title} not done` : `Mark ${item.title} done`}
          onChange={() => toggle.mutate()}
        />
      </label>
      <Link to={`/item/${item.id}`} className={`min-w-0 flex-1 truncate ${checked ? "text-fg-muted line-through" : ""}`}>
        {item.title}
      </Link>
      <PriorityMark priority={item.priority} />
      {item.project ? (
        <ContextBadge name={item.project.name} color={item.project.context.color} icon={item.project.context.icon} />
      ) : null}
    </li>
  );
}
