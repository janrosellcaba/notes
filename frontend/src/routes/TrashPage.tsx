import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";

import { listItems, purgeItem, restoreItem } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { useI18n } from "../lib/i18n";
import { useUi } from "../stores/ui";

export function TrashPage() {
  const queryClient = useQueryClient();
  const pushToast = useUi((state) => state.pushToast);
  const { t } = useI18n();
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
        <h1 className="text-[20px]">{t("trash.title")}</h1>
        <p className="mt-1 text-[13px] text-fg-muted">{t("trash.detail")}</p>
      </header>
      {trash.isPending ? <p className="text-fg-muted">{t("common.loading")}</p> : null}
      {items.length === 0 && !trash.isPending ? <p className="text-fg-secondary">{t("trash.empty")}</p> : null}
      <ul className="flex flex-col">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col gap-2 border-b border-border-subtle py-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-fg-muted">{item.type}</p>
              <Link to={`/item/${item.id}`} className="truncate">{item.title || t("common.untitled")}</Link>
            </div>
            <div className="flex gap-2">
              <button type="button" className="min-h-8 rounded-[8px] px-2 text-[13px] text-fg-secondary hover:bg-interactive" onClick={() => void restore(item.id)}>
                {t("trash.restore")}
              </button>
              <button type="button" className="min-h-8 rounded-[8px] px-2 text-[13px] text-fg-muted hover:text-fg" onClick={() => void purge(item.id)}>
                {t("trash.forever")}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
