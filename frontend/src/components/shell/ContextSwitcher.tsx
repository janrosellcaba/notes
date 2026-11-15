import { useState } from "react";
import { Check, ChevronDown, Layers, Plus } from "lucide-react";

import { createContext, errorMessage } from "../../lib/api";
import { cn } from "../../lib/cn";
import { useContexts } from "../../lib/queries";
import { queryKeys } from "../../lib/queryKeys";
import { useUi } from "../../stores/ui";
import { Popover } from "../ui/Popover";
import { useQueryClient } from "@tanstack/react-query";
import { ContextMark } from "./ContextMark";

export function ContextSwitcher() {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const contextId = useUi((state) => state.contextId);
  const setContextId = useUi((state) => state.setContextId);
  const pushToast = useUi((state) => state.pushToast);
  const contexts = useContexts();
  const queryClient = useQueryClient();
  const rows = (contexts.data?.contexts ?? []).slice().sort((left, right) => left.sort_order - right.sort_order);
  const active = rows.find((context) => context.id === contextId);
  const label = active?.name ?? "All contexts";

  function choose(id: string) {
    setContextId(id);
    setOpen(false);
    setAdding(false);
  }

  async function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const created = await createContext({ name: trimmed });
      await queryClient.invalidateQueries({ queryKey: queryKeys.contexts });
      setContextId(created.id);
      setName("");
      setAdding(false);
      setOpen(false);
    } catch (error) {
      pushToast(errorMessage(error) || "Could not add the context");
    }
  }

  return (
    <Popover
      open={open}
      onClose={() => {
        setOpen(false);
        setAdding(false);
      }}
      trigger={
        <button
          type="button"
          className="inline-flex h-8 max-w-[46vw] items-center gap-2 rounded-[8px] border border-border bg-canvas px-1.5 pr-2 text-[13px] hover:bg-interactive md:max-w-xs"
          onClick={() => setOpen((value) => !value)}
        >
          {active ? (
            <ContextMark icon={active.icon} color={active.color} size={20} />
          ) : (
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-[6px] bg-interactive text-fg-secondary">
              <Layers size={12} />
            </span>
          )}
          <span className="truncate">{label}</span>
          <ChevronDown size={14} className="shrink-0 text-fg-muted" />
        </button>
      }
    >
      <ul className="min-w-56 p-1">
        <li>
          <button
            type="button"
            className={cn(
              "flex min-h-9 w-full items-center gap-2 rounded-[8px] px-2 text-left text-[13px] hover:bg-interactive",
              contextId === "all" && "bg-interactive",
            )}
            onClick={() => choose("all")}
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-[6px] bg-interactive text-fg-secondary">
              <Layers size={12} />
            </span>
            <span className="flex-1">All contexts</span>
            {contextId === "all" ? <Check size={14} className="text-fg-muted" /> : null}
          </button>
        </li>
        {rows.map((context) => (
          <li key={context.id}>
            <button
              type="button"
              className={cn(
                "flex min-h-9 w-full items-center gap-2 rounded-[8px] px-2 text-left text-[13px] hover:bg-interactive",
                contextId === context.id && "bg-interactive",
              )}
              onClick={() => choose(context.id)}
            >
              <ContextMark icon={context.icon} color={context.color} size={20} />
              <span className="flex-1 truncate">{context.name}</span>
              {contextId === context.id ? <Check size={14} className="text-fg-muted" /> : null}
            </button>
          </li>
        ))}
        <li className="mt-1 border-t border-border-subtle pt-1">
          {adding ? (
            <form
              className="flex items-center gap-1 px-1 py-1"
              onSubmit={(event) => {
                event.preventDefault();
                void add();
              }}
            >
              <input
                autoFocus
                value={name}
                aria-label="New context name"
                placeholder="Name"
                className="min-h-8 min-w-0 flex-1 rounded-[8px] border border-border bg-canvas px-2 text-[13px] outline-none focus:border-fg"
                onChange={(event) => setName(event.target.value)}
              />
              <button type="submit" className="min-h-8 rounded-[8px] bg-fg px-2 text-[13px] text-canvas">
                Add
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="flex min-h-9 w-full items-center gap-2 rounded-[8px] px-2 text-left text-[13px] text-fg-secondary hover:bg-interactive hover:text-fg"
              onClick={() => setAdding(true)}
            >
              <Plus size={14} />
              New context
            </button>
          )}
        </li>
      </ul>
    </Popover>
  );
}
