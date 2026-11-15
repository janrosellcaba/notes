import { create } from "zustand";

import { applyTheme, readTheme, THEME_KEY, type Theme } from "../lib/theme";

export type TasksView = "list" | "board";
export type EditorPreview = "edit" | "preview";

export type CaptureRequest =
  | { type: "note"; projectId: string | null }
  | { type: "task" }
  | { type: "transcript"; projectId: string | null }
  | { type: "project"; contextId: string | null };

type Overlay = { id: string; close: () => void };
type ToastLink = { href: string; label: string };
type ToastAction = { label: string; run: () => void };
type Toast = { id: string; message: string; link?: ToastLink; action?: ToastAction };

const KEYS = {
  contextId: "notes.contextId",
  sidebarCollapsed: "notes.sidebarCollapsed",
  tasksView: "notes.tasksView",
  editorPreview: "notes.editorPreview",
  calendarSlotOpen: "notes.calendarSlotOpen",
  theme: THEME_KEY,
} as const;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private browsing can reject storage. The in-memory value still applies.
  }
}

function readBool(key: string, fallback: boolean): boolean {
  const value = read(key);
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

type UiState = {
  contextId: string;
  sidebarCollapsed: boolean;
  tasksView: TasksView;
  editorPreview: EditorPreview;
  calendarSlotOpen: boolean;
  theme: Theme;
  paletteOpen: boolean;
  capture: CaptureRequest | null;
  overlays: Overlay[];
  toasts: Toast[];
  setContextId: (id: string) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTasksView: (view: TasksView) => void;
  setEditorPreview: (mode: EditorPreview) => void;
  setCalendarSlotOpen: (open: boolean) => void;
  setTheme: (theme: Theme) => void;
  setPaletteOpen: (open: boolean) => void;
  openCapture: (capture: CaptureRequest) => void;
  closeCapture: () => void;
  mountOverlay: (id: string, close: () => void) => void;
  unmountOverlay: (id: string) => void;
  closeTopOverlay: () => void;
  pushToast: (message: string, link?: ToastLink, action?: ToastAction) => void;
  dismissToast: (id: string) => void;
};

export const useUi = create<UiState>((set, get) => ({
  contextId: read(KEYS.contextId) || "all",
  sidebarCollapsed: readBool(KEYS.sidebarCollapsed, false),
  tasksView: read(KEYS.tasksView) === "board" ? "board" : "list",
  editorPreview: read(KEYS.editorPreview) === "preview" ? "preview" : "edit",
  calendarSlotOpen: readBool(KEYS.calendarSlotOpen, true),
  theme: readTheme(),
  paletteOpen: false,
  capture: null,
  overlays: [],
  toasts: [],
  setContextId: (contextId) => {
    write(KEYS.contextId, contextId);
    set({ contextId });
  },
  setSidebarCollapsed: (sidebarCollapsed) => {
    write(KEYS.sidebarCollapsed, String(sidebarCollapsed));
    set({ sidebarCollapsed });
  },
  setTasksView: (tasksView) => {
    write(KEYS.tasksView, tasksView);
    set({ tasksView });
  },
  setEditorPreview: (editorPreview) => {
    write(KEYS.editorPreview, editorPreview);
    set({ editorPreview });
  },
  setCalendarSlotOpen: (calendarSlotOpen) => {
    write(KEYS.calendarSlotOpen, String(calendarSlotOpen));
    set({ calendarSlotOpen });
  },
  setTheme: (theme) => {
    write(KEYS.theme, theme);
    applyTheme(theme);
    set({ theme });
  },
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  openCapture: (capture) => set({ capture, paletteOpen: false }),
  closeCapture: () => set({ capture: null }),
  mountOverlay: (id, close) =>
    set((state) => ({
      overlays: [...state.overlays.filter((entry) => entry.id !== id), { id, close }],
    })),
  unmountOverlay: (id) =>
    set((state) => ({ overlays: state.overlays.filter((entry) => entry.id !== id) })),
  closeTopOverlay: () => {
    get().overlays.at(-1)?.close();
  },
  pushToast: (message, link, action) =>
    set((state) => ({ toasts: [...state.toasts, { id: crypto.randomUUID(), message, link, action }] })),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));
