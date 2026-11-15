import type { ButtonHTMLAttributes } from "react";

import { cn } from "../../lib/cn";

export function IconButton({
  label,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex min-h-11 min-w-11 items-center justify-center rounded-[8px] text-fg outline-none hover:bg-interactive focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg",
        className,
      )}
      {...props}
    />
  );
}
