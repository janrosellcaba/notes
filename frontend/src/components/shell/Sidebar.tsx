import { NavLink } from "react-router";
import { Folder, Home, Inbox, Layers, ListTodo, PanelLeftClose, PanelLeftOpen, Trash2 } from "lucide-react";

import { cn } from "../../lib/cn";
import { useContexts, useHomeFeed, useProjectList } from "../../lib/queries";
import { useUi } from "../../stores/ui";
import { ContextMark } from "./ContextMark";

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
  const setContextId = useUi((state) => state.setContextId);
  const home = useHomeFeed();
  const contexts = useContexts();
  const projects = useProjectList(contextId);
  const shortcuts = projects.data?.projects ?? [];
  const rows = (contexts.data?.contexts ?? []).slice().sort((left, right) => left.sort_order - right.sort_order);
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
                  "flex min-h-9 items-center gap-3 rounded-[8px] px-2 text-[13px]",
                  collapsed && "justify-center px-0",
                  isActive ? "bg-interactive text-fg" : "text-fg-secondary hover:bg-interactive hover:text-fg",
                )
              }
            >
              <Icon size={16} />
              {collapsed ? null : <span className="truncate">{item.label}</span>}
              {!collapsed && item.label === "Inbox" && count !== undefined ? (
                <span className="ml-auto font-mono text-[12px] text-fg-muted">{count}</span>
              ) : null}
            </NavLink>
          );
        })}
        <div className={cn("mt-4 flex flex-col gap-0.5", collapsed && "mt-3")}>
          {collapsed ? null : (
            <p className="px-2 pb-1 text-[11px] font-medium tracking-wide text-fg-muted uppercase">Contexts</p>
          )}
          <button
            type="button"
            title="All contexts"
            className={cn(
              "flex min-h-9 items-center gap-3 rounded-[8px] px-2 text-left text-[13px]",
              collapsed && "justify-center px-0",
              contextId === "all" ? "bg-interactive text-fg" : "text-fg-secondary hover:bg-interactive hover:text-fg",
            )}
            onClick={() => setContextId("all")}
          >
            <span className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] bg-interactive text-fg-secondary">
              <Layers size={11} />
            </span>
            {collapsed ? null : <span className="truncate">All contexts</span>}
          </button>
          {rows.map((context) => (
            <button
              key={context.id}
              type="button"
              title={context.name}
              className={cn(
                "flex min-h-9 items-center gap-3 rounded-[8px] px-2 text-left text-[13px]",
                collapsed && "justify-center px-0",
                contextId === context.id ? "bg-interactive text-fg" : "text-fg-secondary hover:bg-interactive hover:text-fg",
              )}
              onClick={() => setContextId(context.id)}
            >
              <ContextMark icon={context.icon} color={context.color} size={18} />
              {collapsed ? null : <span className="truncate">{context.name}</span>}
            </button>
          ))}
        </div>
        {shortcuts.length > 0 ? (
          <div className={cn("mt-4 flex flex-col gap-0.5", collapsed && "mt-3")}>
            {collapsed ? null : (
              <p className="px-2 pb-1 text-[11px] font-medium tracking-wide text-fg-muted uppercase">Projects</p>
            )}
            {shortcuts.map((project) => (
              <NavLink
                key={project.id}
                to={`/projects/${project.id}`}
                title={`${project.name} · ${project.context.name}`}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-9 items-center gap-3 rounded-[8px] px-2 text-[13px]",
                    collapsed && "justify-center px-0",
                    isActive ? "bg-interactive text-fg" : "text-fg-secondary hover:bg-interactive hover:text-fg",
                  )
                }
              >
                <ContextMark icon={project.context.icon} color={project.context.color} size={18} />
                {collapsed ? null : <span className="truncate">{project.name}</span>}
              </NavLink>
            ))}
          </div>
        ) : null}
      </nav>
      <button
        type="button"
        className="m-2 inline-flex min-h-9 items-center justify-center gap-2 rounded-[8px] px-2 text-[13px] text-fg-secondary hover:bg-interactive hover:text-fg"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        {collapsed ? null : <span>Collapse</span>}
      </button>
    </aside>
  );
}
