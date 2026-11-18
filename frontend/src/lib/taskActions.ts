import type { QueryClient } from "@tanstack/react-query";

import { patchItem } from "./api";
import { mapItem, restoreLists, snapshotLists } from "./cache";
import type { Item, ItemStatus } from "../types/api";

type ToastFn = (
  message: string,
  link?: { href: string; label: string },
  action?: { label: string; run: () => void },
) => void;

/** Apply status changes with optimistic cache updates and an optional Undo toast. */
export async function applyTaskStatuses(
  queryClient: QueryClient,
  updates: Array<{ item: Item; status: ItemStatus }>,
  options: {
    pushToast: ToastFn;
    message: string;
    undoLabel: string;
    withUndo?: boolean;
  },
): Promise<void> {
  const meaningful = updates.filter((entry) => entry.item.status !== entry.status);
  if (meaningful.length === 0) return;

  const previous = meaningful.map((entry) => ({
    item: entry.item,
    status: (entry.item.status ?? "todo") as ItemStatus,
  }));
  const lists = snapshotLists(queryClient);

  for (const entry of meaningful) {
    mapItem(queryClient, entry.item.id, (current) => ({
      ...current,
      status: entry.status,
      completed_at: entry.status === "done" ? new Date().toISOString() : null,
    }));
  }

  try {
    await Promise.all(meaningful.map((entry) => patchItem(entry.item.id, { status: entry.status })));
    await queryClient.invalidateQueries({ queryKey: ["items"] });
    await queryClient.invalidateQueries({ queryKey: ["home"] });
    if (options.withUndo !== false) {
      options.pushToast(options.message, undefined, {
        label: options.undoLabel,
        run: () => {
          void applyTaskStatuses(queryClient, previous, {
            pushToast: options.pushToast,
            message: options.message,
            undoLabel: options.undoLabel,
            withUndo: false,
          });
        },
      });
    }
  } catch (error) {
    restoreLists(queryClient, lists);
    options.pushToast(error instanceof Error ? error.message : "Could not update the task");
  }
}
