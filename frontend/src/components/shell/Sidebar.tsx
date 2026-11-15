import { NavLink } from "react-router";
import { Folder, Home, Inbox, ListTodo, PanelLeftClose, PanelLeftOpen, Trash2 } from "lucide-react";

import { cn } from "../../lib/cn";
import { useHomeFeed, useProjectList } from "../../lib/queries";
import { useUi } from "../../stores/ui";

const DESTINATIONS = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/inbox", label: "Inbox", icon: Inbox, end: false },
  { to: "/projects", label: "Projects", icon: Folder, end: false },
  { to: "/tasks", label: "Tasks", icon: ListTodo, end: false },
  { to: "/trash", label: "Trash", icon: Trash2, end: false },
] as const;

export function Sidebar() {
  const collapsed = useUi((state) => state.sidebarCollapsed);
  const setCollapsed = useUi((state) => state.setSidebarCollapsed);
  const contextId = useUi((state) => state.contextId);
  const home = useHomeFeed();
  const projects = useProjectList(contextId);
  const shortcuts = (projects.data?.projects ?? []).slice(0, 8);
  const count = home.data?.inbox_count;

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-border bg-elevated md:flex",
        collapsed ? "w-14" : "w-60",
      )}
    >
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2" aria-label="Primary">
        {DESTINATIONS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              className={({ isActive }) =>
                cn(
                  "flex min-h-11 items-center gap-3 rounded-[8px] px-2",
                  collapsed && "justify-center px-0",
                  isActive ? "bg-interactive text-fg" : "text-fg-secondary hover:bg-interactive hover:text-fg",
                )
              }
            >
              <Icon size={18} />
              {collapsed ? null : <span className="truncate">{item.label}</span>}
              {!collapsed && item.label === "Inbox" && count !== undefined ? (
                <span className="ml-auto font-mono text-[13px] text-fg-muted">{count}</span>
              ) : null}
            </NavLink>
          );
        })}
        {shortcuts.length > 0 ? (
          <div className={cn("mt-4 flex flex-col gap-1", collapsed && "mt-2")}>
            {shortcuts.map((project) => (
              <NavLink
                key={project.id}
                to={`/projects/${project.id}`}
                title={project.name}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-11 items-center gap-3 rounded-[8px] px-2",
                    collapsed && "justify-center px-0",
                    isActive ? "bg-interactive text-fg" : "text-fg-secondary hover:bg-interactive hover:text-fg",
                  )
                }
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: project.color }} />
                {collapsed ? null : <span className="truncate">{project.name}</span>}
              </NavLink>
            ))}
          </div>
        ) : null}
      </nav>
      <button
        type="button"
        className="m-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] px-2 text-fg-secondary hover:bg-interactive hover:text-fg"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        {collapsed ? null : <span>Collapse</span>}
      </button>
    </aside>
  );
}
