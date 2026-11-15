import { FORMATS, type FormatId } from "./format";

export function SlashMenu({
  filter,
  top,
  left,
  onPick,
}: {
  filter: string;
  top: number;
  left: number;
  onPick: (id: FormatId) => void;
}) {
  const needle = filter.toLowerCase();
  const options = FORMATS.filter((format) => format.label.toLowerCase().includes(needle) || format.id.includes(needle));
  if (options.length === 0) return null;
  return (
    <ul
      className="fixed z-50 hidden min-w-36 rounded-[10px] border border-border bg-elevated p-1 shadow-[var(--overlay-shadow)] md:block"
      style={{ top, left }}
    >
      {options.map((format) => (
        <li key={format.id}>
          <button
            type="button"
            className="flex min-h-11 w-full items-center rounded-[8px] px-3 text-left hover:bg-interactive"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPick(format.id)}
          >
            {format.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
