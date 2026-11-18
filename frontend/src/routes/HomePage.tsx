import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, ListTodo, PenLine } from "lucide-react";

import { DayPanel } from "../components/home/DayPanel";
import { MonthCalendar } from "../components/home/MonthCalendar";
import { TaskRow } from "../components/items/TaskRow";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { NewButton } from "../components/ui/NewButton";
import { PageHeader } from "../components/ui/PageHeader";
import { RowLink } from "../components/ui/RowLink";
import { listItems } from "../lib/api";
import { relativeTime, todayISO, todayLabel } from "../lib/dates";
import { useI18n } from "../lib/i18n";
import { queryKeys } from "../lib/queryKeys";
import { useHomeFeed } from "../lib/queries";
import { useUi } from "../stores/ui";

export function HomePage() {
  const openCapture = useUi((state) => state.openCapture);
  const contextId = useUi((state) => state.contextId);
  const { t } = useI18n();
  const [todayPanel, setTodayPanel] = useState(false);
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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
      <PageHeader title={t("nav.home")}>
        <Button
          variant="consult"
          className="mt-1 self-start px-0 hover:bg-transparent"
          onClick={() => setTodayPanel(true)}
        >
          {todayLabel()}
        </Button>
      </PageHeader>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] text-fg-muted">{t("home.capture")}</h2>
          <NewButton onClick={() => openCapture({ type: "project", contextId: null })}>
            {t("home.newProject")}
          </NewButton>
        </div>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
          <button
            type="button"
            className="flex min-h-10 items-center gap-2 rounded-md px-2.5 text-left text-[13px] text-fg-secondary hover:bg-interactive hover:text-fg"
            onClick={() => openCapture({ type: "note", projectId: null })}
          >
            <PenLine size={15} className="opacity-70" />
            {t("home.note")}
          </button>
          <button
            type="button"
            className="flex min-h-10 items-center gap-2 rounded-md px-2.5 text-left text-[13px] text-fg-secondary hover:bg-interactive hover:text-fg"
            onClick={() => openCapture({ type: "task" })}
          >
            <ListTodo size={15} className="opacity-70" />
            {t("home.task")}
          </button>
          <button
            type="button"
            className="flex min-h-10 items-center gap-2 rounded-md px-2.5 text-left text-[13px] text-fg-secondary hover:bg-interactive hover:text-fg"
            onClick={() => openCapture({ type: "meeting", projectId: null })}
          >
            <FileText size={15} className="opacity-70" />
            {t("home.meeting")}
          </button>
        </div>
      </section>
      {recentNotes.length > 0 ? (
        <section>
          <h2 className="mb-2 text-[13px] text-fg-muted">{t("home.recent")}</h2>
          <ul>
            {recentNotes.map((item) => (
              <li key={item.id}>
                <RowLink to={`/item/${item.id}`} title={item.title || t("common.untitled")} meta={relativeTime(item.updated_at)} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section>
        <h2 className="mb-2 text-[13px] text-fg-muted">{t("home.today")}</h2>
        {home.isPending ? <p className="font-mono text-[13px] text-fg-muted">{t("common.loading")}</p> : null}
        {home.isError ? <p className="text-fg-secondary">{t("home.loadError")}</p> : null}
        {tasks.length === 0 && !home.isPending ? (
          <EmptyState action={<NewButton onClick={() => openCapture({ type: "task", dueOn: todayISO() })}>{t("tasks.new")}</NewButton>}>
            {t("home.emptyToday")}
          </EmptyState>
        ) : null}
        <ul>
          {tasks.map((item) => (
            <TaskRow key={item.id} item={item} />
          ))}
        </ul>
      </section>
      <MonthCalendar />
      {todayPanel ? <DayPanel day={todayISO()} onClose={() => setTodayPanel(false)} /> : null}
    </div>
  );
}
