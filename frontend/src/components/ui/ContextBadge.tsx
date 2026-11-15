import type { CSSProperties } from "react";

import { ContextMark } from "../shell/ContextMark";

export function ContextBadge({
  name,
  color,
  icon,
}: {
  name: string;
  color: string;
  icon?: string | null;
}) {
  const style = {
    "--ctx": color,
    color,
    background: "color-mix(in srgb, var(--ctx) 16%, transparent)",
    borderColor: "color-mix(in srgb, var(--ctx) 40%, transparent)",
  } as CSSProperties;
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-1.5 py-0.5 text-[13px]"
      style={style}
    >
      <ContextMark icon={icon ?? null} color={color} size={16} />
      <span className="truncate">{name}</span>
    </span>
  );
}
