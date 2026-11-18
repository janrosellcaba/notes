import { NavLink } from "react-router";
import {
  CalendarDays,
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
import { DEFAULT_NAV_ORDER, type NavId } from "../../lib/navOrder";
import { useProjectList } from "../../lib/queries";
import { useUi } from "../../stores/ui";
import { ContextMark } from "./ContextMark";

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

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-border bg-elevated md:flex",
        collapsed ? "w-14" : "w-60",
      )}
    >
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2" aria-label="Primary">
        {DEFAULT_NAV_ORDER.map((id) => {
          const item = DESTINATIONS[id];
          const Icon = item.icon;
          return (
            <NavLink
              key={id}
              to={item.to}
              end={item.end}
              title={t(item.label)}
              className={({ isActive }) =>
                cn(
                  "flex min-h-9 items-center gap-3 rounded-[8px] px-2 text-[13px]",
                  collapsed && "justify-center px-0",
                  isActive ? "bg-interactive text-fg" : "text-fg-secondary hover:bg-interactive hover:text-fg",
                )
              }
            >
              <Icon size={16} />
              {collapsed ? null : <span className="truncate">{t(item.label)}</span>}
            </NavLink>
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
