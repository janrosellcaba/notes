import { cn } from "../../lib/cn";

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
};

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("inline-flex rounded-[8px] border border-border bg-canvas p-1", className)}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={cn(
              "min-h-8 rounded-[6px] px-3 text-[13px] font-medium outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg",
              selected ? "bg-interactive text-fg" : "text-fg-muted hover:text-fg",
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
