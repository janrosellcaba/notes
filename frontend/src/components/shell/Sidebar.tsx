import { NavLink } from "react-router";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  FileText,
  Folder,
  Home,
  ListTodo,
  PanelLeftClose,
  PanelLeftOpen,
  StickyNote,
} from "lucide-react";

import { Button } from "../ui/Button";
import { cn } from "../../lib/cn";
import { useI18n, type MessageKey } from "../../lib/i18n";
import { DEFAULT_NAV_ORDER, moveNavItem, readNavOrder, writeNavOrder, type NavId } from "../../lib/navOrder";
import { useProjectList } from "../../lib/queries";
import { useUi } from "../../stores/ui";
import { ContextMark } from "./ContextMark";
import { useState } from "react";

const DESTINATIONS: Record<
  NavId,
  { to: string; label: MessageKey; icon: typeof Home; end: boolean }
> = {
  home: { to: "/", label: "nav.home", icon: Home, end: true },
  tasks: { to: "/tasks", label: "nav.tasks", icon: ListTodo, end: false },
  notes: { to: "/notes", label: "nav.notes", icon: StickyNote, end: false },
  meetings: { to: "/meetings", label: "nav.meetings", icon: FileText, end: false },
  calendar: { to: "/calendar", label: "nav.calendar", icon: CalendarDays, end: false },
  projects: { to: "/projects", label: "nav.projects", icon: Folder, end: false },
};

export function Sidebar() {
  const collapsed = useUi((state) => state.sidebarCollapsed);
  const setCollapsed = useUi((state) => state.setSidebarCollapsed);
  const contextId = useUi((state) => state.contextId);
  const projects = useProjectList(contextId);
  const shortcuts = projects.data?.projects ?? [];
  const { t } = useI18n();
  const [order, setOrder] = useState<NavId[]>(() => readNavOrder());

  function reorder(id: NavId, direction: -1 | 1) {
    setOrder((current) => {
      const next = moveNavItem(current, id, direction);
      writeNavOrder(next);
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-border bg-elevated md:flex",
        collapsed ? "w-14" : "w-60",
      )}
    >
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2" aria-label="Primary">
        {order.map((id, index) => {
          const item = DESTINATIONS[id] ?? DESTINATIONS[DEFAULT_NAV_ORDER[0]];
          const Icon = item.icon;
          return (
            <div key={id} className="group relative flex items-center gap-0.5">
              <NavLink
                to={item.to}
                end={item.end}
                title={t(item.label)}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-9 min-w-0 flex-1 items-center gap-3 rounded-[8px] px-2 text-[13px]",
                    collapsed && "justify-center px-0",
                    isActive ? "bg-interactive text-fg" : "text-fg-secondary hover:bg-interactive hover:text-fg",
                  )
                }
              >
                <Icon size={16} />
                {collapsed ? null : <span className="truncate">{t(item.label)}</span>}
              </NavLink>
              {collapsed ? null : (
                <div className="flex flex-col opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    aria-label={t("nav.moveUp")}
                    disabled={index === 0}
                    className="rounded p-0.5 text-fg-muted hover:bg-interactive hover:text-fg disabled:opacity-30"
                    onClick={() => reorder(id, -1)}
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    type="button"
                    aria-label={t("nav.moveDown")}
                    disabled={index === order.length - 1}
                    className="rounded p-0.5 text-fg-muted hover:bg-interactive hover:text-fg disabled:opacity-30"
                    onClick={() => reorder(id, 1)}
                  >
                    <ChevronDown size={12} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {shortcuts.length > 0 ? (
          <div className={cn("mt-4 flex flex-col gap-0.5", collapsed && "mt-3")}>
            {collapsed ? null : (
              <p className="px-2 pb-1 text-[11px] font-medium tracking-wide text-fg-muted uppercase">{t("nav.projectsSection")}</p>
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
      <Button variant="consult" className="m-2" onClick={() => setCollapsed(!collapsed)}>
        {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        {collapsed ? null : <span>{t("nav.collapse")}</span>}
      </Button>
    </aside>
  );
}
