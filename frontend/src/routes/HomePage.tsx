import { useEffect } from "react";
import { useNavigate } from "react-router";

import { createItem, dailyNote } from "../lib/api";
import { meetingTitle, todayISO, todayLabel } from "../lib/dates";
import { useUi } from "../stores/ui";
import { useHomeFeed } from "../lib/queries";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { PinnedCard } from "../components/items/PinnedCard";
import { TaskRow } from "../components/items/TaskRow";
import { Calendar, ChevronDown, FileText, ListTodo, Mic, PenLine } from "lucide-react";

export function HomePage() {
  const navigate = useNavigate();
  const openCapture = useUi((state) => state.openCapture);
  const pushToast = useUi((state) => state.pushToast);
  const calendarOpen = useUi((state) => state.calendarSlotOpen);
  const setCalendarOpen = useUi((state) => state.setCalendarSlotOpen);
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
  async function openDaily() {
    try {
      const note = await dailyNote(todayISO());
      void navigate(`/item/${note.id}`);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not open today's note");
    }
  }

  async function openMeeting() {
    try {
      const meeting = await createItem({ type: "meeting", title: meetingTitle() });
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
        <h1 className="text-[20px]">Home</h1>
        <p className="mt-1 text-[13px] text-fg-muted">{todayLabel()}</p>
      </header>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] text-fg-muted">Capture</h2>
          <Button variant="ghost" className="px-2" onClick={() => openCapture({ type: "project", contextId: null })}>
            + New project
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          <button
            type="button"
            className="col-span-2 flex min-h-11 items-center gap-2 rounded-[10px] bg-fg px-3 text-left text-canvas md:col-span-1"
            onClick={() => openCapture({ type: "note", projectId: null })}
          >
            <PenLine size={16} />
            Quick note
          </button>
          <button
            type="button"
            className="flex min-h-11 items-center gap-2 rounded-[10px] border border-border bg-elevated px-3 text-left hover:bg-interactive"
            onClick={() => openCapture({ type: "task" })}
          >
            <ListTodo size={16} />
            Quick task
          </button>
          <button
            type="button"
            className="flex min-h-11 items-center gap-2 rounded-[10px] border border-border bg-elevated px-3 text-left hover:bg-interactive"
            onClick={() => void openDaily()}
          >
            <Calendar size={16} />
            Today’s note
          </button>
          <button
            type="button"
            className="flex min-h-11 items-center gap-2 rounded-[10px] border border-border bg-elevated px-3 text-left hover:bg-interactive"
            onClick={() => void openMeeting()}
          >
            <FileText size={16} />
            Meeting
          </button>
          <button
            type="button"
            className="col-span-2 flex min-h-11 items-center gap-2 rounded-[10px] border border-border bg-elevated px-3 text-left hover:bg-interactive md:col-span-1"
            onClick={() => openCapture({ type: "transcript", projectId: null })}
          >
            <Mic size={16} />
            Paste transcript
          </button>
        </div>
      </section>
      <section className="flex flex-col gap-6">
        <h2 className="text-[13px] text-fg-muted">Focus</h2>
        {home.isPending ? <p className="font-mono text-[13px] text-fg-muted">Loading…</p> : null}
        {home.isError ? <p className="text-fg-secondary">Could not load home.</p> : null}
        {pinned.length > 0 ? (
          <div>
            <h3 className="mb-2 text-[14px]">Pinned</h3>
            <ul className="flex gap-3 overflow-x-auto md:grid md:grid-cols-3 md:overflow-visible">
              {pinned.map((item) => (
                <PinnedCard key={item.id} item={item} />
              ))}
            </ul>
          </div>
        ) : null}
        <div>
          <h3 className="mb-2 text-[14px]">Today</h3>
          {tasks.length === 0 ? <EmptyState>Nothing due today</EmptyState> : null}
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
              <span className="block">Up next</span>
              <span className="block text-[13px] text-fg-muted">Calendar sync ready</span>
            </span>
            <ChevronDown size={16} className={calendarOpen ? "rotate-180" : undefined} />
          </button>
          {calendarOpen ? (
            <p className="border-t border-border-subtle px-4 py-3 text-fg-secondary">
              Calendar sync will list the next meetings here.
            </p>
          ) : null}
        </section>
      </section>
    </div>
  );
}
