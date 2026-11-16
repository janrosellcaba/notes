import { PageHeader } from "../components/ui/PageHeader";
import { NewButton } from "../components/ui/NewButton";
import { RowLink } from "../components/ui/RowLink";
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
      <PageHeader
        title={t("projects.title")}
        actions={
          <NewButton onClick={() => openCapture({ type: "project", contextId: null })}>
            {t("projects.new")}
          </NewButton>
        }
      />
      {groups.map((context) => {
        const rows = (projects.data?.projects ?? []).filter((project) => project.context.id === context.id);
        return (
          <section key={context.id}>
            <h2 className="mb-2 flex items-center gap-2 text-[13px] text-fg-muted">
              <ContextMark icon={context.icon} color={context.color} size={18} />
              {context.name}
            </h2>
            <ul className="flex flex-col">
              {rows.map((project) => (
                <li key={project.id}>
                  <RowLink to={`/projects/${project.id}`} title={project.name} />
                </li>
              ))}
              {rows.length === 0 ? (
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
      })}
    </div>
  );
}
