import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";

import { archiveItem, convertItem, deleteItem, errorMessage, patchItem, restoreItem } from "../../lib/api";
import { dropInboxItem, invalidateItemViews, mapItem, restoreLists, snapshotLists } from "../../lib/cache";
import { cn } from "../../lib/cn";
import { relativeTime } from "../../lib/dates";
import { useUi } from "../../stores/ui";
import type { Item, Project } from "../../types/api";
import { useI18n, type MessageKey } from "../../lib/i18n";
import { ContextMark } from "../shell/ContextMark";
import { Popover } from "../ui/Popover";

export function InboxCard({ item, projects }: { item: Item; projects: Project[] }) {
  const queryClient = useQueryClient();
  const pushToast = useUi((state) => state.pushToast);
  const [assignOpen, setAssignOpen] = useState(false);
  const [armed, setArmed] = useState<"archive" | "delete" | null>(null);
  const { t } = useI18n();

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
    onSuccess: () => {
      pushToast(t("inbox.trashed"), { href: "/trash", label: t("inbox.view") }, {
        label: t("inbox.undo"),
        run: () => {
          void restoreItem(item.id).then(() => invalidateItemViews(queryClient, item.id));
        },
      });
    },
    onSettled: () => invalidateItemViews(queryClient, item.id),
  });

  const preview = (item.type === "meeting" ? item.transcript_raw || item.body_md : item.body_md).trim();

  return (
    <article className="group border-b border-border-subtle py-3">
      <div className="flex items-baseline gap-3">
        <p className="w-16 shrink-0 text-[12px] text-fg-muted">{t(`type.${item.type}` as MessageKey)}</p>
        <Link to={`/item/${item.id}`} className="min-w-0 flex-1 truncate">
          {item.title || t("common.untitled")}
        </Link>
        <time className="shrink-0 font-mono text-[12px] text-fg-muted" dateTime={item.created_at}>
          {relativeTime(item.created_at)}
        </time>
      </div>
      {preview ? <p className="mt-1 line-clamp-1 pl-[4.75rem] text-[13px] text-fg-secondary">{preview}</p> : null}
      <div className="mt-1 flex flex-wrap gap-1 pl-[4.75rem]">
        <Popover
          open={assignOpen}
          onClose={() => setAssignOpen(false)}
          trigger={
            <button
              type="button"
              className="min-h-7 rounded-[6px] px-1.5 text-[12px] text-fg-secondary hover:bg-interactive hover:text-fg"
              onClick={() => {
                setArmed(null);
                setAssignOpen((value) => !value);
              }}
            >
              {t("inbox.assign")}
            </button>
          }
        >
          <ul className="max-h-64 overflow-y-auto">
            {projects.length === 0 ? <li className="px-3 py-2 text-[13px] text-fg-muted">{t("inbox.noProjects")}</li> : null}
            {projects.map((project) => (
              <li key={project.id}>
                <button
                  type="button"
                  className="flex min-h-8 w-full items-center gap-2 rounded-[8px] px-2 text-left text-[13px] hover:bg-interactive"
                  onClick={() => {
                    setAssignOpen(false);
                    assign.mutate(project.id);
                  }}
                >
                  <ContextMark icon={project.context.icon} color={project.context.color} size={16} />
                  <span className="truncate">{project.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </Popover>
        {item.type === "note" ? (
          <button
            type="button"
            className="min-h-7 rounded-[6px] px-1.5 text-[12px] text-fg-secondary hover:bg-interactive hover:text-fg"
            onClick={() => {
              setArmed(null);
              convert.mutate();
            }}
          >
            {t("inbox.convert")}
          </button>
        ) : null}
        <button
          type="button"
          className="min-h-7 rounded-[6px] px-1.5 text-[12px] text-fg-secondary hover:bg-interactive hover:text-fg"
          onClick={() => {
            if (armed !== "archive") {
              setArmed("archive");
              return;
            }
            archive.mutate();
          }}
        >
          {armed === "archive" ? t("inbox.archiveConfirm") : t("inbox.archive")}
        </button>
        <button
          type="button"
          className={cn(
            "min-h-7 rounded-[6px] px-1.5 text-[12px] text-fg-secondary hover:bg-interactive hover:text-fg",
            armed === "delete" && "text-status-blocked",
          )}
          onClick={() => {
            if (armed !== "delete") {
              setArmed("delete");
              return;
            }
            remove.mutate();
          }}
        >
          {armed === "delete" ? t("inbox.deleteConfirm") : t("inbox.delete")}
        </button>
      </div>
    </article>
  );
}
