import type { EditorView } from "@codemirror/view";

import { useI18n, type MessageKey } from "../../lib/i18n";
import { applyFormat, FORMATS, type FormatId } from "./format";

function formatLabel(id: FormatId, t: (key: MessageKey) => string): string {
  if (id === "h1" || id === "h2") return id.toUpperCase();
  return t(`format.${id}` as MessageKey);
}

export function FormatToolbar({
  view,
  onTask,
}: {
  view: EditorView | null;
  onTask?: () => void;
}) {
  const { t } = useI18n();
  function run(id: FormatId) {
    if (!view) return;
    applyFormat(view, id);
  }

  return (
    <div className="sticky bottom-0 z-10 flex gap-1 overflow-x-auto border-t border-border-subtle bg-elevated px-2 py-1 md:static md:border-t-0 md:border-b">
      {FORMATS.map((format) => (
        <button
          key={format.id}
          type="button"
          className="min-h-11 shrink-0 rounded-[8px] px-3 text-[13px] text-fg-secondary hover:bg-interactive hover:text-fg"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => run(format.id)}
        >
          {formatLabel(format.id, t)}
        </button>
      ))}
      {onTask ? (
        <button
          type="button"
          className="min-h-11 shrink-0 rounded-[8px] px-3 text-[13px] text-fg-secondary hover:bg-interactive hover:text-fg md:hidden"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onTask}
        >
          {t("editor.task")}
        </button>
      ) : null}
    </div>
  );
}
