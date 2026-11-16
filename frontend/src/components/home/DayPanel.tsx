import { FileText, ListTodo, PenLine } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { listItems, patchItem } from "../../lib/api";
import { mapItem, restoreLists, snapshotLists } from "../../lib/cache";
import { useI18n } from "../../lib/i18n";
import { queryKeys } from "../../lib/queryKeys";
import { useUi } from "../../stores/ui";
import type { Item, ItemStatus } from "../../types/api";
import { TaskEditor } from "../items/TaskEditor";
import { Modal } from "../ui/Modal";
import { PriorityMark } from "../ui/PriorityMark";
import { StatusSelect } from "../ui/StatusSelect";

function dayLabel(day: string, language: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, date ?? 1).toLocaleDateString(language, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function createdOn(iso: string): string {
  return iso.slice(0, 10);
}

export function DayPanel({
  day,
  projectId,
  onClose,
}: {
  day: string;
  projectId?: string;
  onClose: () => void;
}) {
  const { locale, t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const openCapture = useUi((state) => state.openCapture);
  const pushToast = useUi((state) => state.pushToast);
  const contextId = useUi((state) => state.contextId);
  const [editing, setEditing] = useState<Item | null>(null);
  const language = locale === "en" ? "en-GB" : locale;
  const title = dayLabel(day, language);
  const filters = {
    limit: 200,
    ...(projectId
      ? { project_id: projectId }
      : { context_id: contextId === "all" ? undefined : contextId }),
  };
  const tasks = useQuery({
    queryKey: queryKeys.items({ ...filters, type: "task", include_done: true }),
    queryFn: () => listItems({ ...filters, type: "task", include_done: true }),
  });
  const meetings = useQuery({
    queryKey: queryKeys.items({ ...filters, type: "meeting" }),
    queryFn: () => listItems({ ...filters, type: "meeting" }),
  });

  const dayTasks = useMemo(
    () => (tasks.data?.items ?? []).filter((item) => item.due_on === day && !item.parent_id),
    [tasks.data, day],
  );
  const dayMeetings = useMemo(
    () => (meetings.data?.items ?? []).filter((item) => createdOn(item.created_at) === day),
    [meetings.data, day],
  );
  const empty = dayTasks.length === 0 && dayMeetings.length === 0;

  function create(type: "task" | "meeting" | "note") {
    onClose();
    if (type === "task") {
      openCapture({ type: "task", dueOn: day, projectId: projectId ?? null });
      return;
    }
    if (type === "meeting") {
      openCapture({ type: "meeting", projectId: projectId ?? null });
      return;
    }
    openCapture({ type: "note", projectId: projectId ?? null });
  }

  async function setStatus(item: Item, status: ItemStatus) {
    if (item.status === status) return;
    const lists = snapshotLists(queryClient);
    mapItem(queryClient, item.id, (current) => ({
      ...current,
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
    }));
    try {
      const saved = await patchItem(item.id, { status });
      mapItem(queryClient, item.id, () => saved);
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
    } catch (error) {
      restoreLists(queryClient, lists);
      pushToast(error instanceof Error ? error.message : t("editor.unavailable"));
    }
  }

  return (
    <>
      <Modal title={title} onClose={onClose}>
        <div className="flex max-h-[75dvh] flex-col gap-4 overflow-y-auto p-4">
          <header>
            <h2 className="text-[16px] font-medium capitalize">{title}</h2>
            <p className="mt-0.5 font-mono text-[12px] text-fg-muted">{day}</p>
          </header>

          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-fg-secondary hover:bg-interactive hover:text-fg"
              onClick={() => create("task")}
            >
              <ListTodo size={14} className="opacity-70" />
              {t("home.task")}
            </button>
            <button
              type="button"
              className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-fg-secondary hover:bg-interactive hover:text-fg"
              onClick={() => create("meeting")}
            >
              <FileText size={14} className="opacity-70" />
              {t("home.meeting")}
            </button>
            <button
              type="button"
              className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-fg-secondary hover:bg-interactive hover:text-fg"
              onClick={() => create("note")}
            >
              <PenLine size={14} className="opacity-70" />
              {t("home.note")}
            </button>
          </div>

          {empty ? <p className="text-[13px] text-fg-muted">{t("calendar.emptyDay")}</p> : null}

          {dayTasks.length > 0 ? (
            <section>
              <h3 className="mb-1.5 text-[12px] text-fg-muted">{t("nav.tasks")}</h3>
              <ul>
                {dayTasks.map((item) => (
                  <li key={item.id} className="flex min-h-9 items-center gap-2 rounded-md px-1 hover:bg-interactive">
                    <StatusSelect
                      status={item.status ?? "todo"}
                      showLabel={false}
                      onChange={(status) => void setStatus(item, status)}
                    />
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() => setEditing(item)}
                    >
                      <span
                        className={`min-w-0 flex-1 truncate text-[13px] ${item.status === "done" ? "text-fg-muted line-through" : ""}`}
                      >
                        {item.title || t("common.untitled")}
                      </span>
                      <PriorityMark priority={item.priority} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {dayMeetings.length > 0 ? (
            <section>
              <h3 className="mb-1.5 text-[12px] text-fg-muted">{t("nav.meetings")}</h3>
              <ul>
                {dayMeetings.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="flex min-h-9 w-full items-center rounded-md px-1 text-left text-[13px] hover:bg-interactive"
                      onClick={() => {
                        onClose();
                        void navigate(`/item/${item.id}`);
                      }}
                    >
                      {item.title || t("common.untitled")}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </Modal>
      {editing ? <TaskEditor item={editing} onClose={() => setEditing(null)} onOpen={setEditing} /> : null}
    </>
  );
}
