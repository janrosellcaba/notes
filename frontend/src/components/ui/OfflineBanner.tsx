import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  if (online) return null;
  return (
    <p className="border-b border-border bg-elevated px-4 py-2 text-center font-mono text-[13px] text-fg-muted">
      Offline. Captures will not save until you reconnect.
    </p>
  );
}
