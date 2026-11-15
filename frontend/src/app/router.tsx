import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import { useQuery } from "@tanstack/react-query";

import { getMe } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { AppShell } from "../components/shell/AppShell";
import { CapturePage } from "../routes/CapturePage";
import { HomePage } from "../routes/HomePage";
import { LoginPage } from "../routes/LoginPage";

const ItemPage = lazy(() => import("../routes/ItemPage"));
import { ProjectDetailPage } from "../routes/ProjectDetailPage";
import { ProjectsPage } from "../routes/ProjectsPage";
import { SettingsPage } from "../routes/SettingsPage";
import { CalendarPage } from "../routes/CalendarPage";
import { GoPage } from "../routes/GoPage";
import { MeetingsPage } from "../routes/MeetingsPage";
import { NotesPage } from "../routes/NotesPage";
import { TasksPage } from "../routes/TasksPage";

function RequireAuth() {
  const location = useLocation();
  const me = useQuery({ queryKey: queryKeys.me, queryFn: getMe, retry: false });
  if (me.isPending) return <div className="min-h-dvh bg-canvas" />;
  if (me.isError) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Outlet />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/capture" element={<CapturePage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="inbox" element={<Navigate to="/" replace />} />
          <Route path="notes" element={<NotesPage />} />
          <Route path="meetings" element={<MeetingsPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
          <Route
            path="item/:itemId"
            element={
              <Suspense fallback={<div className="min-h-40" />}>
                <ItemPage />
              </Suspense>
            }
          />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="trash" element={<Navigate to="/" replace />} />
          <Route path="go/:title" element={<GoPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
