import { MonthCalendar } from "../components/home/MonthCalendar";
import { PageHeader } from "../components/ui/PageHeader";
import { useI18n } from "../lib/i18n";

export function CalendarPage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <PageHeader title={t("calendar.title")}>
        <p className="text-[13px] text-fg-muted">{t("calendar.detail")}</p>
      </PageHeader>
      <MonthCalendar />
    </div>
  );
}
