import { NavLink } from "react-router";
import { Folder, Home, ListTodo } from "lucide-react";

import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";

const TABS = [
  { to: "/", label: "nav.home", icon: Home, end: true },
  { to: "/projects", label: "nav.projects", icon: Folder, end: false },
  { to: "/tasks", label: "nav.tasks", icon: ListTodo, end: false },
] as const;

export function BottomNav() {
  const { t } = useI18n();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-elevated pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Primary"
    >
      <div className="grid grid-cols-3">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 text-[11px]",
                  isActive ? "text-fg" : "text-fg-muted",
                )
              }
            >
              <Icon size={18} />
              <span>{t(tab.label)}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
