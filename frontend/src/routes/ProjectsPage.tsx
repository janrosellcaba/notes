import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";

import { PageHeader } from "../components/ui/PageHeader";
import { NewButton } from "../components/ui/NewButton";
import { Button } from "../components/ui/Button";
import { ListFilter, matchesQuery } from "../components/ui/ListFilter";
import { Popover } from "../components/ui/Popover";
import { Modal } from "../components/ui/Modal";
import { TextField } from "../components/ui/TextField";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { ContextMark } from "../components/shell/ContextMark";
import { deleteProject, patchProject } from "../lib/api";
import { FIELD } from "../lib/field";
import { useI18n, type MessageKey } from "../lib/i18n";
import { queryKeys } from "../lib/queryKeys";
import { useContexts, useProjectList } from "../lib/queries";
import { useUi } from "../stores/ui";
import type { Project, ProjectStatus } from "../types/api";

type Scope = "active" | "closed";

function statusLabel(project: Project, t: (key: MessageKey) => string): string | undefined {
  if (project.status === "done") return t("project.statusDone");
  if (project.status === "cancelled") return t("project.statusCancelled");
  return undefined;
}

function ProjectRow({
  project,
  meta,
  onChanged,
}: {
  project: Project;
  meta?: string;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const pushToast = useUi((state) => state.pushToast);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(project.name);
  const [due, setDue] = useState(project.due_on ?? "");

  async function setStatus(status: ProjectStatus, withUndo = true) {
    const previous = project.status;
    setMenu(false);
    try {
      await patchProject(project.id, { status });
      onChanged();
      if (withUndo && previous !== status) {
        pushToast(t("project.statusUpdated"), undefined, {
          label: t("common.undo"),
          run: () => {
            void setStatus(previous, false);
          },
        });
      }
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not update the project");
    }
  }

  async function saveEdit() {
    const next = name.trim();
    if (!next) return;
    try {
      await patchProject(project.id, { name: next, due_on: due || null });
      setEditing(false);
      onChanged();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not update the project");
    }
  }

  async function remove() {
    try {
      await deleteProject(project.id);
      setMenu(false);
      onChanged();
      pushToast(t("project.deleted"));
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not delete the project");
    }
  }

  return (
    <>
      <div className="group relative flex min-h-11 items-center gap-2 rounded-[8px] px-2 hover:bg-interactive">
        <Link to={`/projects/${project.id}`} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left text-[14px]">
          <span className="min-w-0 flex-1 truncate">{project.name}</span>
          {meta ? <span className="shrink-0 font-mono text-[12px] text-fg-muted">{meta}</span> : null}
        </Link>
        <Popover
          open={menu}
          onClose={() => {
            setMenu(false);
            setConfirmDelete(false);
          }}
          className="right-0 left-auto"
          trigger={
            <button
              type="button"
              aria-label={t("project.actions")}
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-canvas hover:text-fg ${
                menu ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              }`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setMenu((open) => !open);
              }}
            >
              ···
            </button>
          }
        >
          <div className="flex min-w-40 flex-col p-1">
            <Button
              variant="consult"
              className="w-full justify-start"
              onClick={() => {
                setName(project.name);
                setDue(project.due_on ?? "");
                setMenu(false);
                setEditing(true);
              }}
            >
              {t("project.edit")}
            </Button>
            <Button
              variant="consult"
              className="w-full justify-start"
              onClick={() => {
                setMenu(false);
                void navigate(`/projects/${project.id}`);
              }}
            >
              {t("project.open")}
            </Button>
            {project.status === "active" ? (
              <>
                <Button variant="consult" className="w-full justify-start" onClick={() => void setStatus("done")}>
                  {t("project.markDone")}
                </Button>
                <Button variant="consult" className="w-full justify-start" onClick={() => void setStatus("cancelled")}>
                  {t("project.markCancelled")}
                </Button>
              </>
            ) : (
              <Button variant="consult" className="w-full justify-start" onClick={() => void setStatus("active")}>
                {t("project.reopen")}
              </Button>
            )}
            {confirmDelete ? (
              <Button variant="consult" tone="danger" className="w-full justify-start" onClick={() => void remove()}>
                {t("project.deleteConfirm")}
              </Button>
            ) : (
              <Button variant="consult" className="w-full justify-start" onClick={() => setConfirmDelete(true)}>
                {t("project.delete")}
              </Button>
            )}
          </div>
        </Popover>
      </div>
      {editing ? (
        <Modal title={t("project.edit")} onClose={() => setEditing(false)}>
          <form
            className="flex flex-col gap-3 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void saveEdit();
            }}
          >
            <TextField
              label={t("project.name")}
              value={name}
              autoFocus
              onChange={(event) => setName(event.target.value)}
            />
            <label className="flex flex-col gap-1.5 text-[13px] text-fg-secondary">
              {t("project.due")}
              <input
                type="date"
                value={due}
                className={FIELD}
                onChange={(event) => setDue(event.target.value)}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="consult" onClick={() => setEditing(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" variant="go" disabled={name.trim().length === 0}>
                {t("common.save")}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}

export function ProjectsPage() {
  const contextId = useUi((state) => state.contextId);
  const openCapture = useUi((state) => state.openCapture);
  const queryClient = useQueryClient();
  const contexts = useContexts();
  const [scope, setScope] = useState<Scope>("active");
  const [query, setQuery] = useState("");
  const projects = useProjectList(contextId, { includeArchived: scope === "closed" });
  const { t } = useI18n();
  const groups = (contexts.data?.contexts ?? [])
    .filter((context) => contextId === "all" || context.id === contextId)
    .sort((left, right) => left.sort_order - right.sort_order);
  const rows = useMemo(
    () =>
      (projects.data?.projects ?? []).filter((project) =>
        matchesQuery(`${project.name} ${project.context.name}`, query),
      ),
    [projects.data?.projects, query],
  );
  const active = rows.filter((project) => project.status === "active");
  const closed = rows
    .filter((project) => project.status === "done" || project.status === "cancelled")
    .sort((left, right) => (right.archived_at ?? "").localeCompare(left.archived_at ?? ""));

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["projects"] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.projects(contextId) });
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
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
      <ListFilter value={query} onChange={setQuery} placeholder={t("filter.projects")} />
      {scope === "closed" ? (
        closed.length === 0 ? (
          <p className="text-fg-muted">{t("projects.closedEmpty")}</p>
        ) : (
          <ul className="flex flex-col">
            {closed.map((project) => (
              <li key={project.id}>
                <ProjectRow
                  project={project}
                  meta={[statusLabel(project, t), project.due_on, project.context.name].filter(Boolean).join(" · ")}
                  onChanged={refresh}
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
                    <ProjectRow project={project} meta={project.due_on ?? undefined} onChanged={refresh} />
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
