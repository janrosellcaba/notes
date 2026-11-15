import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { tags } from "@lezer/highlight";

const highlight = HighlightStyle.define([
  { tag: [tags.heading, tags.strong], color: "var(--color-fg)", fontWeight: "650" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: [tags.keyword, tags.processingInstruction], color: "var(--color-fg-secondary)" },
  { tag: [tags.string, tags.special(tags.string)], color: "var(--color-fg)" },
  { tag: tags.comment, color: "var(--color-fg-muted)" },
  { tag: tags.link, color: "var(--color-fg)", textDecoration: "underline" },
  { tag: tags.monospace, fontFamily: '"JetBrains Mono", ui-monospace, monospace' },
]);

const theme = EditorView.theme({
  "&": { backgroundColor: "transparent", color: "var(--color-fg)", height: "100%" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: '"Inter Variable", ui-sans-serif, system-ui, sans-serif', lineHeight: "1.6" },
  ".cm-content": { padding: "12px 0", caretColor: "var(--color-fg)", fontSize: "16px" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--color-fg)" },
  ".cm-gutters": { display: "none" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": { backgroundColor: "var(--color-border)" },
});

export function mountEditor(
  parent: HTMLElement,
  doc: string,
  onChange: (value: string) => void,
  onView: (view: EditorView) => void,
): EditorView {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        EditorView.lineWrapping,
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown(),
        syntaxHighlighting(highlight, { fallback: true }),
        theme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChange(update.state.doc.toString());
          onView(update.view);
        }),
      ],
    }),
  });
  onView(view);
  view.focus();
  return view;
}
