import { useGameStore } from "../../state/useGameStore";
import { GEM_REPAIR_COST, STAFF_WAGE } from "../../managers/Simulation";
import { useI18n } from "../../i18n/I18nContext";

/** 22:00 close: income, wages, angry leavers; fire staff if cash cannot cover wages. */
export function DayCloseModal() {
  const store = useGameStore();
  const { t, dir } = useI18n();
  const report = store.dayClose;
  if (!report) return null;

  const wages = store.staff.length * STAFF_WAGE;
  const shortfall = Math.max(0, wages - store.cash);
  const canPay = store.cash >= wages;

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-[70] flex items-center justify-center bg-black/65 p-3"
      dir={dir}
      role="dialog"
      aria-modal="true"
      data-testid="day-close-modal"
    >
      <div className="wow-frame max-h-[90vh] w-full max-w-md overflow-y-auto rounded-md p-4 text-[color:var(--wow-parchment)]">
        <h2 className="wow-title mb-1 text-lg font-bold">{t("dayCloseTitle", { n: report.dayEnding })}</h2>
        <p className="mb-3 text-xs text-[color:var(--wow-muted)]">{t("dayCloseHint")}</p>

        <ul className="mb-4 space-y-2 text-sm">
          <li className="flex justify-between border-b border-[color:var(--wow-border)] pb-1">
            <span>{t("dayCloseIncome")}</span>
            <span className="font-bold text-[color:var(--wow-gold)]">₪{Math.round(report.income)}</span>
          </li>
          <li className="flex justify-between border-b border-[color:var(--wow-border)] pb-1">
            <span>{t("dayCloseWages")}</span>
            <span className="font-bold">₪{wages}</span>
          </li>
          <li className="flex justify-between border-b border-[color:var(--wow-border)] pb-1">
            <span>{t("dayCloseAngry")}</span>
            <span className="font-bold text-red-300">{report.angryLeft}</span>
          </li>
          <li className="flex justify-between pt-1">
            <span>{t("cash")}</span>
            <span className="font-bold">₪{Math.round(store.cash)}</span>
          </li>
        </ul>

        {!canPay && (
          <div className="mb-3 rounded border border-red-700/60 bg-red-950/40 p-2 text-xs" data-testid="day-close-fire">
            <p className="mb-2 font-semibold text-red-200">
              {t("dayCloseNeedFire", { n: shortfall })}
            </p>
            {store.staff.length === 0 ? (
              <p className="text-[color:var(--wow-muted)]">{t("dayCloseNoStaff")}</p>
            ) : (
              <ul className="space-y-1">
                {store.staff.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2">
                    <span>
                      {s.role === "janitor"
                        ? t("janitorTitle")
                        : s.role === "runner"
                          ? t("runnerTitle")
                          : t("mechanicTitle")}
                    </span>
                    <button
                      type="button"
                      className="btn-chip !text-[10px]"
                      data-testid={`fire-staff-${s.id}`}
                      onClick={() => store.fireStaff(s.id)}
                    >
                      {t("dayCloseFire")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <button
          type="button"
          className="btn-primary w-full"
          data-testid="day-close-confirm"
          disabled={!canPay}
          onClick={() => store.confirmDayClose()}
        >
          {canPay ? t("dayCloseConfirm", { n: wages }) : t("dayCloseBlocked")}
        </button>
        <p className="mt-2 text-[10px] text-[color:var(--wow-muted)]">
          {t("gemRepairHint", { n: GEM_REPAIR_COST })}
        </p>
      </div>
    </div>
  );
}
