import { Plus } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "../../lib/cn";

/** Linear-style create control: quiet plus + label, no heavy chrome. */
export function NewButton({
  children,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-7 items-center gap-1 rounded-md px-2 text-[13px] font-medium text-fg-secondary outline-none",
        "hover:bg-interactive hover:text-fg",
        "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <Plus size={14} strokeWidth={2} className="shrink-0 opacity-70" />
      {children}
    </button>
  );
}
