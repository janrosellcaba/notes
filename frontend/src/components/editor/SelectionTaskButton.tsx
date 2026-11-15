export function SelectionTaskButton({ top, left, onClick }: { top: number; left: number; onClick: () => void }) {
  return (
    <button
      type="button"
      className="fixed z-50 hidden min-h-11 -translate-y-full rounded-[8px] bg-fg px-3 text-canvas md:inline-flex md:items-center"
      style={{ top: Math.max(8, top - 8), left }}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      Create task
    </button>
  );
}
