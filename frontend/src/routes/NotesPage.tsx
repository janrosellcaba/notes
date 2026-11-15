import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";

import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { listItems } from "../lib/api";
import { relativeTime } from "../lib/dates";
import { useI18n } from "../lib/i18n";
import { queryKeys } from "../lib/queryKeys";
import { useUi } from "../stores/ui";

export function NotesPage() {
  const contextId = useUi((state) => state.contextId);
  const openCapture = useUi((state) => state.openCapture);
  const { t } = useI18n();
  const filters = {
    type: "note" as const,
    limit: 200,
    context_id: contextId === "all" ? undefined : contextId,
  };
  const notes = useQuery({
    queryKey: queryKeys.items(filters),
    queryFn: () => listItems(filters),
  });
  const rows = (notes.data?.items ?? []).filter((item) => !item.daily_on);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[20px]">{t("notes.title")}</h1>
        <Button variant="secondary" onClick={() => openCapture({ type: "note", projectId: null })}>
          {t("home.note")}
        </Button>
      </div>
      {notes.isPending ? <p className="font-mono text-[13px] text-fg-muted">{t("common.loading")}</p> : null}
      {notes.isError ? <p className="text-fg-secondary">{t("notes.loadError")}</p> : null}
      {!notes.isPending && rows.length === 0 ? <EmptyState>{t("notes.empty")}</EmptyState> : null}
      <ul>
        {rows.map((item) => (
          <li key={item.id} className="border-b border-border-subtle">
            <Link to={`/item/${item.id}`} className="flex min-h-11 items-center gap-3 text-[14px]">
              <span className="min-w-0 flex-1 truncate">{item.title || t("common.untitled")}</span>
              {item.project ? <span className="shrink-0 text-[12px] text-fg-muted">{item.project.name}</span> : null}
              <time className="shrink-0 font-mono text-[12px] text-fg-muted" dateTime={item.updated_at}>
                {relativeTime(item.updated_at)}
              </time>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
