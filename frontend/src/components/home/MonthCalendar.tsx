import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { IconButton } from "../ui/IconButton";
import { SegmentedControl } from "../ui/SegmentedControl";
import { listItems, patchItem } from "../../lib/api";
import { todayISO } from "../../lib/dates";
import { useI18n } from "../../lib/i18n";
import { queryKeys } from "../../lib/queryKeys";
import { useUi } from "../../stores/ui";
import { DayPanel } from "./DayPanel";

function iso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function monthDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - ((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
}

function weekDays(anchor: Date): Date[] {
  const day = (anchor.getDay() + 6) % 7;
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - day);
  return Array.from({ length: 7 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
}

type CalItem = { id: string; title: string; kind: "task" | "meeting"; due_on?: string | null };

export function MonthCalendar({ projectId, titleQuery = "" }: { projectId?: string; titleQuery?: string }) {
  const { locale, t } = useI18n();
  const queryClient = useQueryClient();
  const pushToast = useUi((state) => state.pushToast);
  const contextId = useUi((state) => state.contextId);
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"month" | "week">("month");
  const [dragOver, setDragOver] = useState<string | null>(null);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const language = locale === "en" ? "en-GB" : locale;
  const filters = {
    limit: 200,
    ...(projectId
      ? { project_id: projectId }
      : { context_id: contextId === "all" ? undefined : contextId }),
  };
  const tasks = useQuery({
    queryKey: queryKeys.items({ ...filters, type: "task" }),
    queryFn: () => listItems({ ...filters, type: "task", include_done: false }),
  });
  const meetings = useQuery({
    queryKey: queryKeys.items({ ...filters, type: "meeting" }),
    queryFn: () => listItems({ ...filters, type: "meeting" }),
  });
  const byDay = useMemo(() => {
    const map = new Map<string, CalItem[]>();
    const q = titleQuery.trim().toLowerCase();
    function matches(title: string) {
      return !q || title.toLowerCase().includes(q);
    }
    function add(day: string | null | undefined, item: CalItem) {
      if (!day || !matches(item.title)) return;
      const list = map.get(day) ?? [];
      list.push(item);
      map.set(day, list);
    }
    for (const item of tasks.data?.items ?? []) {
      add(item.due_on, { id: item.id, title: item.title, kind: "task", due_on: item.due_on });
    }
    for (const item of meetings.data?.items ?? []) {
      add(iso(new Date(item.created_at)), { id: item.id, title: item.title, kind: "meeting" });
    }
    return map;
  }, [tasks.data, meetings.data, titleQuery]);
  const days = view === "month" ? monthDays(year, month) : weekDays(cursor);
  const today = todayISO();
  const label =
    view === "month"
      ? new Date(year, month, 1).toLocaleDateString(language, { month: "long", year: "numeric" })
      : `${iso(days[0]!)} → ${iso(days[6]!)}`;
  const weekday = new Date(2026, 10, 16);

  async function dropOnDay(day: string, itemId: string) {
    setDragOver(null);
    try {
      await patchItem(itemId, { due_on: day });
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
    } catch (error) {
      pushToast(error instanceof Error ? error.message : t("editor.unavailable"));
    }
  }

  function shift(delta: number) {
    if (view === "month") setCursor(new Date(year, month + delta, 1));
    else setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + delta * 7));
  }

  return (
    <>
      <section className="rounded-[10px] border border-border bg-elevated">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
          <h2 className="text-[14px] capitalize">{label}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              label={t("calendar.view")}
              value={view}
              onChange={setView}
              options={[
                { value: "month", label: t("calendar.month") },
                { value: "week", label: t("calendar.week") },
              ]}
            />
            <IconButton label={t("calendar.prev")} onClick={() => shift(-1)}>
              <ChevronLeft size={16} />
            </IconButton>
            <IconButton label={t("calendar.next")} onClick={() => shift(1)}>
              <ChevronRight size={16} />
            </IconButton>
          </div>
        </header>
        <div className={`grid grid-cols-7 px-2 py-2 ${view === "week" ? "min-h-[18rem]" : ""}`}>
          {Array.from({ length: 7 }, (_, index) => (
            <p key={index} className="px-1 py-1 text-center text-[11px] text-fg-muted">
              {new Date(weekday.getFullYear(), weekday.getMonth(), weekday.getDate() + index).toLocaleDateString(language, {
                weekday: "narrow",
              })}
            </p>
          ))}
          {days.map((day) => {
            const key = iso(day);
            const items = byDay.get(key) ?? [];
            const outside = view === "month" && day.getMonth() !== month;
            return (
              <div
                key={key}
                className={`min-h-16 rounded-[8px] px-1 py-1 ${key === today ? "bg-interactive" : ""} ${
                  dragOver === key ? "ring-1 ring-border-strong" : ""
                } ${view === "week" ? "min-h-40" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(key);
                }}
                onDragLeave={() => setDragOver((current) => (current === key ? null : current))}
                onDrop={(event) => {
                  event.preventDefault();
                  const itemId = event.dataTransfer.getData("text/task-id");
                  if (itemId) void dropOnDay(key, itemId);
                }}
              >
                <button
                  type="button"
                  className={`flex w-full items-center gap-1 text-left text-[12px] hover:text-fg ${outside ? "text-fg-muted" : "text-fg-secondary"}`}
                  aria-label={t("calendar.openDay", { day: key })}
                  onClick={() => setSelected(key)}
                >
                  <span>{day.getDate()}</span>
                  {items.length > 0 ? <span className="h-1.5 w-1.5 rounded-full bg-fg" aria-hidden /> : null}
                </button>
                {items.slice(0, view === "week" ? 8 : 2).map((item) =>
                  item.kind === "task" ? (
                    <button
                      key={item.id}
                      type="button"
                      draggable
                      className="mt-0.5 block w-full truncate text-left text-[11px] text-fg hover:underline"
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/task-id", item.id);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onClick={() => setSelected(key)}
                    >
                      {item.title}
                    </button>
                  ) : (
                    <Link key={item.id} to={`/item/${item.id}`} className="mt-0.5 block truncate text-[11px] text-fg hover:underline">
                      {item.title}
                    </Link>
                  ),
                )}
                {items.length > (view === "week" ? 8 : 2) ? (
                  <p className="text-[11px] text-fg-muted">+{items.length - (view === "week" ? 8 : 2)}</p>
                ) : null}
              </div>
            );
          })}
        </div>
        <p className="border-t border-border-subtle px-4 py-2 text-[12px] text-fg-muted">{t("calendar.dragHint")}</p>
      </section>
      {selected ? <DayPanel day={selected} projectId={projectId} onClose={() => setSelected(null)} /> : null}
    </>
  );
}
