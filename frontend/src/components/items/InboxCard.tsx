import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";

import { archiveItem, convertItem, deleteItem, errorMessage, patchItem } from "../../lib/api";
import { dropInboxItem, invalidateItemViews, mapItem, restoreLists, snapshotLists } from "../../lib/cache";
import { cn } from "../../lib/cn";
import { relativeTime } from "../../lib/dates";
import { useUi } from "../../stores/ui";
import type { Item, Project } from "../../types/api";
import { Button } from "../ui/Button";
import { Popover } from "../ui/Popover";

const TYPE_LABEL = { note: "Note", task: "Task", meeting: "Meeting" } as const;

export function InboxCard({ item, projects }: { item: Item; projects: Project[] }) {
  const queryClient = useQueryClient();
  const pushToast = useUi((state) => state.pushToast);
  const [assignOpen, setAssignOpen] = useState(false);
  const [armed, setArmed] = useState<"archive" | "delete" | null>(null);

  function fail(error: unknown, snapshot: ReturnType<typeof snapshotLists>) {
    restoreLists(queryClient, snapshot);
    const message = errorMessage(error);
    if (message) pushToast(message);
  }

  const assign = useMutation({
    mutationFn: (projectId: string) => patchItem(item.id, { project_id: projectId }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["items"] });
      await queryClient.cancelQueries({ queryKey: ["home"] });
      const snapshot = snapshotLists(queryClient);
      dropInboxItem(queryClient, item.id);
      return { snapshot };
    },
    onError: (error, _vars, context) => {
      if (context) fail(error, context.snapshot);
    },
    onSettled: () => invalidateItemViews(queryClient, item.id),
  });

  const convert = useMutation({
    mutationFn: () => convertItem(item.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["items"] });
      const snapshot = snapshotLists(queryClient);
      mapItem(queryClient, item.id, (current) => ({
        ...current,
        type: "task",
        status: "todo",
        priority: "none",
        pinned: false,
      }));
      return { snapshot };
    },
    onError: (error, _vars, context) => {
      if (context) fail(error, context.snapshot);
    },
    onSuccess: (saved) => mapItem(queryClient, item.id, () => saved),
    onSettled: () => invalidateItemViews(queryClient, item.id),
  });

  const archive = useMutation({
    mutationFn: () => archiveItem(item.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["items"] });
      await queryClient.cancelQueries({ queryKey: ["home"] });
      const snapshot = snapshotLists(queryClient);
      dropInboxItem(queryClient, item.id);
      return { snapshot };
    },
    onError: (error, _vars, context) => {
      if (context) fail(error, context.snapshot);
    },
    onSettled: () => invalidateItemViews(queryClient, item.id),
  });

  const remove = useMutation({
    mutationFn: () => deleteItem(item.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["items"] });
      await queryClient.cancelQueries({ queryKey: ["home"] });
      const snapshot = snapshotLists(queryClient);
      dropInboxItem(queryClient, item.id);
      return { snapshot };
    },
    onError: (error, _vars, context) => {
      if (context) fail(error, context.snapshot);
    },
    onSettled: () => invalidateItemViews(queryClient, item.id),
  });

  const preview = (item.type === "meeting" ? item.transcript_raw || item.body_md : item.body_md).trim();

  return (
    <article className="rounded-[10px] border border-border bg-elevated p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[13px] text-fg-muted">{TYPE_LABEL[item.type]}</p>
        <time className="font-mono text-[13px] text-fg-muted" dateTime={item.created_at}>
          {relativeTime(item.created_at)}
        </time>
      </div>
      <Link to={`/item/${item.id}`} className="mt-1 block text-[16px]">
        {item.title || "Untitled"}
      </Link>
      {preview ? <p className="mt-1 line-clamp-2 text-fg-secondary">{preview}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Popover
          open={assignOpen}
          onClose={() => setAssignOpen(false)}
          trigger={
            <Button
              variant="ghost"
              className="border border-border"
              onClick={() => {
                setArmed(null);
                setAssignOpen((value) => !value);
              }}
            >
              Assign
            </Button>
          }
        >
          <ul className="max-h-64 overflow-y-auto">
            {projects.length === 0 ? <li className="px-3 py-2 text-fg-muted">No projects</li> : null}
            {projects.map((project) => (
              <li key={project.id}>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center gap-2 rounded-[8px] px-3 text-left hover:bg-interactive"
                  onClick={() => {
                    setAssignOpen(false);
                    assign.mutate(project.id);
                  }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: project.color }} />
                  <span className="truncate">{project.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </Popover>
        {item.type === "note" ? (
          <Button
            variant="ghost"
            className="border border-border"
            onClick={() => {
              setArmed(null);
              convert.mutate();
            }}
          >
            Convert
          </Button>
        ) : null}
        <Button
          variant="ghost"
          className="border border-border"
          onClick={() => {
            if (armed !== "archive") {
              setArmed("archive");
              return;
            }
            archive.mutate();
          }}
        >
          {armed === "archive" ? "Archive?" : "Archive"}
        </Button>
        <Button
          variant="ghost"
          className={cn("border border-border", armed === "delete" && "text-status-blocked")}
          onClick={() => {
            if (armed !== "delete") {
              setArmed("delete");
              return;
            }
            remove.mutate();
          }}
        >
          {armed === "delete" ? "Delete?" : "Delete"}
        </Button>
      </div>
    </article>
  );
}
