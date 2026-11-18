export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/** Modifier chord prefix shown in UI, e.g. "Ctrl+" or "⌘". */
export function modKeyLabel(): string {
  return /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl+";
}

/** Standalone modifier key label for a `<Kbd>` chip, e.g. "Ctrl" or "⌘". */
export function modKeyName(): string {
  return /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl";
}
