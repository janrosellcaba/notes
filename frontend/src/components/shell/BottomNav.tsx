import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import {
  CalendarDays,
  FileText,
  Folder,
  Home,
  ListTodo,
  Menu,
  Plus,
  Search,
  StickyNote,
  Trash2,
} from "lucide-react";

import { cn } from "../../lib/cn";
import { useI18n, type MessageKey } from "../../lib/i18n";
import { MOBILE_MORE, type NavId } from "../../lib/navOrder";
import { useUi } from "../../stores/ui";

const DESTINATIONS: Record<NavId, { to: string; label: MessageKey; icon: typeof Home; end: boolean }> = {
  home: { to: "/", label: "nav.home", icon: Home, end: true },
  tasks: { to: "/tasks", label: "nav.tasks", icon: ListTodo, end: false },
  notes: { to: "/notes", label: "nav.notes", icon: StickyNote, end: false },
  meetings: { to: "/meetings", label: "nav.meetings", icon: FileText, end: false },
  calendar: { to: "/calendar", label: "nav.calendar", icon: CalendarDays, end: false },
  projects: { to: "/projects", label: "nav.projects", icon: Folder, end: false },
  trash: { to: "/trash", label: "nav.trash", icon: Trash2, end: false },
};

export function BottomNav() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const openCapture = useUi((state) => state.openCapture);
  const setPaletteOpen = useUi((state) => state.setPaletteOpen);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    function onPointer(event: MouseEvent) {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [moreOpen]);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-elevated pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Primary"
    >
      <div className="grid grid-cols-5">
        {(["home", "tasks"] as const).map((id) => {
          const tab = DESTINATIONS[id];
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 text-[10px]",
                  isActive ? "text-fg" : "text-fg-muted",
                )
              }
            >
              <Icon size={16} />
              <span className="truncate px-0.5">{t(tab.label)}</span>
            </NavLink>
          );
        })}
        <button
          type="button"
          aria-label={t("nav.add")}
          className="flex min-h-11 flex-col items-center justify-center gap-0.5 text-[10px] text-fg"
          onClick={() => openCapture({ type: "task" })}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-fg text-canvas">
            <Plus size={16} />
          </span>
          <span>{t("nav.add")}</span>
        </button>
        <button
          type="button"
          aria-label={t("shortcut.search")}
          className="flex min-h-11 flex-col items-center justify-center gap-0.5 text-[10px] text-fg-muted"
          onClick={() => setPaletteOpen(true)}
        >
          <Search size={16} />
          <span>{t("nav.search")}</span>
        </button>
        <div ref={moreRef} className="relative">
          <button
            type="button"
            aria-label={t("nav.more")}
            aria-expanded={moreOpen}
            className={cn(
              "flex min-h-11 w-full flex-col items-center justify-center gap-0.5 text-[10px]",
              moreOpen ? "text-fg" : "text-fg-muted",
            )}
            onClick={() => setMoreOpen((open) => !open)}
          >
            <Menu size={16} />
            <span>{t("nav.more")}</span>
          </button>
          {moreOpen ? (
            <div className="absolute right-2 bottom-[calc(100%+0.5rem)] z-40 min-w-44 rounded-[10px] border border-border bg-elevated p-1 shadow-[var(--overlay-shadow)]">
              {MOBILE_MORE.map((id) => {
                const tab = DESTINATIONS[id];
                const Icon = tab.icon;
                return (
                  <button
                    key={id}
                    type="button"
                    className="flex min-h-9 w-full items-center gap-2 rounded-[8px] px-2 text-left text-[13px] text-fg-secondary hover:bg-interactive hover:text-fg"
                    onClick={() => {
                      setMoreOpen(false);
                      void navigate(tab.to);
                    }}
                  >
                    <Icon size={15} />
                    {t(tab.label)}
                  </button>
                );
              })}
              <button
                type="button"
                className="flex min-h-9 w-full items-center gap-2 rounded-[8px] px-2 text-left text-[13px] text-fg-secondary hover:bg-interactive hover:text-fg"
                onClick={() => {
                  setMoreOpen(false);
                  void navigate("/settings");
                }}
              >
                {t("nav.settings")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
