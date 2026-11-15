import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

export function PageHeader({
  title,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 flex-1 truncate text-[20px] font-medium">{title}</h1>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}
