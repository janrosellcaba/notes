import { MonthCalendar } from "../components/home/MonthCalendar";
import { useI18n } from "../lib/i18n";

export function CalendarPage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <h1 className="text-[20px]">{t("calendar.title")}</h1>
      <p className="text-[13px] text-fg-muted">{t("calendar.detail")}</p>
      <MonthCalendar />
    </div>
  );
}
