import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { searchItems } from "../../lib/api";
import { openDaily } from "../../lib/daily";
import { useI18n } from "../../lib/i18n";
import { cn } from "../../lib/cn";
import { searchTokens } from "../../lib/dates";
import { queryKeys } from "../../lib/queryKeys";
import { useContexts } from "../../lib/queries";
import { useUi } from "../../stores/ui";
import { Kbd } from "../ui/Kbd";
import { Modal } from "../ui/Modal";
import { ContextMark } from "./ContextMark";

type Row =
  | { kind: "action"; id: string; label: string; icon: string | null; color: string | null; run: () => void }
  | { kind: "hit"; id: string; type: string; title: string; snippet: string; project: string | null };

export function CommandPalette() {
  const open = useUi((state) => state.paletteOpen);
  const setPaletteOpen = useUi((state) => state.setPaletteOpen);
  const openCapture = useUi((state) => state.openCapture);
  const setContextId = useUi((state) => state.setContextId);
  const contextId = useUi((state) => state.contextId);
  const contexts = useContexts();
  const navigate = useNavigate();
  const { t } = useI18n();
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
      { kind: "action", id: "note", label: t("search.newNote"), icon: null, color: null, run: () => openCapture({ type: "note", projectId: null }) },
      { kind: "action", id: "task", label: t("search.newTask"), icon: null, color: null, run: () => openCapture({ type: "task" }) },
      {
        kind: "action",
        id: "meeting",
        label: t("search.newMeeting"),
        icon: null,
        color: null,
        run: () => openCapture({ type: "meeting", projectId: null }),
      },
      {
        kind: "action",
        id: "daily",
        label: t("search.todayNote"),
        icon: null,
        color: null,
        run: () => {
          void openDaily().then((id) => {
            if (id) void navigate(`/item/${id}`);
          });
        },
      },
      ...(contexts.data?.contexts ?? []).map((context) => ({
        kind: "action" as const,
        id: context.id,
        label: t("search.switch", { name: context.name }),
        icon: context.icon,
        color: context.color,
        run: () => setContextId(context.id),
      })),
    ];
    const matched = needle ? actions.filter((row) => row.label.toLowerCase().includes(needle)) : actions;
    const hits: Row[] = searchable
      ? (search.data?.results ?? []).map((hit) => ({
          kind: "hit" as const,
          id: hit.id,
          type: hit.type,
          title: hit.title || t("common.untitled"),
          snippet: hit.snippet,
          project: hit.project?.name ?? null,
        }))
      : [];
    return [...matched, ...hits];
  }, [contexts.data?.contexts, navigate, openCapture, query, search.data?.results, searchable, setContextId, t]);

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

  const firstHit = rows.findIndex((row) => row.kind === "hit");

  return (
    <Modal title={t("shortcut.search")} onClose={close}>
      <div className="p-2">
        <div className="flex h-9 items-center gap-2 rounded-[8px] border border-border bg-canvas px-2.5 text-fg-muted">
          <Search size={14} />
          <input
            autoFocus
            value={query}
            aria-label={t("shortcut.search")}
            placeholder={t("shortcut.search")}
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-list"
            aria-activedescendant={rows[clamped] ? `palette-${rows[clamped].id}` : undefined}
            className="min-w-0 flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-fg-muted"
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
          <span className="rounded-[5px] border border-border-subtle px-1 py-px">
            <Kbd>K</Kbd>
          </span>
        </div>
      </div>
      <ul id="command-palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto px-2 pb-2">
        {rows.map((row, index) => (
          <li key={`${row.kind}-${row.id}`} id={`palette-${row.id}`} role="option" aria-selected={index === clamped}>
            {index === 0 && row.kind === "action" ? <PaletteHeading>{t("search.actions")}</PaletteHeading> : null}
            {index === firstHit ? <PaletteHeading>{t("search.notes")}</PaletteHeading> : null}
            <button
              type="button"
              className={cn(
                "flex min-h-9 w-full items-center gap-2 rounded-[8px] px-2 text-left text-[13px]",
                index === clamped && "bg-interactive",
              )}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(row)}
            >
              {row.kind === "action" ? (
                <>
                  {row.color ? <ContextMark icon={row.icon} color={row.color} size={18} /> : null}
                  <span>{row.label}</span>
                </>
              ) : (
                <span className="flex min-w-0 flex-1 flex-col py-1">
                  <span className="flex w-full items-baseline gap-2">
                    <span className="font-mono text-[12px] text-fg-muted">{row.type}</span>
                    <span className="truncate">{row.title}</span>
                    {row.project ? <span className="ml-auto shrink-0 text-[12px] text-fg-muted">{row.project}</span> : null}
                  </span>
                  {row.snippet ? <span className="line-clamp-1 text-[12px] text-fg-secondary">{row.snippet}</span> : null}
                </span>
              )}
            </button>
          </li>
        ))}
        {searchable && search.isFetching && rows.every((row) => row.kind === "action") ? (
          <li className="px-3 py-2 font-mono text-[13px] text-fg-muted">{t("search.searching")}</li>
        ) : null}
        {searchable && !search.isFetching && search.data?.results.length === 0 && rows.every((row) => row.kind === "action") ? (
          <li className="px-3 py-2 text-fg-muted">{t("search.none")}</li>
        ) : null}
      </ul>
    </Modal>
  );
}

function PaletteHeading({ children }: { children: string }) {
  return <p className="px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-fg-muted uppercase">{children}</p>;
}
