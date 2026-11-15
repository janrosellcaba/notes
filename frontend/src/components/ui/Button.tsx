import type { ButtonHTMLAttributes } from "react";

import { cn } from "../../lib/cn";

type Variant = "primary" | "secondary" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-fg text-canvas",
  secondary: "border border-border-strong bg-interactive text-fg",
  ghost: "text-fg hover:bg-interactive",
};

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] px-3 font-medium outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
