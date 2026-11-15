import { useState } from "react";

import { cn } from "../../lib/cn";
import { useContexts } from "../../lib/queries";
import { useUi } from "../../stores/ui";
import { Popover } from "../ui/Popover";

export function ContextSwitcher() {
  const [open, setOpen] = useState(false);
  const contextId = useUi((state) => state.contextId);
  const setContextId = useUi((state) => state.setContextId);
  const contexts = useContexts();
  const active = contexts.data?.contexts.find((context) => context.id === contextId);
  const label = active?.name ?? "All contexts";

  function choose(id: string) {
    setContextId(id);
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      trigger={
        <button
          type="button"
          className="inline-flex min-h-11 max-w-[46vw] items-center gap-2 rounded-full border border-border px-3 hover:bg-interactive md:max-w-xs"
          onClick={() => setOpen((value) => !value)}
        >
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: active?.color ?? "var(--color-fg-muted)" }}
          />
          <span className="truncate">{label}</span>
        </button>
      }
    >
      <ul className="min-w-52">
        <li>
          <button
            type="button"
            className={cn(
              "flex min-h-11 w-full items-center rounded-[8px] px-3 text-left hover:bg-interactive",
              contextId === "all" && "bg-interactive",
            )}
            onClick={() => choose("all")}
          >
            All contexts
          </button>
        </li>
        {(contexts.data?.contexts ?? []).map((context) => (
          <li key={context.id}>
            <button
              type="button"
              className={cn(
                "flex min-h-11 w-full items-center gap-2 rounded-[8px] px-3 text-left hover:bg-interactive",
                contextId === context.id && "bg-interactive",
              )}
              onClick={() => choose(context.id)}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: context.color }} />
              {context.name}
            </button>
          </li>
        ))}
      </ul>
    </Popover>
  );
}
