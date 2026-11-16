import type { ButtonHTMLAttributes } from "react";

import { cn } from "../../lib/cn";

type Intent = "add" | "consult" | "go";
type LegacyVariant = "primary" | "secondary" | "ghost";
type Variant = Intent | LegacyVariant;
type Tone = "default" | "danger";

const intents: Record<Intent, string> = {
  add: "border border-transparent bg-transparent text-fg-secondary hover:bg-interactive hover:text-fg",
  consult: "text-fg-secondary hover:bg-interactive hover:text-fg",
  go: "bg-fg text-canvas",
};

const legacy: Record<LegacyVariant, Intent> = {
  primary: "go",
  secondary: "add",
  ghost: "consult",
};

function resolveIntent(variant: Variant): Intent {
  if (variant === "add" || variant === "consult" || variant === "go") return variant;
  return legacy[variant];
}

export function Button({
  variant = "go",
  tone = "default",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; tone?: Tone }) {
  const intent = resolveIntent(variant);
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[8px] px-3 text-[13px] font-medium outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:opacity-50",
        intents[intent],
        tone === "danger" && intent === "go" && "bg-status-blocked text-canvas hover:opacity-90",
        tone === "danger" && intent === "consult" && "text-status-blocked hover:bg-interactive hover:text-status-blocked",
        className,
      )}
      {...props}
    />
  );
}
