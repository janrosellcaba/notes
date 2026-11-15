import { useState } from "react";

import { useI18n, type MessageKey } from "../../lib/i18n";
import { useUi } from "../../stores/ui";
import { Popover } from "../ui/Popover";
import type { ColumnStatus } from "./columns";

export function MoveToMenu({
  status,
  onMove,
}: {
  status: ColumnStatus;
  onMove: (status: ColumnStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const order = useUi((state) => state.boardOrder);
  const { t } = useI18n();
  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      trigger={
        <button
          type="button"
          className="min-h-8 rounded-[8px] px-2 text-[13px] text-fg-secondary hover:bg-interactive"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setOpen((current) => !current)}
        >
          {t("board.move")}
        </button>
      }
    >
      <ul className="min-w-40 p-1">
        {order.map((column) => (
          <li key={column}>
            <button
              type="button"
              className="flex min-h-8 w-full items-center rounded-[8px] px-3 text-left text-[13px] hover:bg-interactive"
              aria-current={column === status}
              onClick={() => {
                setOpen(false);
                if (column !== status) onMove(column);
              }}
            >
              {t(`board.${column}` as MessageKey)}
            </button>
          </li>
        ))}
      </ul>
    </Popover>
  );
}
