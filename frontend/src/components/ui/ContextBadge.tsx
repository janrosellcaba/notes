import type { CSSProperties } from "react";

export function ContextBadge({ name, color }: { name: string; color: string }) {
  const style = {
    "--ctx": color,
    color,
    background: "color-mix(in srgb, var(--ctx) 16%, transparent)",
    borderColor: "color-mix(in srgb, var(--ctx) 40%, transparent)",
  } as CSSProperties;
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-2 py-0.5 text-[13px]"
      style={style}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="truncate">{name}</span>
    </span>
  );
}
