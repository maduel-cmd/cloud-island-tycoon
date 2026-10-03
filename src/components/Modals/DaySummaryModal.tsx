import { useGameStore } from "../../state/useGameStore";
import { useI18n } from "../../i18n/I18nContext";

/** End-of-day P&L — must dismiss before the night reset applies wages */
export function DaySummaryModal() {
  const { daySummary, gems, confirmDayEnd } = useGameStore();
  const { t, dir } = useI18n();
  if (!daySummary) return null;

  const profitBeforeWages = daySummary.revenue - daySummary.expenses;
  const cashAfter = daySummary.cashBeforeWages - daySummary.wages;
  const canSkip = gems >= 1 && daySummary.wages > 0;

  return (
    <div
      className="absolute inset-0 z-[70] grid place-items-center bg-black/75 p-4 backdrop-blur-[2px]"
      dir={dir}
      data-testid="day-summary-modal"
    >
      <div className="wow-frame w-full max-w-sm rounded-md p-5">
        <h2 className="wow-title text-center text-xl font-extrabold">
          {t("daySummaryTitle", { n: daySummary.day })}
        </h2>
        <p className="mt-1 text-center text-xs text-[color:var(--wow-muted)]">{t("daySummaryHint")}</p>

        <dl className="mt-4 space-y-2 text-sm">
          <Row label={t("dayRevenue")} value={`+₪${Math.floor(daySummary.revenue)}`} good />
          <Row label={t("dayExpenses")} value={`−₪${Math.floor(daySummary.expenses)}`} />
          <Row label={t("dayProfit")} value={`₪${Math.floor(profitBeforeWages)}`} good={profitBeforeWages >= 0} />
          <Row label={t("dayVisitors")} value={`${daySummary.visitors}`} />
          <Row label={t("nightWage")} value={`−₪${daySummary.wages}`} />
          <Row
            label={t("cashAfterWages")}
            value={`₪${Math.floor(cashAfter)}`}
            good={cashAfter >= 0}
          />
        </dl>

        <p className="mt-3 text-center text-[11px] text-[color:var(--wow-gold-dim)]">
          {t("gemSkipWageHint")}
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {canSkip ? (
            <button
              type="button"
              className="btn-primary w-full py-3"
              data-testid="day-skip-wage-gem"
              onClick={() => confirmDayEnd(true)}
            >
              {t("skipWageWithGem")}
            </button>
          ) : null}
          <button
            type="button"
            className={`w-full py-3 ${canSkip ? "btn-chip" : "btn-primary"}`}
            data-testid="day-pay-wages"
            onClick={() => confirmDayEnd(false)}
          >
            {daySummary.wages > 0 ? t("payNightWage", { n: daySummary.wages }) : t("continueMorning")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[color:var(--wow-border)]/40 pb-1.5">
      <dt className="text-[color:var(--wow-muted)]">{label}</dt>
      <dd
        className={`font-extrabold tabular-nums ${
          good === true
            ? "text-emerald-400"
            : good === false
              ? "text-red-400"
              : "text-[color:var(--wow-parchment)]"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
