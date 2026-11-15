import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { tags } from "@lezer/highlight";

const highlight = HighlightStyle.define([
  { tag: [tags.heading, tags.strong], color: "#fafafa", fontWeight: "650" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: [tags.keyword, tags.processingInstruction], color: "#a1a1aa" },
  { tag: [tags.string, tags.special(tags.string)], color: "#e4e4e7" },
  { tag: tags.comment, color: "#71717a" },
  { tag: tags.link, color: "#fafafa", textDecoration: "underline" },
  { tag: tags.monospace, fontFamily: '"JetBrains Mono", ui-monospace, monospace' },
]);

const theme = EditorView.theme({
  "&": { backgroundColor: "transparent", color: "#fafafa", height: "100%" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: '"Inter Variable", ui-sans-serif, system-ui, sans-serif', lineHeight: "1.6" },
  ".cm-content": { padding: "12px 0", caretColor: "#fafafa", fontSize: "16px" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#fafafa" },
  ".cm-gutters": { display: "none" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": { backgroundColor: "#27272a" },
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
