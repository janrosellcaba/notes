import { useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";

import { createItem, listItems } from "../lib/api";
import { filedContext } from "../lib/capture";
import { meetingTitle, relativeTime, todayLabel } from "../lib/dates";
import { queryKeys } from "../lib/queryKeys";
import { useI18n } from "../lib/i18n";
import { useUi } from "../stores/ui";
import { useHomeFeed } from "../lib/queries";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { PinnedCard } from "../components/items/PinnedCard";
import { TaskRow } from "../components/items/TaskRow";
import { ChevronDown, FileText, ListTodo, Mic, PenLine } from "lucide-react";

export function HomePage() {
  const navigate = useNavigate();
  const openCapture = useUi((state) => state.openCapture);
  const pushToast = useUi((state) => state.pushToast);
  const calendarOpen = useUi((state) => state.calendarSlotOpen);
  const setCalendarOpen = useUi((state) => state.setCalendarSlotOpen);
  const contextId = useUi((state) => state.contextId);
  const { t } = useI18n();
  const recent = useQuery({
    queryKey: queryKeys.items({ limit: 12, context_id: contextId === "all" ? undefined : contextId }),
    queryFn: () => listItems({ limit: 12, context_id: contextId === "all" ? undefined : contextId }),
  });
  const recentNotes = (recent.data?.items ?? []).filter((item) => item.type !== "task").slice(0, 5);
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
  async function openMeeting() {
    try {
      const meeting = await createItem({
        type: "meeting",
        title: meetingTitle(),
        context_id: filedContext(contextId, null),
      });
      void navigate(`/item/${meeting.id}`);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not create the meeting");
    }
  }

  const pinned = home.data?.pinned ?? [];
  const tasks = home.data?.today_tasks ?? [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
      <header>
        <h1 className="text-[20px]">{t("nav.home")}</h1>
        <p className="mt-1 text-[13px] text-fg-muted">{todayLabel()}</p>
      </header>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] text-fg-muted">{t("home.capture")}</h2>
          <Button variant="ghost" className="px-2" onClick={() => openCapture({ type: "project", contextId: null })}>
            {t("home.newProject")}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="flex min-h-9 items-center gap-2 rounded-[8px] border border-border-strong bg-interactive px-3 text-left text-[13px]"
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
            onClick={() => void openMeeting()}
          >
            <FileText size={16} />
            {t("home.meeting")}
          </button>
          <button
            type="button"
            className="flex min-h-9 items-center gap-2 rounded-[8px] border border-border bg-elevated px-3 text-left text-[13px] hover:bg-interactive"
            onClick={() => openCapture({ type: "transcript", projectId: null })}
          >
            <Mic size={16} />
            {t("home.transcript")}
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
      <section className="flex flex-col gap-6">
        <h2 className="text-[13px] text-fg-muted">{t("home.focus")}</h2>
        {home.isPending ? <p className="font-mono text-[13px] text-fg-muted">{t("common.loading")}</p> : null}
        {home.isError ? <p className="text-fg-secondary">{t("home.loadError")}</p> : null}
        {pinned.length > 0 ? (
          <div>
            <h3 className="mb-2 text-[14px]">{t("home.pinned")}</h3>
            <ul className="flex gap-3 overflow-x-auto md:grid md:grid-cols-3 md:overflow-visible">
              {pinned.map((item) => (
                <PinnedCard key={item.id} item={item} />
              ))}
            </ul>
          </div>
        ) : null}
        <div>
          <h3 className="mb-2 text-[14px]">{t("home.today")}</h3>
          {tasks.length === 0 ? <EmptyState>{t("home.emptyToday")}</EmptyState> : null}
          <ul>
            {tasks.map((item) => (
              <TaskRow key={item.id} item={item} />
            ))}
          </ul>
        </div>
        <section className="rounded-[10px] border border-border bg-elevated">
          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-between px-4 text-left"
            aria-expanded={calendarOpen}
            onClick={() => setCalendarOpen(!calendarOpen)}
          >
            <span>
              <span className="block">{t("home.upNext")}</span>
              <span className="block text-[13px] text-fg-muted">{t("home.calendar")}</span>
            </span>
            <ChevronDown size={16} className={calendarOpen ? "rotate-180" : undefined} />
          </button>
          {calendarOpen ? (
            <p className="border-t border-border-subtle px-4 py-3 text-fg-secondary">
              {t("home.calendarBody")}
            </p>
          ) : null}
        </section>
      </section>
    </div>
  );
}
