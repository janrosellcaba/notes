import { useEffect } from "react";
import { Link } from "react-router";

import { useUi } from "../../stores/ui";

function ToastItem({ id, message, href, label }: { id: string; message: string; href?: string; label?: string }) {
  const dismiss = useUi((state) => state.dismissToast);
  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(id), 4000);
    return () => window.clearTimeout(timer);
  }, [dismiss, id]);
  return (
    <p className="pointer-events-auto rounded-[8px] border border-border bg-elevated px-3 py-2 text-[13px] text-fg">
      {message}
      {href && label ? (
        <Link to={href} className="ml-2 underline">
          {label}
        </Link>
      ) : null}
    </p>
  );
}

export function Toasts() {
  const toasts = useUi((state) => state.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} id={toast.id} message={toast.message} href={toast.link?.href} label={toast.link?.label} />
      ))}
    </div>
  );
}
