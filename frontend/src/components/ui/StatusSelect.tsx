import { useState } from "react";
import { Ban, Check, CheckCircle2, Circle, CircleDashed, CircleDot } from "lucide-react";

import { cn } from "../../lib/cn";
import { useI18n, type MessageKey } from "../../lib/i18n";
import { useUi } from "../../stores/ui";
import type { ItemStatus } from "../../types/api";
import { Popover } from "./Popover";

const ICONS: Record<ItemStatus, typeof Circle> = {
  backlog: CircleDashed,
  todo: Circle,
  in_progress: CircleDot,
  blocked: Ban,
  done: CheckCircle2,
};

const TONE: Record<ItemStatus, string> = {
  backlog: "text-fg-muted",
  todo: "text-fg-secondary",
  in_progress: "text-status-progress",
  blocked: "text-status-blocked",
  done: "text-status-done",
};

export function StatusSelect({
  status,
  onChange,
  showLabel = true,
  className,
}: {
  status: ItemStatus;
  onChange: (status: ItemStatus) => void;
  showLabel?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const order = useUi((state) => state.boardOrder);
  const { t } = useI18n();
  const current = status ?? "todo";
  const Icon = ICONS[current];

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      className="left-0"
      trigger={
        <button
          type="button"
          className={cn(
            "inline-flex min-h-8 items-center gap-1.5 rounded-[8px] px-1.5 text-[13px] hover:bg-interactive",
            TONE[current],
            className,
          )}
          aria-label={t("tasks.changeStatus")}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={(event) => {
            event.stopPropagation();
            setOpen((value) => !value);
          }}
        >
          <Icon size={16} strokeWidth={2} />
          {showLabel ? <span className="hidden sm:inline">{t(`board.${current}` as MessageKey)}</span> : null}
        </button>
      }
    >
      <ul className="min-w-44 p-1" role="listbox" aria-label={t("tasks.changeStatus")}>
        {order.map((option) => {
          const OptionIcon = ICONS[option];
          const active = option === current;
          return (
            <li key={option}>
              <button
                type="button"
                role="option"
                aria-selected={active}
                className={cn(
                  "flex min-h-9 w-full items-center gap-2 rounded-[8px] px-2.5 text-left text-[13px] hover:bg-interactive",
                  TONE[option],
                  active && "bg-interactive",
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(false);
                  if (option !== current) onChange(option);
                }}
              >
                <OptionIcon size={16} strokeWidth={2} />
                <span className="flex-1 text-fg">{t(`board.${option}` as MessageKey)}</span>
                {active ? <Check size={14} className="text-fg-muted" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </Popover>
  );
}
