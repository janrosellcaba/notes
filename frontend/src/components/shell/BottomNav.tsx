import { NavLink } from "react-router";
import { CalendarDays, FileText, Folder, Home, ListTodo, StickyNote } from "lucide-react";

import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";

const TABS = [
  { to: "/", label: "nav.home", icon: Home, end: true },
  { to: "/notes", label: "nav.notes", icon: StickyNote, end: false },
  { to: "/meetings", label: "nav.meetings", icon: FileText, end: false },
  { to: "/tasks", label: "nav.tasks", icon: ListTodo, end: false },
  { to: "/calendar", label: "nav.calendar", icon: CalendarDays, end: false },
  { to: "/projects", label: "nav.projects", icon: Folder, end: false },
] as const;

export function BottomNav() {
  const { t } = useI18n();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-elevated pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Primary"
    >
      <div className="grid grid-cols-6">
        {TABS.map((tab) => {
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
