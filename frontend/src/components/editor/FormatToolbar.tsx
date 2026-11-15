import type { EditorView } from "@codemirror/view";

import { applyFormat, FORMATS, type FormatId } from "./format";

export function FormatToolbar({
  view,
  onTask,
}: {
  view: EditorView | null;
  onTask?: () => void;
}) {
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
          {format.label}
        </button>
      ))}
      {onTask ? (
        <button
          type="button"
          className="min-h-11 shrink-0 rounded-[8px] px-3 text-[13px] text-fg-secondary hover:bg-interactive hover:text-fg md:hidden"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onTask}
        >
          Task
        </button>
      ) : null}
    </div>
  );
}
