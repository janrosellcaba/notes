import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { EmptyState } from "../components/ui/EmptyState";
import { ListFilter, matchesQuery } from "../components/ui/ListFilter";
import { NewButton } from "../components/ui/NewButton";
import { PageHeader } from "../components/ui/PageHeader";
import { RowLink } from "../components/ui/RowLink";
import { listItems } from "../lib/api";
import { relativeTime } from "../lib/dates";
import { FIELD_SELECT } from "../lib/field";
import { useI18n } from "../lib/i18n";
import { queryKeys } from "../lib/queryKeys";
import { useProjectList } from "../lib/queries";
import { useUi } from "../stores/ui";

export function NotesPage() {
  const contextId = useUi((state) => state.contextId);
  const openCapture = useUi((state) => state.openCapture);
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const projects = useProjectList(contextId);
  const filters = {
    type: "note" as const,
    limit: 200,
    context_id: contextId === "all" ? undefined : contextId,
  };
  const notes = useQuery({
    queryKey: queryKeys.items(filters),
    queryFn: () => listItems(filters),
  });
  const rows = useMemo(() => {
    return (notes.data?.items ?? [])
      .filter((item) => !item.daily_on)
      .filter((item) => (projectFilter === "all" ? true : item.project?.id === projectFilter))
      .filter((item) =>
        matchesQuery(`${item.title} ${item.project?.name ?? ""} ${item.body_md ?? ""}`, query),
      );
  }, [notes.data?.items, projectFilter, query]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader
        title={t("notes.title")}
        actions={
          <NewButton onClick={() => openCapture({ type: "note", projectId: null })}>
            {t("home.note")}
          </NewButton>
        }
      />
      <ListFilter value={query} onChange={setQuery} placeholder={t("filter.notes")}>
        <select
          aria-label={t("filter.project")}
          value={projectFilter}
          className={`${FIELD_SELECT} w-auto`}
          onChange={(event) => setProjectFilter(event.target.value)}
        >
          <option value="all">{t("filter.anyProject")}</option>
          {(projects.data?.projects ?? []).map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </ListFilter>
      {notes.isPending ? <p className="font-mono text-[13px] text-fg-muted">{t("common.loading")}</p> : null}
      {notes.isError ? <p className="text-fg-secondary">{t("notes.loadError")}</p> : null}
      {!notes.isPending && rows.length === 0 ? <EmptyState>{t("notes.empty")}</EmptyState> : null}
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
