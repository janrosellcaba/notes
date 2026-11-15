import { NavLink } from "react-router";
import { Folder, Home, Inbox, ListTodo, Trash2 } from "lucide-react";

import { cn } from "../../lib/cn";
import { useHomeFeed } from "../../lib/queries";

const TABS = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/inbox", label: "Inbox", icon: Inbox, end: false },
  { to: "/projects", label: "Projects", icon: Folder, end: false },
  { to: "/tasks", label: "Tasks", icon: ListTodo, end: false },
  { to: "/trash", label: "Trash", icon: Trash2, end: false },
] as const;

export function BottomNav() {
  const home = useHomeFeed();
  const count = home.data?.inbox_count;
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-elevated pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Primary"
    >
      <div className="grid grid-cols-5">
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
              <span className="relative">
                <Icon size={18} />
                {tab.label === "Inbox" && count ? (
                  <span className="absolute -top-1 -right-2 font-mono text-[10px]">{count}</span>
                ) : null}
              </span>
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
