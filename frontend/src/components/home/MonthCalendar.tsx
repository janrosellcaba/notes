import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { listItems } from "../../lib/api";
import { openDaily } from "../../lib/daily";
import { useI18n } from "../../lib/i18n";
import { queryKeys } from "../../lib/queryKeys";
import { useUi } from "../../stores/ui";

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

export function MonthCalendar() {
  const { locale, t } = useI18n();
  const navigate = useNavigate();
  const contextId = useUi((state) => state.contextId);
  const [cursor, setCursor] = useState(() => new Date());
  const [opening, setOpening] = useState<string | null>(null);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const language = locale === "en" ? "en-GB" : locale;
  const filters = { limit: 200, context_id: contextId === "all" ? undefined : contextId };
  const tasks = useQuery({
    queryKey: queryKeys.items({ ...filters, type: "task" }),
    queryFn: () => listItems({ ...filters, type: "task", include_done: false }),
  });
  const meetings = useQuery({
    queryKey: queryKeys.items({ ...filters, type: "meeting" }),
    queryFn: () => listItems({ ...filters, type: "meeting" }),
  });
  const notes = useQuery({
    queryKey: queryKeys.items({ ...filters, type: "note" }),
    queryFn: () => listItems({ ...filters, type: "note" }),
  });
  const byDay = useMemo(() => {
    const map = new Map<string, Array<{ id: string; title: string }>>();
    function add(day: string | null | undefined, id: string, title: string) {
      if (!day) return;
      const list = map.get(day) ?? [];
      list.push({ id, title });
      map.set(day, list);
    }
    for (const item of tasks.data?.items ?? []) add(item.due_on, item.id, item.title);
    for (const item of meetings.data?.items ?? []) add(iso(new Date(item.created_at)), item.id, item.title);
    return map;
  }, [tasks.data, meetings.data]);
  const dailyDays = useMemo(() => {
    const set = new Set<string>();
    for (const item of notes.data?.items ?? []) {
      if (item.daily_on) set.add(item.daily_on);
    }
    return set;
  }, [notes.data]);
  const days = monthDays(year, month);
  const today = iso(new Date());
  const label = new Date(year, month, 1).toLocaleDateString(language, { month: "long", year: "numeric" });
  const weekday = new Date(2026, 10, 16);

  async function openDay(day: string) {
    if (opening) return;
    setOpening(day);
    try {
      const id = await openDaily(day);
      if (id) void navigate(`/item/${id}`);
    } finally {
      setOpening(null);
    }
  }

  return (
    <section className="rounded-[10px] border border-border bg-elevated">
      <header className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
        <h2 className="text-[14px] capitalize">{label}</h2>
        <div className="flex gap-1">
          <button type="button" className="flex h-8 w-8 items-center justify-center rounded-[8px] text-fg-secondary hover:bg-interactive" aria-label="Previous month" onClick={() => setCursor(new Date(year, month - 1, 1))}>
            <ChevronLeft size={16} />
          </button>
          <button type="button" className="flex h-8 w-8 items-center justify-center rounded-[8px] text-fg-secondary hover:bg-interactive" aria-label="Next month" onClick={() => setCursor(new Date(year, month + 1, 1))}>
            <ChevronRight size={16} />
          </button>
        </div>
      </header>
      <div className="grid grid-cols-7 px-2 py-2">
        {Array.from({ length: 7 }, (_, index) => (
          <p key={index} className="px-1 py-1 text-center text-[11px] text-fg-muted">
            {new Date(weekday.getFullYear(), weekday.getMonth(), weekday.getDate() + index).toLocaleDateString(language, { weekday: "narrow" })}
          </p>
        ))}
        {days.map((day) => {
          const key = iso(day);
          const items = byDay.get(key) ?? [];
          const outside = day.getMonth() !== month;
          const hasDaily = dailyDays.has(key);
          return (
            <div key={key} className={`min-h-16 rounded-[8px] px-1 py-1 ${key === today ? "bg-interactive" : ""}`}>
              <button
                type="button"
                className={`flex w-full items-center gap-1 text-left text-[12px] hover:text-fg ${outside ? "text-fg-muted" : "text-fg-secondary"}`}
                aria-label={t("home.openDaily", { day: key })}
                disabled={opening === key}
                onClick={() => void openDay(key)}
              >
                <span>{day.getDate()}</span>
                {hasDaily ? <span className="h-1.5 w-1.5 rounded-full bg-fg" aria-hidden /> : null}
              </button>
              {items.slice(0, 2).map((item) => (
                <Link key={item.id} to={`/item/${item.id}`} className="mt-0.5 block truncate text-[11px] text-fg hover:underline">
                  {item.title}
                </Link>
              ))}
              {items.length > 2 ? <p className="text-[11px] text-fg-muted">+{items.length - 2}</p> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
