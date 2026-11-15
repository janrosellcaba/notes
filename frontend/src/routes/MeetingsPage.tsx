import { useQuery } from "@tanstack/react-query";

import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { RowLink } from "../components/ui/RowLink";
import { listItems } from "../lib/api";
import { relativeTime } from "../lib/dates";
import { useI18n } from "../lib/i18n";
import { queryKeys } from "../lib/queryKeys";
import { useUi } from "../stores/ui";

export function MeetingsPage() {
  const contextId = useUi((state) => state.contextId);
  const openCapture = useUi((state) => state.openCapture);
  const { t } = useI18n();
  const filters = {
    type: "meeting" as const,
    limit: 200,
    context_id: contextId === "all" ? undefined : contextId,
  };
  const meetings = useQuery({
    queryKey: queryKeys.items(filters),
    queryFn: () => listItems(filters),
  });
  const rows = meetings.data?.items ?? [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader
        title={t("meetings.title")}
        actions={
          <Button variant="add" onClick={() => openCapture({ type: "meeting", projectId: null })}>
            {t("home.meeting")}
          </Button>
        }
      />
      {meetings.isPending ? <p className="font-mono text-[13px] text-fg-muted">{t("common.loading")}</p> : null}
      {meetings.isError ? <p className="text-fg-secondary">{t("meetings.loadError")}</p> : null}
      {!meetings.isPending && rows.length === 0 ? <EmptyState>{t("meetings.empty")}</EmptyState> : null}
      <ul>
        {rows.map((item) => (
          <li key={item.id}>
            <RowLink
              to={`/item/${item.id}`}
              title={item.title || t("common.untitled")}
              meta={
                <>
                  {item.project ? <span className="mr-2 font-sans text-[12px]">{item.project.name}</span> : null}
                  {relativeTime(item.updated_at)}
                </>
              }
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
