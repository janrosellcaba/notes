import { useEffect, useRef } from "react";
import type { EditorView } from "@codemirror/view";

export function Editor({
  initial,
  onChange,
  onView,
}: {
  initial: string;
  onChange: (value: string) => void;
  onView: (view: EditorView) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const onViewRef = useRef(onView);
  onChangeRef.current = onChange;
  onViewRef.current = onView;

  useEffect(() => {
    const parent = host.current;
    if (!parent) return;
    let view: EditorView | null = null;
    let cancelled = false;
    void import("./codeMirror").then(({ mountEditor }) => {
      if (cancelled || !host.current) return;
      view = mountEditor(
        host.current,
        initial,
        (value) => onChangeRef.current(value),
        (next) => onViewRef.current(next),
      );
    });
    return () => {
      cancelled = true;
      view?.destroy();
    };
    // The document is captured when the editor mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={host} className="min-h-48 flex-1" />;
}
