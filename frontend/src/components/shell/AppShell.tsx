import { useEffect, useState } from "react";
import { Outlet, useMatch } from "react-router";

import { todayISO } from "../../lib/dates";
import { isEditableTarget } from "../../lib/shortcuts";
import { cn } from "../../lib/cn";
import { useUi } from "../../stores/ui";
import { ProjectDialog } from "../capture/ProjectDialog";
import { QuickNoteSheet } from "../capture/QuickNoteSheet";
import { MeetingDialog } from "../capture/MeetingDialog";
import { TaskCreateDialog } from "../items/TaskEditor";
import { DayPanel } from "../home/DayPanel";
import { OfflineBanner } from "../ui/OfflineBanner";
import { Toasts } from "../ui/Toast";
import { BottomNav } from "./BottomNav";
import { CommandPalette } from "./CommandPalette";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell() {
  const editor = useMatch("/item/:itemId");
  const capture = useUi((state) => state.capture);
  const closeCapture = useUi((state) => state.closeCapture);
  const [todayPanel, setTodayPanel] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        const top = useUi.getState().overlays.at(-1);
        if (!top) return;
        event.preventDefault();
        top.close();
        return;
      }
      if (isEditableTarget(event.target)) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        useUi.getState().setPaletteOpen(true);
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      const key = event.key.toLowerCase();
      if (key === "c") {
        event.preventDefault();
        useUi.getState().openCapture({ type: "note", projectId: null });
      }
      if (key === "t") {
        event.preventDefault();
        useUi.getState().openCapture({ type: "task" });
      }
      if (key === "d") {
        event.preventDefault();
        setTodayPanel(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-dvh flex-col bg-canvas text-fg">
      <TopBar />
      <OfflineBanner />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main
          className={cn(
            "min-w-0 flex-1 overflow-y-auto px-4 py-5 md:px-8",
            editor ? "pb-8" : "pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-8",
          )}
        >
          <Outlet />
        </main>
      </div>
      {editor ? null : <BottomNav />}
      <Toasts />
      <CommandPalette />
      {capture?.type === "note" ? (
        <QuickNoteSheet projectId={capture.projectId} onClose={closeCapture} />
      ) : null}
      {capture?.type === "task" ? (
        <TaskCreateDialog dueOn={capture.dueOn ?? null} projectId={capture.projectId ?? null} onClose={closeCapture} />
      ) : null}
      {capture?.type === "meeting" ? (
        <MeetingDialog projectId={capture.projectId} onClose={closeCapture} />
      ) : null}
      {capture?.type === "project" ? (
        <ProjectDialog contextId={capture.contextId} onClose={closeCapture} />
      ) : null}
      {todayPanel ? <DayPanel day={todayISO()} onClose={() => setTodayPanel(false)} /> : null}
    </div>
  );
}
