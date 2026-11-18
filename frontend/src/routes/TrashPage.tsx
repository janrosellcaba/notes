import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { emptyTrash, listTrash, purgeItem, restoreItem } from "../lib/api";
import { relativeTime } from "../lib/dates";
import { useI18n } from "../lib/i18n";
import { queryKeys } from "../lib/queryKeys";
import { useUi } from "../stores/ui";

export function TrashPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const pushToast = useUi((state) => state.pushToast);
  const trash = useQuery({ queryKey: queryKeys.trash, queryFn: listTrash });
  const rows = trash.data?.items ?? [];

  async function restore(id: string) {
    try {
      await restoreItem(id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.trash });
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
      pushToast(t("trash.restored"));
    } catch (error) {
      pushToast(error instanceof Error ? error.message : t("editor.unavailable"));
    }
  }

  async function purge(id: string) {
    try {
      await purgeItem(id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.trash });
    } catch (error) {
      pushToast(error instanceof Error ? error.message : t("editor.unavailable"));
    }
  }

  async function empty() {
    if (!window.confirm(t("trash.emptyConfirm"))) return;
    try {
      await emptyTrash();
      await queryClient.invalidateQueries({ queryKey: queryKeys.trash });
      pushToast(t("trash.emptied"));
    } catch (error) {
      pushToast(error instanceof Error ? error.message : t("editor.unavailable"));
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <PageHeader
        title={t("trash.title")}
        actions={
          rows.length > 0 ? (
            <Button variant="consult" tone="danger" onClick={() => void empty()}>
              {t("trash.emptyAll")}
            </Button>
          ) : null
        }
      >
        <p className="text-[13px] text-fg-muted">{t("trash.detail")}</p>
      </PageHeader>
      {trash.isPending ? <p className="font-mono text-[13px] text-fg-muted">{t("common.loading")}</p> : null}
      {!trash.isPending && rows.length === 0 ? <EmptyState>{t("trash.empty")}</EmptyState> : null}
      <ul className="flex flex-col gap-1">
        {rows.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center gap-2 rounded-[8px] border border-border-subtle px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px]">{item.title || t("common.untitled")}</p>
              <p className="font-mono text-[11px] text-fg-muted">
                {item.type}
                {item.deleted_at ? ` · ${relativeTime(item.deleted_at)}` : null}
              </p>
            </div>
            <Button variant="consult" onClick={() => void restore(item.id)}>
              {t("trash.restore")}
            </Button>
            <Button variant="consult" tone="danger" onClick={() => void purge(item.id)}>
              {t("trash.forever")}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
