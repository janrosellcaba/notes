import { useEffect, useRef, type ReactNode } from "react";

import { useOverlayLayer } from "../../lib/useOverlayLayer";

export function Popover({
  open,
  onClose,
  trigger,
  children,
  className = "left-0",
}: {
  open: boolean;
  onClose: () => void;
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useOverlayLayer(open, onClose);
  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open, onClose]);
  return (
    <div ref={ref} className="relative">
      {trigger}
      {open ? (
        <div
          className={`absolute z-20 mt-1 min-w-52 rounded-[10px] border border-border bg-elevated p-1 shadow-[var(--overlay-shadow)] ${className}`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
