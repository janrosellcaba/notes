import { Link } from "react-router";

import { ContextMark } from "../components/shell/ContextMark";
import { useI18n } from "../lib/i18n";
import { useContexts, useProjectList } from "../lib/queries";
import { useUi } from "../stores/ui";

export function ProjectsPage() {
  const contextId = useUi((state) => state.contextId);
  const openCapture = useUi((state) => state.openCapture);
  const contexts = useContexts();
  const projects = useProjectList(contextId);
  const { t } = useI18n();
  const groups = (contexts.data?.contexts ?? [])
    .filter((context) => contextId === "all" || context.id === contextId)
    .sort((left, right) => left.sort_order - right.sort_order);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <h1 className="text-[20px]">{t("projects.title")}</h1>
      {groups.map((context) => {
        const rows = (projects.data?.projects ?? []).filter((project) => project.context.id === context.id);
        return (
          <section key={context.id}>
            <h2 className="mb-2 flex items-center gap-2 text-[13px] text-fg-secondary">
              <ContextMark icon={context.icon} color={context.color} size={18} />
              {context.name}
            </h2>
            <ul className="flex flex-col">
              {rows.map((project) => (
                <li key={project.id}>
                  <Link
                    to={`/projects/${project.id}`}
                    className="flex min-h-11 items-center gap-3 rounded-[8px] px-2 hover:bg-interactive"
                  >
                    <span>{project.name}</span>
                  </Link>
                </li>
              ))}
              {rows.length === 0 ? (
                <li>
                  <button
                    type="button"
                    className="min-h-11 rounded-[8px] px-2 text-fg-muted hover:bg-interactive hover:text-fg"
                    onClick={() => openCapture({ type: "project", contextId: context.id })}
                  >
                    {t("projects.empty")}
                  </button>
                </li>
              ) : null}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
