import { useState } from "react";

import { useI18n } from "../../lib/i18n";
import { Popover } from "../ui/Popover";
import type { Project } from "../../types/api";

export function ProjectPill({
  projectId,
  projects,
  onChange,
}: {
  projectId: string | null;
  projects: Project[];
  onChange: (projectId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const current = projects.find((project) => project.id === projectId);
  const label = current ? current.name : t("inbox.title");
  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      trigger={
        <button
          type="button"
          className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-border px-3 text-[14px] hover:bg-interactive"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: current?.color ?? "#71717a" }} />
          <span className="truncate">{label}</span>
        </button>
      }
    >
      <ul className="max-h-64 overflow-y-auto">
        <li>
          <button
            type="button"
            className="flex min-h-11 w-full items-center rounded-[8px] px-3 text-left hover:bg-interactive"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            {t("inbox.title")}
          </button>
        </li>
        {projects.map((project) => (
          <li key={project.id}>
            <button
              type="button"
              className="flex min-h-11 w-full items-center gap-2 rounded-[8px] px-3 text-left hover:bg-interactive"
              onClick={() => {
                onChange(project.id);
                setOpen(false);
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: project.color }} />
              <span className="truncate">{project.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </Popover>
  );
}
