import { useI18n } from "../../lib/i18n";
import type { ItemPriority } from "../../types/api";
import { cn } from "../../lib/cn";

const COLOR: Record<Exclude<ItemPriority, "none">, string> = {
  urgent: "var(--color-priority-urgent)",
  high: "var(--color-priority-high)",
  medium: "var(--color-priority-medium)",
  low: "var(--color-priority-low)",
};

/** Linear-style signal bars: none ··· / low ··| / medium ·|| / high ||| / urgent |||| */
const FILLED: Record<ItemPriority, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
};

export function PriorityMark({
  priority,
  showLabel = false,
  className,
}: {
  priority: ItemPriority | null;
  showLabel?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const value = priority ?? "none";
  const filled = FILLED[value];
  const color = value === "none" ? "var(--color-fg-muted)" : COLOR[value];
  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-1.5 text-[13px] text-fg-secondary", className)}
      title={t(`task.${value}`)}
      aria-label={t(`task.${value}`)}
    >
      <span className="inline-flex items-end gap-px" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => {
          const active = index < filled;
          return (
            <span
              key={index}
              className="w-[3px] rounded-[1px]"
              style={{
                height: 6 + index * 2,
                background: active ? color : "var(--color-border-strong)",
                opacity: active ? 1 : value === "none" ? 0.35 : 0.45,
              }}
            />
          );
        })}
      </span>
      {showLabel ? t(`task.${value}`) : null}
    </span>
  );
}
