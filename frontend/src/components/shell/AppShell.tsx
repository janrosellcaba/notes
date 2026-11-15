import { useEffect } from "react";
import { Outlet, useMatch, useNavigate } from "react-router";

import { openDaily } from "../../lib/daily";
import { isEditableTarget } from "../../lib/shortcuts";
import { cn } from "../../lib/cn";
import { useUi } from "../../stores/ui";
import { ProjectDialog } from "../capture/ProjectDialog";
import { QuickNoteSheet } from "../capture/QuickNoteSheet";
import { QuickTaskBar } from "../capture/QuickTaskBar";
import { MeetingDialog } from "../capture/MeetingDialog";
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
  const navigate = useNavigate();

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
      if (key === "c") useUi.getState().openCapture({ type: "note", projectId: null });
      if (key === "t") useUi.getState().openCapture({ type: "task" });
      if (key === "d") {
        event.preventDefault();
        void openDaily().then((id) => {
          if (id) void navigate(`/item/${id}`);
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

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
      {capture?.type === "task" ? <QuickTaskBar onClose={closeCapture} /> : null}
      {capture?.type === "meeting" ? (
        <MeetingDialog projectId={capture.projectId} onClose={closeCapture} />
      ) : null}
      {capture?.type === "project" ? (
        <ProjectDialog contextId={capture.contextId} onClose={closeCapture} />
      ) : null}
    </div>
  );
}
