import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";

import { createItem, errorMessage, newIdempotencyKey } from "../../lib/api";
import { filedContext } from "../../lib/capture";
import { insertTodayTask, invalidateItemViews, mapItem, projectRefFromCache } from "../../lib/cache";
import { cn } from "../../lib/cn";
import { todayISO, tomorrowISO } from "../../lib/dates";
import { useProjectList } from "../../lib/queries";
import { useOverlayLayer } from "../../lib/useOverlayLayer";
import { useUi } from "../../stores/ui";
import type { Item, ItemPriority } from "../../types/api";
import { IconButton } from "../ui/IconButton";
import { Popover } from "../ui/Popover";

const PRIORITIES: Array<[ItemPriority, string]> = [
  ["urgent", "Urgent"],
  ["high", "High"],
  ["medium", "Medium"],
  ["low", "Low"],
  ["none", "None"],
];

function chipClass(active: boolean): string {
  return cn(
    "min-h-11 rounded-full border px-3 text-[14px]",
    active ? "border-border-strong bg-interactive text-fg" : "border-border text-fg-secondary",
  );
}

export function QuickTaskBar({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const pushToast = useUi((state) => state.pushToast);
  const contextId = useUi((state) => state.contextId);
  const projects = useProjectList("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [priority, setPriority] = useState<ItemPriority>("none");
  const [projectOpen, setProjectOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const today = todayISO();
  const tomorrow = tomorrowISO();
  useOverlayLayer(true, onClose);

  const project = projects.data?.projects.find((entry) => entry.id === projectId);
  const priorityLabel = PRIORITIES.find(([value]) => value === priority)?.[1] ?? "Priority";

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
    } catch (error) {
      mapItem(queryClient, temp.id, () => null);
      setTitle(nextTitle);
      const message = errorMessage(error);
      if (message) pushToast(message);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 px-3 md:bottom-8 md:left-1/2 md:w-[560px] md:-translate-x-1/2 md:px-0">
      <form
        className="rounded-[10px] border border-border bg-elevated p-3 shadow-[var(--overlay-shadow)]"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            autoFocus
            value={title}
            aria-label="Add a task"
            placeholder="Add a task"
            className="min-h-11 min-w-0 flex-1 bg-transparent text-[16px] outline-none"
            onChange={(event) => setTitle(event.target.value)}
          />
          <IconButton label="Close" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className={chipClass(due === today)} onClick={() => setDue((value) => (value === today ? null : today))}>
            Today
          </button>
          <button
            type="button"
            className={chipClass(due === tomorrow)}
            onClick={() => setDue((value) => (value === tomorrow ? null : tomorrow))}
          >
            Tomorrow
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
                {project ? `@ ${project.name}` : "@ Project"}
              </button>
            }
          >
            <ul className="max-h-64 overflow-y-auto">
              <li>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center rounded-[8px] px-3 text-left hover:bg-interactive"
                  onClick={() => {
                    setProjectId(null);
                    setProjectOpen(false);
                  }}
                >
                  Inbox
                </button>
              </li>
              {(projects.data?.projects ?? []).map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center gap-2 rounded-[8px] px-3 text-left hover:bg-interactive"
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
                {priority === "none" ? "! Priority" : `! ${priorityLabel}`}
              </button>
            }
          >
            <ul>
              {PRIORITIES.map(([value, label]) => (
                <li key={value}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center rounded-[8px] px-3 text-left hover:bg-interactive"
                    onClick={() => {
                      setPriority(value);
                      setPriorityOpen(false);
                    }}
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </Popover>
        </div>
      </form>
    </div>
  );
}
