import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";

import { searchItems } from "../../lib/api";
import { cn } from "../../lib/cn";
import { searchTokens } from "../../lib/dates";
import { queryKeys } from "../../lib/queryKeys";
import { useContexts } from "../../lib/queries";
import { useUi } from "../../stores/ui";
import { Modal } from "../ui/Modal";

type Row =
  | { kind: "action"; id: string; label: string; run: () => void }
  | { kind: "hit"; id: string; type: string; title: string; snippet: string; project: string | null };

export function CommandPalette() {
  const open = useUi((state) => state.paletteOpen);
  const setPaletteOpen = useUi((state) => state.setPaletteOpen);
  const openCapture = useUi((state) => state.openCapture);
  const setContextId = useUi((state) => state.setContextId);
  const contextId = useUi((state) => state.contextId);
  const contexts = useContexts();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [active, setActive] = useState(0);
  const tokens = searchTokens(debounced);
  const searchable = tokens.length > 0;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 150);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setActive(0);
  }, [debounced]);

  const search = useQuery({
    queryKey: queryKeys.search(debounced, contextId),
    queryFn: ({ signal }) => searchItems(debounced, contextId === "all" ? null : contextId, signal),
    enabled: open && searchable,
    retry: false,
  });

  const rows = useMemo<Row[]>(() => {
    const needle = query.trim().toLowerCase();
    const actions: Array<Extract<Row, { kind: "action" }>> = [
      { kind: "action", id: "note", label: "New note", run: () => openCapture({ type: "note", projectId: null }) },
      { kind: "action", id: "task", label: "New task", run: () => openCapture({ type: "task" }) },
      {
        kind: "action",
        id: "transcript",
        label: "Paste transcript",
        run: () => openCapture({ type: "transcript", projectId: null }),
      },
      ...(contexts.data?.contexts ?? []).map((context) => ({
        kind: "action" as const,
        id: context.id,
        label: `Switch to ${context.name}`,
        run: () => setContextId(context.id),
      })),
    ];
    const matched = needle ? actions.filter((row) => row.label.toLowerCase().includes(needle)) : actions;
    const hits: Row[] = searchable
      ? (search.data?.results ?? []).map((hit) => ({
          kind: "hit" as const,
          id: hit.id,
          type: hit.type,
          title: hit.title || "Untitled",
          snippet: hit.snippet,
          project: hit.project?.name ?? null,
        }))
      : [];
    return [...matched, ...hits];
  }, [contexts.data?.contexts, openCapture, query, search.data?.results, searchable, setContextId]);

  if (!open) return null;

  function close() {
    setPaletteOpen(false);
    setQuery("");
    setDebounced("");
  }

  function choose(row: Row) {
    if (row.kind === "action") row.run();
    else void navigate(`/item/${row.id}`);
    close();
  }

  const clamped = rows.length === 0 ? 0 : Math.min(active, rows.length - 1);

  return (
    <Modal title="Search" onClose={close}>
      <input
        autoFocus
        value={query}
        aria-label="Search"
        placeholder="Search"
        role="combobox"
        aria-expanded="true"
        aria-controls="command-palette-list"
        aria-activedescendant={rows[clamped] ? `palette-${rows[clamped].id}` : undefined}
        className="w-full border-b border-border-subtle bg-transparent px-4 py-3 text-[16px] outline-none"
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((index) => Math.min(index + 1, Math.max(rows.length - 1, 0)));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => Math.max(index - 1, 0));
          } else if (event.key === "Enter" && rows[clamped]) {
            event.preventDefault();
            choose(rows[clamped]);
          }
        }}
      />
      <ul id="command-palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-1">
        {rows.map((row, index) => (
          <li key={`${row.kind}-${row.id}`} id={`palette-${row.id}`} role="option" aria-selected={index === clamped}>
            <button
              type="button"
              className={cn(
                "flex min-h-11 w-full flex-col items-start justify-center rounded-[8px] px-3 py-2 text-left",
                index === clamped && "bg-interactive",
              )}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(row)}
            >
              {row.kind === "action" ? (
                <span>{row.label}</span>
              ) : (
                <>
                  <span className="flex w-full items-baseline gap-2">
                    <span className="font-mono text-[13px] text-fg-muted">{row.type}</span>
                    <span className="truncate">{row.title}</span>
                    {row.project ? <span className="ml-auto shrink-0 text-[13px] text-fg-muted">{row.project}</span> : null}
                  </span>
                  {row.snippet ? <span className="line-clamp-1 text-[13px] text-fg-secondary">{row.snippet}</span> : null}
                </>
              )}
            </button>
          </li>
        ))}
        {searchable && search.isFetching && rows.every((row) => row.kind === "action") ? (
          <li className="px-3 py-2 font-mono text-[13px] text-fg-muted">Searching…</li>
        ) : null}
        {searchable && !search.isFetching && search.data?.results.length === 0 && rows.every((row) => row.kind === "action") ? (
          <li className="px-3 py-2 text-fg-muted">No matches</li>
        ) : null}
      </ul>
    </Modal>
  );
}
