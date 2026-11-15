import { EditorSelection, type ChangeSpec } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

export const FORMATS = [
  { id: "h1", label: "H1" },
  { id: "h2", label: "H2" },
  { id: "bold", label: "Bold" },
  { id: "list", label: "List" },
  { id: "checkbox", label: "Checkbox" },
  { id: "code", label: "Code" },
] as const;

export type FormatId = (typeof FORMATS)[number]["id"];

function prefixLines(view: EditorView, range: { from: number; to: number }, prefix: string) {
  const start = view.state.doc.lineAt(range.from);
  const end = view.state.doc.lineAt(range.to);
  const changes: ChangeSpec[] = [];
  let shift = 0;
  for (let number = start.number; number <= end.number; number += 1) {
    const line = view.state.doc.line(number);
    if (line.text.startsWith(prefix)) continue;
    changes.push({ from: line.from, insert: prefix });
    if (line.from <= range.to) shift += prefix.length;
  }
  return {
    changes,
    range: EditorSelection.cursor(range.to + shift),
  };
}

export function applyFormat(view: EditorView, id: FormatId): void {
  view.dispatch(
    view.state.changeByRange((range) => {
      if (id === "bold") {
        const text = view.state.sliceDoc(range.from, range.to);
        if (!text) {
          return { changes: { from: range.from, insert: "****" }, range: EditorSelection.cursor(range.from + 2) };
        }
        return {
          changes: { from: range.from, to: range.to, insert: `**${text}**` },
          range: EditorSelection.range(range.from + 2, range.from + 2 + text.length),
        };
      }
      if (id === "code") {
        const text = view.state.sliceDoc(range.from, range.to);
        if (text.includes("\n")) {
          const insert = `\n\`\`\`\n${text}\n\`\`\`\n`;
          return {
            changes: { from: range.from, to: range.to, insert },
            range: EditorSelection.cursor(range.from + 5),
          };
        }
        if (!text) {
          return { changes: { from: range.from, insert: "``" }, range: EditorSelection.cursor(range.from + 1) };
        }
        return {
          changes: { from: range.from, to: range.to, insert: `\`${text}\`` },
          range: EditorSelection.range(range.from + 1, range.from + 1 + text.length),
        };
      }
      if (id === "checkbox") {
        const line = view.state.doc.lineAt(range.from);
        if (line.text.startsWith("- [ ] ")) return { range };
        return {
          changes: { from: line.from, insert: "- [ ] " },
          range: EditorSelection.cursor(range.to + "- [ ] ".length),
        };
      }
      const prefix = id === "h1" ? "# " : id === "h2" ? "## " : "- ";
      return prefixLines(view, range, prefix);
    }),
  );
  view.focus();
}

export function replaceSlash(view: EditorView, id: FormatId): void {
  const head = view.state.selection.main.head;
  const line = view.state.doc.lineAt(head);
  const match = /^\/\S*/.exec(line.text);
  if (match) {
    view.dispatch({ changes: { from: line.from, to: line.from + match[0].length, insert: "" } });
  }
  applyFormat(view, id);
}
