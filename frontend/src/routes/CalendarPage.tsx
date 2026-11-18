import { useState } from "react";

import { MonthCalendar } from "../components/home/MonthCalendar";
import { ListFilter } from "../components/ui/ListFilter";
import { PageHeader } from "../components/ui/PageHeader";
import { useI18n } from "../lib/i18n";
import { useProjectList } from "../lib/queries";
import { useUi } from "../stores/ui";

export function CalendarPage() {
  const { t } = useI18n();
  const contextId = useUi((state) => state.contextId);
  const projects = useProjectList(contextId);
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <PageHeader title={t("calendar.title")}>
        <p className="text-[13px] text-fg-muted">{t("calendar.detail")}</p>
      </PageHeader>
      <ListFilter value={query} onChange={setQuery} placeholder={t("filter.calendar")}>
        <select
          aria-label={t("filter.project")}
          value={projectFilter}
          className="min-h-9 rounded-md border border-border bg-canvas px-2 text-[13px] outline-none focus:border-fg"
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
      <MonthCalendar
        projectId={projectFilter === "all" ? undefined : projectFilter}
        titleQuery={query}
      />
    </div>
  );
}
