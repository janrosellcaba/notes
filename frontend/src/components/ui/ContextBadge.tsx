import type { CSSProperties } from "react";

import { ContextMark } from "../shell/ContextMark";

function contrastInk(hex: string): string {
  const raw = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return "var(--color-fg)";
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  // Relative luminance — dark context colors need white labels.
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luma > 0.55 ? "#18181b" : "#fafafa";
}

export function ContextBadge({
  name,
  color,
  icon,
}: {
  name: string;
  color: string;
  icon?: string | null;
}) {
  const ink = contrastInk(color);
  const style = {
    "--ctx": color,
    color: ink,
    background: "color-mix(in srgb, var(--ctx) 28%, transparent)",
    borderColor: "color-mix(in srgb, var(--ctx) 45%, transparent)",
  } as CSSProperties;
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-1.5 py-0.5 text-[13px] font-medium"
      style={style}
    >
      <ContextMark icon={icon ?? null} color={color} size={16} />
      <span className="truncate">{name}</span>
    </span>
  );
}
