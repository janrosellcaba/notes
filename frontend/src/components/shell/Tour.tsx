import { useI18n, type MessageKey } from "../../lib/i18n";
import { useUi } from "../../stores/ui";
import { Button } from "../ui/Button";

const STEPS = [1, 2, 3, 4, 5] as const;

export function Tour() {
  const step = useUi((state) => state.tourStep);
  const setTourStep = useUi((state) => state.setTourStep);
  const { t } = useI18n();
  if (step === null) return null;
  const current = STEPS[step] ?? 1;
  const last = step >= STEPS.length - 1;
  return (
    <div className="fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 md:bottom-6">
      <div className="w-full max-w-md rounded-[10px] border border-border bg-elevated p-4 shadow-[var(--overlay-shadow)]">
        <p className="text-[12px] text-fg-muted">{t("tour.step", { n: String(step + 1), total: String(STEPS.length) })}</p>
        <h2 className="mt-1 text-[15px] font-medium">{t(`guide.${current}.title` as MessageKey)}</h2>
        <p className="mt-1 text-[13px] text-fg-secondary">{t(`guide.${current}.body` as MessageKey)}</p>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setTourStep(null)}>
            {t("tour.skip")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setTourStep(last ? null : step + 1)}
          >
            {last ? t("tour.done") : t("tour.next")}
          </Button>
        </div>
      </div>
    </div>
  );
}
