import { useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";

import { listItems } from "../lib/api";
import { openDaily } from "../lib/daily";
import { relativeTime, todayLabel } from "../lib/dates";
import { queryKeys } from "../lib/queryKeys";
import { useI18n } from "../lib/i18n";
import { useUi } from "../stores/ui";
import { useHomeFeed } from "../lib/queries";
import { MonthCalendar } from "../components/home/MonthCalendar";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { TaskRow } from "../components/items/TaskRow";
import { FileText, ListTodo, PenLine } from "lucide-react";

export function HomePage() {
  const openCapture = useUi((state) => state.openCapture);
  const contextId = useUi((state) => state.contextId);
  const navigate = useNavigate();
  const { t } = useI18n();
  const recent = useQuery({
    queryKey: queryKeys.items({ limit: 12, context_id: contextId === "all" ? undefined : contextId }),
    queryFn: () => listItems({ limit: 12, context_id: contextId === "all" ? undefined : contextId }),
  });
  const recentNotes = (recent.data?.items ?? [])
    .filter((item) => item.type !== "task" && !item.daily_on)
    .slice(0, 5);
  const home = useHomeFeed();
  useEffect(() => {
    const idle = window.requestIdleCallback?.(() => {
      void import("../components/editor/NoteSurface");
      void import("../components/editor/codeMirror");
    });
    if (idle !== undefined) {
      return () => window.cancelIdleCallback(idle);
    }
    const timer = window.setTimeout(() => {
      void import("../components/editor/NoteSurface");
      void import("../components/editor/codeMirror");
    }, 400);
    return () => window.clearTimeout(timer);
  }, []);
  const tasks = home.data?.today_tasks ?? [];

  async function openToday() {
    const id = await openDaily();
    if (id) void navigate(`/item/${id}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
      <header>
        <h1 className="text-[20px]">{t("nav.home")}</h1>
        <button
          type="button"
          className="mt-1 text-[13px] text-fg-muted hover:text-fg"
          onClick={() => void openToday()}
        >
          {todayLabel()}
        </button>
      </header>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] text-fg-muted">{t("home.capture")}</h2>
          <Button variant="ghost" className="px-2" onClick={() => openCapture({ type: "project", contextId: null })}>
            {t("home.newProject")}
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            className="flex min-h-9 items-center gap-2 rounded-[8px] border border-border bg-elevated px-3 text-left text-[13px] hover:bg-interactive"
            onClick={() => openCapture({ type: "note", projectId: null })}
          >
            <PenLine size={16} />
            {t("home.note")}
          </button>
          <button
            type="button"
            className="flex min-h-9 items-center gap-2 rounded-[8px] border border-border bg-elevated px-3 text-left text-[13px] hover:bg-interactive"
            onClick={() => openCapture({ type: "task" })}
          >
            <ListTodo size={16} />
            {t("home.task")}
          </button>
          <button
            type="button"
            className="flex min-h-9 items-center gap-2 rounded-[8px] border border-border bg-elevated px-3 text-left text-[13px] hover:bg-interactive"
            onClick={() => openCapture({ type: "meeting", projectId: null })}
          >
            <FileText size={16} />
            {t("home.meeting")}
          </button>
        </div>
      </section>
      {recentNotes.length > 0 ? (
        <section>
          <h2 className="mb-2 text-[13px] text-fg-muted">{t("home.recent")}</h2>
          <ul>
            {recentNotes.map((item) => (
              <li key={item.id} className="border-b border-border-subtle">
                <Link to={`/item/${item.id}`} className="flex min-h-9 items-center gap-3 text-[14px]">
                  <span className="min-w-0 flex-1 truncate">{item.title || t("common.untitled")}</span>
                  <time className="shrink-0 font-mono text-[12px] text-fg-muted" dateTime={item.updated_at}>
                    {relativeTime(item.updated_at)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section>
        <h2 className="mb-2 text-[13px] text-fg-muted">{t("home.today")}</h2>
        {home.isPending ? <p className="font-mono text-[13px] text-fg-muted">{t("common.loading")}</p> : null}
        {home.isError ? <p className="text-fg-secondary">{t("home.loadError")}</p> : null}
        {tasks.length === 0 && !home.isPending ? <EmptyState>{t("home.emptyToday")}</EmptyState> : null}
        <ul>
          {tasks.map((item) => (
            <TaskRow key={item.id} item={item} />
          ))}
        </ul>
      </section>
      <MonthCalendar />
    </div>
  );
}
