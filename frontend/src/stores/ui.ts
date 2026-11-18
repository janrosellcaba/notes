import { create } from "zustand";

import { readBoardOrder, writeBoardOrder, type BoardStatus } from "../lib/board";
import { readLogoStyle, writeLogoStyle, type LogoStyle } from "../lib/logo";
import { readTaskFields, writeTaskFields, type TaskField, type TaskFieldVisibility } from "../lib/taskFields";
import { applyTheme, readTheme, THEME_KEY, type Theme } from "../lib/theme";

export type TasksView = "list" | "board";
export type EditorPreview = "edit" | "preview";
export type { LogoStyle };

export type CaptureRequest =
  | { type: "note"; projectId: string | null }
  | { type: "task"; dueOn?: string | null; projectId?: string | null }
  | { type: "meeting"; projectId: string | null }
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
  logoStyle: LogoStyle;
  boardOrder: BoardStatus[];
  taskFields: TaskFieldVisibility;
  tourStep: number | null;
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
  setLogoStyle: (style: LogoStyle) => void;
  setBoardOrder: (order: BoardStatus[]) => void;
  moveBoardColumn: (status: BoardStatus, direction: -1 | 1) => void;
  setTaskField: (field: TaskField, shown: boolean) => void;
  setTourStep: (step: number | null) => void;
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
  logoStyle: readLogoStyle(),
  boardOrder: readBoardOrder(),
  taskFields: readTaskFields(),
  tourStep: null,
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
  setLogoStyle: (logoStyle) => {
    writeLogoStyle(logoStyle);
    set({ logoStyle });
  },
  setBoardOrder: (boardOrder) => {
    writeBoardOrder(boardOrder);
    set({ boardOrder });
  },
  moveBoardColumn: (status, direction) => {
    const order = [...get().boardOrder];
    const index = order.indexOf(status);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= order.length) return;
    const swap = order[next];
    if (!swap) return;
    order[next] = status;
    order[index] = swap;
    writeBoardOrder(order);
    set({ boardOrder: order });
  },
  setTaskField: (field, shown) => {
    const taskFields = { ...get().taskFields, [field]: shown };
    writeTaskFields(taskFields);
    set({ taskFields });
  },
  setTourStep: (tourStep) => set({ tourStep }),
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
