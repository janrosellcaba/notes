import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Board } from "../components/kanban/Board";
import { ContextBadge } from "../components/ui/ContextBadge";
import { Modal } from "../components/ui/Modal";
import { Popover } from "../components/ui/Popover";
import { TextField } from "../components/ui/TextField";
import { archiveProject, deleteProject, getProject, listItems, patchProject } from "../lib/api";
import { relativeTime } from "../lib/dates";
import { queryKeys } from "../lib/queryKeys";
import { useUi } from "../stores/ui";
import type { ItemFilters } from "../types/api";

type Tab = "notes" | "board" | "meetings";

function tabFrom(value: string | null): Tab {
  if (value === "board" || value === "meetings") return value;
  return "notes";
}

export function ProjectDetailPage() {
  const { projectId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = tabFrom(params.get("tab"));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const openCapture = useUi((state) => state.openCapture);
  const pushToast = useUi((state) => state.pushToast);
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState("");
  const project = useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: () => getProject(projectId),
    enabled: projectId.length > 0,
  });
  const noteFilters = useMemo<ItemFilters>(() => ({ type: "note", project_id: projectId, limit: 200 }), [projectId]);
  const meetingFilters = useMemo<ItemFilters>(() => ({ type: "meeting", project_id: projectId, limit: 200 }), [projectId]);
  const boardFilters = useMemo<ItemFilters>(
    () => ({ type: "task", project_id: projectId, include_done: true, limit: 200 }),
    [projectId],
  );
  const notes = useQuery({
    queryKey: queryKeys.items(noteFilters),
    queryFn: () => listItems(noteFilters),
    enabled: tab === "notes",
  });
  const meetings = useQuery({
    queryKey: queryKeys.items(meetingFilters),
    queryFn: () => listItems(meetingFilters),
    enabled: tab === "meetings",
  });
  const board = useQuery({
    queryKey: queryKeys.items(boardFilters),
    queryFn: () => listItems(boardFilters),
    enabled: tab === "board",
  });

  function selectTab(next: Tab) {
    const copy = new URLSearchParams(params);
    if (next === "notes") copy.delete("tab");
    else copy.set("tab", next);
    setParams(copy, { replace: true });
  }

  async function rename() {
    const next = name.trim();
    if (!next || !project.data) return;
    try {
      const saved = await patchProject(project.data.id, { name: next });
      queryClient.setQueryData(queryKeys.project(project.data.id), saved);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      setRenaming(false);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not rename the project");
    }
  }

  async function archive() {
    if (!project.data) return;
    setMenu(false);
    try {
      await archiveProject(project.data.id);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      void navigate("/projects");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not archive the project");
    }
  }

  async function remove() {
    if (!project.data) return;
    try {
      await deleteProject(project.data.id);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      void navigate("/projects");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not delete the project");
    }
  }

  if (project.isPending) return <p className="text-fg-muted">Loading…</p>;
  if (project.isError || !project.data) return <p>This project is not available.</p>;
  const current = project.data;
  const meetingRows = [...(meetings.data?.items ?? [])].sort((left, right) => right.created_at.localeCompare(left.created_at));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex items-center gap-3">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: current.color }} />
        <h1 className="min-w-0 flex-1 truncate text-[20px]">{current.name}</h1>
        <ContextBadge color={current.context.color} icon={current.context.icon} name={current.context.name} />
        <Popover
          open={menu}
          onClose={() => {
            setMenu(false);
            setConfirmDelete(false);
          }}
          className="right-0 left-auto"
          trigger={
            <button type="button" className="min-h-11 rounded-[8px] px-3 hover:bg-interactive" aria-label="Project actions" onClick={() => setMenu((open) => !open)}>
              ···
            </button>
          }
        >
          <div className="flex min-w-40 flex-col p-1">
            <button
              type="button"
              className="min-h-11 rounded-[8px] px-3 text-left hover:bg-interactive"
              onClick={() => {
                setName(current.name);
                setMenu(false);
                setRenaming(true);
              }}
            >
              Rename
            </button>
            <button type="button" className="min-h-11 rounded-[8px] px-3 text-left hover:bg-interactive" onClick={() => void archive()}>
              Archive
            </button>
            {confirmDelete ? (
              <button type="button" className="min-h-11 rounded-[8px] px-3 text-left text-status-blocked hover:bg-interactive" onClick={() => void remove()}>
                Delete project
              </button>
            ) : (
              <button type="button" className="min-h-11 rounded-[8px] px-3 text-left hover:bg-interactive" onClick={() => setConfirmDelete(true)}>
                Delete
              </button>
            )}
          </div>
        </Popover>
      </header>
      <div className="flex gap-1 border-b border-border-subtle" role="tablist">
        {(["notes", "board", "meetings"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={`min-h-11 rounded-t-[8px] px-3 capitalize ${tab === value ? "text-fg" : "text-fg-muted"}`}
            onClick={() => selectTab(value)}
          >
            {value}
          </button>
        ))}
      </div>
      {tab === "notes" ? (
        <section className="flex flex-col gap-2">
          <button
            type="button"
            className="min-h-11 self-start rounded-[8px] px-2 text-fg-secondary hover:bg-interactive"
            onClick={() => openCapture({ type: "note", projectId: current.id })}
          >
            + Note in project
          </button>
          {(notes.data?.items ?? []).map((item) => (
            <Link key={item.id} to={`/item/${item.id}`} className="flex min-h-11 items-center justify-between gap-3 rounded-[8px] px-2 hover:bg-interactive">
              <span className="truncate">{item.title || "Untitled"}</span>
              <span className="font-mono text-[13px] text-fg-muted">{relativeTime(item.updated_at)}</span>
            </Link>
          ))}
        </section>
      ) : null}
      {tab === "board" ? <Board items={board.data?.items ?? []} projectId={current.id} showProject={false} /> : null}
      {tab === "meetings" ? (
        <section className="flex flex-col gap-2">
          <button
            type="button"
            className="min-h-11 self-start rounded-[8px] px-2 text-fg-secondary hover:bg-interactive"
            onClick={() => openCapture({ type: "transcript", projectId: current.id })}
          >
            + Paste transcript
          </button>
          {meetingRows.map((item) => (
            <Link key={item.id} to={`/item/${item.id}`} className="flex min-h-11 items-center justify-between gap-3 rounded-[8px] px-2 hover:bg-interactive">
              <span className="truncate">{item.title || "Untitled"}</span>
              <span className="font-mono text-[13px] text-fg-muted">{item.created_at.slice(0, 10)}</span>
            </Link>
          ))}
        </section>
      ) : null}
      {renaming ? (
        <Modal title="Rename project" onClose={() => setRenaming(false)}>
          <form
            className="flex flex-col gap-4 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void rename();
            }}
          >
            <TextField label="Name" value={name} onChange={(event) => setName(event.target.value)} />
            <button type="submit" className="min-h-11 rounded-[8px] bg-fg px-3 text-canvas">
              Save
            </button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
