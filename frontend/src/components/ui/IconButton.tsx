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
        "inline-flex h-9 w-9 min-h-9 min-w-9 items-center justify-center rounded-[8px] text-fg-secondary outline-none hover:bg-interactive hover:text-fg focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
