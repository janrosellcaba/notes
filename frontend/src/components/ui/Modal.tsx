import type { ReactNode } from "react";

import { cn } from "../../lib/cn";
import { useOverlayLayer } from "../../lib/useOverlayLayer";

export function Modal({
  title,
  onClose,
  children,
  className,
  align = "start",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  align?: "start" | "stretch";
}) {
  useOverlayLayer(true, onClose);
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex bg-black/50",
        align === "stretch"
          ? "items-stretch justify-stretch md:items-center md:justify-center md:p-6"
          : "items-start justify-center px-4 pt-[12vh]",
      )}
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "overlay-panel border border-border bg-elevated shadow-[var(--overlay-shadow)]",
          align === "stretch"
            ? "h-dvh w-full md:h-auto md:max-h-[85dvh] md:w-full md:max-w-[720px] md:rounded-[10px]"
            : "w-full max-w-[560px] rounded-[10px]",
          className,
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
