import { modKeyLabel } from "../../lib/shortcuts";

export function Kbd({ children }: { children: string }) {
  return <kbd className="font-mono text-[13px] text-fg-muted">{modKeyLabel()}{children}</kbd>;
}
