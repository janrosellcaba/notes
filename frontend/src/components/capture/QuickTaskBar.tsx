import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createItem, errorMessage, newIdempotencyKey } from "../../lib/api";
import { filedContext } from "../../lib/capture";
import { useI18n } from "../../lib/i18n";
import { insertTodayTask, invalidateItemViews, mapItem, projectRefFromCache } from "../../lib/cache";
import { cn } from "../../lib/cn";
import { todayISO, tomorrowISO } from "../../lib/dates";
import { useProjectList } from "../../lib/queries";
import { useUi } from "../../stores/ui";
import type { Item, ItemPriority } from "../../types/api";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Popover } from "../ui/Popover";

const PRIORITIES: ItemPriority[] = ["urgent", "high", "medium", "low", "none"];

function chipClass(active: boolean): string {
  return cn(
    "min-h-8 rounded-[8px] border px-2.5 text-[13px]",
    active ? "border-border-strong bg-interactive text-fg" : "border-border bg-canvas text-fg-secondary",
  );
}

export function QuickTaskBar({
  dueOn = null,
  projectId: initialProjectId = null,
  onClose,
}: {
  dueOn?: string | null;
  projectId?: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const pushToast = useUi((state) => state.pushToast);
  const contextId = useUi((state) => state.contextId);
  const { t } = useI18n();
  const projects = useProjectList("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState<string | null>(dueOn);
  const [projectId, setProjectId] = useState<string | null>(initialProjectId);
  const [priority, setPriority] = useState<ItemPriority>("none");
  const [projectOpen, setProjectOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const today = todayISO();
  const tomorrow = tomorrowISO();

  const project = projects.data?.projects.find((entry) => entry.id === projectId);
  const priorityLabel = t(`task.${priority}` as "task.none");

  async function submit() {
    const nextTitle = title.trim();
    if (!nextTitle) return;
    const temp: Item = {
      id: `tmp_${crypto.randomUUID()}`,
      type: "task",
      title: nextTitle,
      body_md: "",
      project: projectRefFromCache(queryClient, projectId),
      status: "todo",
      priority,
      due_on: due,
      completed_at: null,
      position: 0,
      pinned: false,
      transcript_raw: null,
      ai_summary: null,
      ai_action_items: null,
      calendar_event_id: null,
      calendar_provider: null,
      external_url: null,
      source_item_id: null,
      source_selection: null,
      archived_at: null,
      deleted_at: null,
      daily_on: null,
      recurrence: null,
      recurrence_weekday: null,
      recurrence_monthday: null,
      context: null,
      parent_id: null,
      starts_on: null,
      assignee: null,
      subtask_total: 0,
      subtask_done: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    insertTodayTask(queryClient, temp, today);
    setTitle("");
    inputRef.current?.focus();
    try {
      const saved = await createItem(
        {
          type: "task",
          title: nextTitle,
          project_id: projectId,
          context_id: filedContext(contextId, projectId),
          priority,
          due_on: due,
        },
        newIdempotencyKey(),
      );
      mapItem(queryClient, temp.id, () => saved);
      if (saved.due_on === today) insertTodayTask(queryClient, saved, today);
      invalidateItemViews(queryClient, saved.id);
      onClose();
    } catch (error) {
      mapItem(queryClient, temp.id, () => null);
      setTitle(nextTitle);
      const message = errorMessage(error);
      if (message) pushToast(message);
      inputRef.current?.focus();
    }
  }

  return (
    <Modal title={t("tasks.new")} onClose={onClose}>
      <form
        className="flex flex-col gap-3 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <input
          ref={inputRef}
          autoFocus
          value={title}
          aria-label={t("task.add")}
          placeholder={t("task.add")}
          className="min-h-11 rounded-[8px] border border-border bg-canvas px-3 text-[16px] outline-none focus:border-fg"
          onChange={(event) => setTitle(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" className={chipClass(due === today)} onClick={() => setDue((value) => (value === today ? null : today))}>
            {t("task.today")}
          </button>
          <button
            type="button"
            className={chipClass(due === tomorrow)}
            onClick={() => setDue((value) => (value === tomorrow ? null : tomorrow))}
          >
            {t("task.tomorrow")}
          </button>
          <Popover
            open={projectOpen}
            onClose={() => setProjectOpen(false)}
            trigger={
              <button
                type="button"
                className={chipClass(projectId !== null)}
                onClick={() => {
                  setPriorityOpen(false);
                  setProjectOpen((value) => !value);
                }}
              >
                {project ? `@ ${project.name}` : `@ ${t("task.project")}`}
              </button>
            }
          >
            <ul className="max-h-64 overflow-y-auto">
              <li>
                <button
                  type="button"
                  className="flex min-h-8 w-full items-center rounded-[8px] px-3 text-left text-[13px] hover:bg-interactive"
                  onClick={() => {
                    setProjectId(null);
                    setProjectOpen(false);
                  }}
                >
                  {t("tasks.noProject")}
                </button>
              </li>
              {(projects.data?.projects ?? []).map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    className="flex min-h-8 w-full items-center gap-2 rounded-[8px] px-3 text-left text-[13px] hover:bg-interactive"
                    onClick={() => {
                      setProjectId(entry.id);
                      setProjectOpen(false);
                    }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: entry.color }} />
                    {entry.name}
                  </button>
                </li>
              ))}
            </ul>
          </Popover>
          <Popover
            open={priorityOpen}
            onClose={() => setPriorityOpen(false)}
            trigger={
              <button
                type="button"
                className={chipClass(priority !== "none")}
                onClick={() => {
                  setProjectOpen(false);
                  setPriorityOpen((value) => !value);
                }}
              >
                {priority === "none" ? `! ${t("task.priority")}` : `! ${priorityLabel}`}
              </button>
            }
          >
            <ul>
              {PRIORITIES.map((value) => (
                <li key={value}>
                  <button
                    type="button"
                    className="flex min-h-8 w-full items-center rounded-[8px] px-3 text-left text-[13px] hover:bg-interactive"
                    onClick={() => {
                      setPriority(value);
                      setPriorityOpen(false);
                    }}
                  >
                    {t(`task.${value}` as "task.none")}
                  </button>
                </li>
              ))}
            </ul>
          </Popover>
        </div>
        <Button type="submit" variant="go" disabled={title.trim().length === 0}>
          {t("tasks.create")}
        </Button>
      </form>
    </Modal>
  );
}
