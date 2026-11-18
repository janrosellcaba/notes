import { useState } from "react";

import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";
import type { ItemPriority } from "../../types/api";
import { Popover } from "./Popover";
import { PriorityMark } from "./PriorityMark";

const PRIORITIES: ItemPriority[] = ["urgent", "high", "medium", "low", "none"];

export function PrioritySelect({
  priority,
  onChange,
  className,
}: {
  priority: ItemPriority | null;
  onChange: (priority: ItemPriority) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const current = priority ?? "none";

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      className="left-0"
      trigger={
        <button
          type="button"
          className={cn("inline-flex min-h-8 items-center rounded-[8px] px-1.5 hover:bg-interactive", className)}
          aria-label={t("task.priority")}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={(event) => {
            event.stopPropagation();
            setOpen((value) => !value);
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <PriorityMark priority={current} />
        </button>
      }
    >
      <ul className="min-w-40 p-1" role="listbox" aria-label={t("task.priority")}>
        {PRIORITIES.map((option) => {
          const active = option === current;
          return (
            <li key={option}>
              <button
                type="button"
                role="option"
                aria-selected={active}
                className={cn(
                  "flex min-h-9 w-full items-center gap-2 rounded-[8px] px-2.5 text-left text-[13px] hover:bg-interactive",
                  active && "bg-interactive",
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(false);
                  if (option !== current) onChange(option);
                }}
              >
                <PriorityMark priority={option} showLabel />
              </button>
            </li>
          );
        })}
      </ul>
    </Popover>
  );
}
