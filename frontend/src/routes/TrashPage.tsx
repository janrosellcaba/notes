import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";

import { listItems, purgeItem, restoreItem } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { useUi } from "../stores/ui";

export function TrashPage() {
  const queryClient = useQueryClient();
  const pushToast = useUi((state) => state.pushToast);
  const trash = useQuery({
    queryKey: queryKeys.items({ trashed: true, include_done: true, limit: 200 }),
    queryFn: () => listItems({ trashed: true, include_done: true, limit: 200 }),
  });

  async function restore(id: string) {
    try {
      await restoreItem(id);
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not restore");
    }
  }

  async function purge(id: string) {
    try {
      await purgeItem(id);
      await queryClient.invalidateQueries({ queryKey: ["items"] });
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not delete");
    }
  }

  const items = trash.data?.items ?? [];
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <header>
        <h1 className="text-[20px]">Trash</h1>
        <p className="mt-1 text-[13px] text-fg-muted">Items stay here for 30 days. Restore puts them back where they were.</p>
      </header>
      {trash.isPending ? <p className="text-fg-muted">Loading…</p> : null}
      {items.length === 0 && !trash.isPending ? <p className="text-fg-secondary">Trash is empty.</p> : null}
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col gap-3 rounded-[10px] border border-border bg-elevated px-4 py-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[12px] text-fg-muted">{item.type}</p>
              <Link to={`/item/${item.id}`} className="truncate text-[16px]">{item.title || "Untitled"}</Link>
            </div>
            <div className="flex gap-2">
              <button type="button" className="min-h-11 rounded-[8px] border border-border px-3" onClick={() => void restore(item.id)}>
                Restore
              </button>
              <button type="button" className="min-h-11 rounded-[8px] px-3 text-priority-urgent" onClick={() => void purge(item.id)}>
                Delete forever
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
