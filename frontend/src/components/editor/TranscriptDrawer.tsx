import { useEffect, useRef, useState } from "react";

function highlight(line: string, query: string) {
  if (!query) return line;
  const expression = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
  return line.split(expression).map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={`${index}-${part}`} className="bg-interactive text-fg">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export function TranscriptDrawer({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const findRef = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    function onKey(event: KeyboardEvent) {
      if (!open || !node?.contains(event.target as Node)) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        event.stopPropagation();
        findRef.current?.focus();
      }
    }
    node.addEventListener("keydown", onKey);
    return () => node.removeEventListener("keydown", onKey);
  }, [open]);

  const lines = value.split("\n");
  const visible = query ? lines.filter((line) => line.toLowerCase().includes(query.toLowerCase())) : lines;

  return (
    <div ref={root} className="border-t border-border-subtle">
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between px-4 text-left"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>Raw transcript</span>
        <span className="font-mono text-[13px] text-fg-muted">{value.length}</span>
      </button>
      {open ? (
        <div className="px-4 pb-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <input
              ref={findRef}
              value={query}
              aria-label="Find in transcript"
              placeholder="Find"
              className="min-h-11 min-w-0 flex-1 rounded-[8px] border border-border bg-canvas px-3 text-[16px] outline-none focus:border-fg"
              onChange={(event) => setQuery(event.target.value)}
            />
            <button
              type="button"
              className="min-h-11 rounded-[8px] border border-border px-3"
              onClick={() => setEditing((current) => !current)}
            >
              {editing ? "Done" : "Edit raw"}
            </button>
          </div>
          {editing ? (
            <textarea
              value={value}
              aria-label="Raw transcript"
              className="min-h-48 w-full resize-y rounded-[8px] border border-border bg-canvas p-3 font-mono text-[13px] leading-6 outline-none focus:border-fg"
              onChange={(event) => onChange(event.target.value)}
            />
          ) : (
            <pre className="max-h-[40vh] overflow-auto whitespace-pre-wrap font-mono text-[13px] leading-6 text-fg-secondary">
              {visible.length === 0 ? "No matching lines" : visible.map((line, index) => <div key={index}>{highlight(line, query)}</div>)}
            </pre>
          )}
        </div>
      ) : null}
    </div>
  );
}
