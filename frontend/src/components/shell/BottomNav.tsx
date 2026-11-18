import { NavLink } from "react-router";
import { CalendarDays, FileText, Folder, Home, ListTodo, StickyNote } from "lucide-react";
import { useState } from "react";

import { cn } from "../../lib/cn";
import { useI18n, type MessageKey } from "../../lib/i18n";
import { DEFAULT_NAV_ORDER, readNavOrder, type NavId } from "../../lib/navOrder";

const DESTINATIONS: Record<NavId, { to: string; label: MessageKey; icon: typeof Home; end: boolean }> = {
  home: { to: "/", label: "nav.home", icon: Home, end: true },
  tasks: { to: "/tasks", label: "nav.tasks", icon: ListTodo, end: false },
  notes: { to: "/notes", label: "nav.notes", icon: StickyNote, end: false },
  meetings: { to: "/meetings", label: "nav.meetings", icon: FileText, end: false },
  calendar: { to: "/calendar", label: "nav.calendar", icon: CalendarDays, end: false },
  projects: { to: "/projects", label: "nav.projects", icon: Folder, end: false },
};

export function BottomNav() {
  const { t } = useI18n();
  const [order] = useState<NavId[]>(() => readNavOrder());
  const tabs = (order.length ? order : DEFAULT_NAV_ORDER).map((id) => DESTINATIONS[id]);
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-elevated pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Primary"
    >
      <div className="grid grid-cols-6">
        {tabs.map((tab) => {
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
      </div>
    </nav>
  );
}
