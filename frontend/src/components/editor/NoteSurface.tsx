import { useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";

import { useUi } from "../../stores/ui";
import { Editor } from "./Editor";
import { FormatToolbar } from "./FormatToolbar";
import { MarkdownPreview } from "./MarkdownPreview";
import { replaceSlash } from "./format";
import { SelectionTaskButton } from "./SelectionTaskButton";
import { SlashMenu } from "./SlashMenu";

export default function NoteSurface({
  value,
  onChange,
  onCreateTask,
}: {
  value: string;
  onChange: (value: string) => void;
  onCreateTask?: (selection: string) => void;
}) {
  const preview = useUi((state) => state.editorPreview);
  const setPreview = useUi((state) => state.setEditorPreview);
  const [generation, setGeneration] = useState(0);
  const viewRef = useRef<EditorView | null>(null);
  const [view, setView] = useState<EditorView | null>(null);
  const [selection, setSelection] = useState("");
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const [slash, setSlash] = useState<{ filter: string; top: number; left: number } | null>(null);

  function sync(next: EditorView) {
    viewRef.current = next;
    setView(next);
    const range = next.state.selection.main;
    const text = range.empty ? "" : next.state.sliceDoc(range.from, range.to);
    setSelection(text);
    if (!range.empty && window.matchMedia("(min-width: 768px)").matches) {
      const coords = next.coordsAtPos(range.from);
      setAnchor(coords ? { top: coords.top, left: coords.left } : null);
    } else {
      setAnchor(null);
    }
    const line = next.state.doc.lineAt(range.head);
    const desktop = window.matchMedia("(min-width: 768px)").matches;
    if (desktop && /^\/\S*$/.test(line.text) && range.head === line.from + line.text.length) {
      const coords = next.coordsAtPos(line.from);
      setSlash({ filter: line.text.slice(1), top: coords?.bottom ?? 0, left: coords?.left ?? 0 });
    } else {
      setSlash(null);
    }
  }

  function createFromSelection(text: string) {
    if (!onCreateTask) return;
    if (!text.trim()) {
      onCreateTask("");
      return;
    }
    onCreateTask(text);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col-reverse md:flex-col">
      <div className="flex items-center justify-between gap-2 px-2">
        <FormatToolbar
          view={preview === "edit" ? view : null}
          onTask={
            onCreateTask
              ? () => {
                  const current = viewRef.current;
                  const text = current
                    ? current.state.sliceDoc(current.state.selection.main.from, current.state.selection.main.to)
                    : "";
                  createFromSelection(text);
                }
              : undefined
          }
        />
        <div className="flex shrink-0 gap-1 py-1">
          <button
            type="button"
            className={`min-h-11 rounded-[8px] px-3 text-[13px] ${preview === "edit" ? "bg-interactive text-fg" : "text-fg-muted"}`}
            onClick={() => {
              if (preview === "preview") setGeneration((current) => current + 1);
              setPreview("edit");
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className={`min-h-11 rounded-[8px] px-3 text-[13px] ${preview === "preview" ? "bg-interactive text-fg" : "text-fg-muted"}`}
            onClick={() => setPreview("preview")}
          >
            Preview
          </button>
        </div>
      </div>
      {preview === "preview" ? (
        <MarkdownPreview text={value} />
      ) : (
        <Editor key={generation} initial={value} onChange={onChange} onView={sync} />
      )}
      {slash && preview === "edit" ? (
        <SlashMenu
          filter={slash.filter}
          top={slash.top}
          left={slash.left}
          onPick={(id) => {
            const current = viewRef.current;
            if (!current) return;
            replaceSlash(current, id);
            setSlash(null);
          }}
        />
      ) : null}
      {anchor && selection && preview === "edit" && onCreateTask ? (
        <SelectionTaskButton top={anchor.top} left={anchor.left} onClick={() => createFromSelection(selection)} />
      ) : null}
    </div>
  );
}
