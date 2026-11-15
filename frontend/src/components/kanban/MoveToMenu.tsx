import { useState } from "react";

import { Popover } from "../ui/Popover";
import { COLUMNS, type ColumnStatus } from "./columns";

export function MoveToMenu({
  status,
  onMove,
}: {
  status: ColumnStatus;
  onMove: (status: ColumnStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      trigger={
        <button
          type="button"
          className="min-h-11 rounded-[8px] px-2 text-[13px] text-fg-secondary hover:bg-interactive"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setOpen((current) => !current)}
        >
          Move to…
        </button>
      }
    >
      <ul className="min-w-40 p-1">
        {COLUMNS.map((column) => (
          <li key={column.status}>
            <button
              type="button"
              className="flex min-h-11 w-full items-center rounded-[8px] px-3 text-left hover:bg-interactive"
              aria-current={column.status === status}
              onClick={() => {
                setOpen(false);
                if (column.status !== status) onMove(column.status);
              }}
            >
              {column.label}
            </button>
          </li>
        ))}
      </ul>
    </Popover>
  );
}
