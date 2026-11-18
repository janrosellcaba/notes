import { useEffect, useRef, useState } from "react";

import { Button } from "../ui/Button";
import { FIELD, FIELD_TEXTAREA } from "../../lib/field";
import { useI18n } from "../../lib/i18n";

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
  const { t } = useI18n();
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
      <Button
        variant="consult"
        className="h-auto min-h-11 w-full justify-between rounded-none px-4"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{t("editor.raw")}</span>
        <span className="font-mono text-[13px] text-fg-muted">{value.length}</span>
      </Button>
      {open ? (
        <div className="px-4 pb-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <input
              ref={findRef}
              value={query}
              aria-label={t("editor.find")}
              placeholder={t("editor.find")}
              className={`${FIELD} min-w-0 flex-1`}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Button variant="add" onClick={() => setEditing((current) => !current)}>
              {editing ? t("editor.done") : t("editor.editRaw")}
            </Button>
          </div>
          {editing ? (
            <textarea
              value={value}
              aria-label={t("editor.raw")}
              className={`${FIELD_TEXTAREA} min-h-48 font-mono leading-6`}
              onChange={(event) => onChange(event.target.value)}
            />
          ) : (
            <pre className="max-h-[40vh] overflow-auto whitespace-pre-wrap font-mono text-[13px] leading-6 text-fg-secondary">
              {visible.length === 0 ? t("editor.noLines") : visible.map((line, index) => <div key={index}>{highlight(line, query)}</div>)}
            </pre>
          )}
        </div>
      ) : null}
    </div>
  );
}
