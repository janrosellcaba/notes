import type { ItemStatus } from "../../types/api";

import { cn } from "../../lib/cn";

const LABEL: Record<ItemStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
};

export function StatusPill({ status }: { status: ItemStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border border-border px-2 py-0.5 font-mono text-[13px] text-fg-muted",
        status === "in_progress" && "border-status-progress text-status-progress",
        status === "blocked" && "border-status-blocked text-status-blocked",
        status === "done" && "border-status-done text-status-done",
      )}
    >
      {LABEL[status]}
    </span>
  );
}
