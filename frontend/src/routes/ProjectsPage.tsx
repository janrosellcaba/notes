import { useState } from "react";

import { PageHeader } from "../components/ui/PageHeader";
import { NewButton } from "../components/ui/NewButton";
import { RowLink } from "../components/ui/RowLink";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { ContextMark } from "../components/shell/ContextMark";
import { useI18n, type MessageKey } from "../lib/i18n";
import { useContexts, useProjectList } from "../lib/queries";
import { useUi } from "../stores/ui";
import type { Project } from "../types/api";

type Scope = "active" | "closed";

function statusLabel(project: Project, t: (key: MessageKey) => string): string | undefined {
  if (project.status === "done") return t("project.statusDone");
  if (project.status === "cancelled") return t("project.statusCancelled");
  return undefined;
}

export function ProjectsPage() {
  const contextId = useUi((state) => state.contextId);
  const openCapture = useUi((state) => state.openCapture);
  const contexts = useContexts();
  const [scope, setScope] = useState<Scope>("active");
  const projects = useProjectList(contextId, { includeArchived: scope === "closed" });
  const { t } = useI18n();
  const groups = (contexts.data?.contexts ?? [])
    .filter((context) => contextId === "all" || context.id === contextId)
    .sort((left, right) => left.sort_order - right.sort_order);
  const rows = projects.data?.projects ?? [];
  const active = rows.filter((project) => project.status === "active");
  const closed = rows
    .filter((project) => project.status === "done" || project.status === "cancelled")
    .sort((left, right) => (right.archived_at ?? "").localeCompare(left.archived_at ?? ""));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <PageHeader
        title={t("projects.title")}
        actions={
          <>
            <SegmentedControl
              label={t("projects.scope")}
              value={scope}
              onChange={setScope}
              options={[
                { value: "active", label: t("projects.active") },
                { value: "closed", label: t("projects.closed") },
              ]}
            />
            <NewButton onClick={() => openCapture({ type: "project", contextId: null })}>
              {t("projects.new")}
            </NewButton>
          </>
        }
      />
      {scope === "closed" ? (
        closed.length === 0 ? (
          <p className="text-fg-muted">{t("projects.closedEmpty")}</p>
        ) : (
          <ul className="flex flex-col">
            {closed.map((project) => (
              <li key={project.id}>
                <RowLink
                  to={`/projects/${project.id}`}
                  title={project.name}
                  meta={[statusLabel(project, t), project.due_on, project.context.name].filter(Boolean).join(" · ")}
                />
              </li>
            ))}
          </ul>
        )
      ) : (
        groups.map((context) => {
          const contextRows = active.filter((project) => project.context.id === context.id);
          return (
            <section key={context.id}>
              <h2 className="mb-2 flex items-center gap-2 text-[13px] text-fg-muted">
                <ContextMark icon={context.icon} color={context.color} size={18} />
                {context.name}
              </h2>
              <ul className="flex flex-col">
                {contextRows.map((project) => (
                  <li key={project.id}>
                    <RowLink
                      to={`/projects/${project.id}`}
                      title={project.name}
                      meta={project.due_on ?? undefined}
                    />
                  </li>
                ))}
                {contextRows.length === 0 ? (
                  <li>
                    <NewButton
                      className="w-full justify-start text-fg-muted"
                      onClick={() => openCapture({ type: "project", contextId: context.id })}
                    >
                      {t("projects.empty")}
                    </NewButton>
                  </li>
                ) : null}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
