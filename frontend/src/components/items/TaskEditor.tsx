import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";

import { patchItem } from "../../lib/api";
import { queryKeys } from "../../lib/queryKeys";
import { useProjectList } from "../../lib/queries";
import { useUi } from "../../stores/ui";
import type { Item, ItemPriority } from "../../types/api";
import { Modal } from "../ui/Modal";

const PRIORITIES: ItemPriority[] = ["none", "low", "medium", "high", "urgent"];

export function TaskEditor({ item, onClose }: { item: Item; onClose: () => void }) {
  const queryClient = useQueryClient();
  const pushToast = useUi((state) => state.pushToast);
  const projects = useProjectList("all");
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(item.body_md);
  const [due, setDue] = useState(item.due_on ?? "");
  const [priority, setPriority] = useState<ItemPriority>(item.priority ?? "none");
  const [projectId, setProjectId] = useState(item.project?.id ?? "");
  const [repeat, setRepeat] = useState(item.recurrence ?? "");

  useEffect(() => {
    if (title === item.title && body === item.body_md) return;
    const timer = window.setTimeout(() => {
      void save({ title, body_md: body });
    }, 400);
    return () => window.clearTimeout(timer);
    // Title and body debounce. Selects save immediately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body]);

  async function save(patch: Parameters<typeof patchItem>[1]) {
    try {
      const saved = await patchItem(item.id, patch);
      queryClient.setQueryData(queryKeys.item(item.id), saved);
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not save the task");
    }
  }

  return (
    <Modal title="Task" onClose={onClose}>
      <form className="flex flex-col gap-3 p-4" onSubmit={(event) => event.preventDefault()}>
        <input
          value={title}
          aria-label="Title"
          className="min-h-11 rounded-[8px] border border-border bg-canvas px-3 text-[16px] outline-none focus:border-fg"
          onChange={(event) => setTitle(event.target.value)}
        />
        <label className="block text-[13px] text-fg-secondary">
          Due
          <input
            type="date"
            value={due}
            className="mt-1.5 min-h-11 w-full rounded-[8px] border border-border bg-canvas px-3 text-[16px]"
            onChange={(event) => {
              const next = event.target.value;
              setDue(next);
              void save({ due_on: next || null });
            }}
          />
        </label>
        <label className="block text-[13px] text-fg-secondary">
          Priority
          <select
            value={priority}
            className="mt-1.5 min-h-11 w-full rounded-[8px] border border-border bg-canvas px-3 text-[16px]"
            onChange={(event) => {
              const next = event.target.value as ItemPriority;
              setPriority(next);
              void save({ priority: next });
            }}
          >
            {PRIORITIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[13px] text-fg-secondary">
          Repeats
          <select
            value={repeat}
            className="mt-1.5 min-h-11 w-full rounded-[8px] border border-border bg-canvas px-3 text-[16px]"
            onChange={(event) => {
              const next = event.target.value as "" | "weekly" | "monthly";
              setRepeat(next);
              const dueDate = due ? new Date(`${due}T00:00:00`) : new Date();
              void save({
                recurrence: next || null,
                recurrence_weekday: next === "weekly" ? (dueDate.getDay() + 6) % 7 : null,
                recurrence_monthday: next === "monthly" ? (due ? Number(due.slice(8, 10)) : 1) : null,
              });
            }}
          >
            <option value="">Does not repeat</option>
            <option value="weekly">Every week</option>
            <option value="monthly">Every month</option>
          </select>
        </label>
        <label className="block text-[13px] text-fg-secondary">
          Project
          <select
            value={projectId}
            className="mt-1.5 min-h-11 w-full rounded-[8px] border border-border bg-canvas px-3 text-[16px]"
            onChange={(event) => {
              const next = event.target.value;
              setProjectId(next);
              void save({ project_id: next || null });
            }}
          >
            <option value="">Inbox</option>
            {(projects.data?.projects ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <textarea
          value={body}
          aria-label="Notes"
          className="min-h-32 rounded-[8px] border border-border bg-canvas px-3 py-2 text-[16px] leading-[1.6] outline-none focus:border-fg"
          onChange={(event) => setBody(event.target.value)}
        />
        <Link to={`/item/${item.id}`} className="min-h-11 self-start leading-[2.75rem] underline">
          Open
        </Link>
      </form>
    </Modal>
  );
}
