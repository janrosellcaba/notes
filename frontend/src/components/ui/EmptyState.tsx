import type { ReactNode } from "react";

export function EmptyState({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[10px] border border-dashed border-border-subtle px-4 py-6">
      <p className="text-[13px] text-fg-secondary">{children}</p>
      {action}
    </div>
  );
}
