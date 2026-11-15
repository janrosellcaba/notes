import { useEffect, useId, useRef } from "react";

import { useUi } from "../stores/ui";

export function useOverlayLayer(active: boolean, close: () => void): void {
  const id = useId();
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!active) return;
    useUi.getState().mountOverlay(id, () => closeRef.current());
    return () => useUi.getState().unmountOverlay(id);
  }, [active, id]);
}
