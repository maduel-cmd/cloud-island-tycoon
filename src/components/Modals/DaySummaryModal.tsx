import { useGameStore } from "../../state/useGameStore";
import { useI18n } from "../../i18n/I18nContext";

/** End-of-day P&L — only at 22:00; covers park until dismissed */
export function DaySummaryModal() {
  const { daySummary, gems, confirmDayEnd } = useGameStore();
  const { t, dir } = useI18n();
  if (!daySummary) return null;

  const profitBeforeWages = daySummary.revenue - daySummary.expenses;
  const cashAfter = daySummary.cashBeforeWages - daySummary.wages;
  const canSkip = gems >= 1 && daySummary.wages > 0;

  return (
    <div
      className="absolute inset-0 z-[70] grid place-items-center bg-black/75 p-4"
      dir={dir}
      data-testid="day-summary-modal"
    >
      <div className="cit-card w-full max-w-sm rounded p-5">
        <h2 className="text-center text-xl font-extrabold text-[color:var(--cit-text)]">
          {t("daySummaryTitle", { n: daySummary.day })}
        </h2>
        <p className="mt-1 text-center text-xs text-[color:var(--cit-label)]">{t("daySummaryHint")}</p>

        <dl className="mt-4 space-y-2 text-sm">
          <Row label={t("dayRevenue")} value={`+₪${Math.floor(daySummary.revenue)}`} tone="income" />
          <Row label={t("dayExpenses")} value={`−₪${Math.floor(daySummary.expenses)}`} />
          <Row
            label={t("dayProfit")}
            value={`₪${Math.floor(profitBeforeWages)}`}
            tone={profitBeforeWages >= 0 ? "income" : "wage"}
          />
          <Row label={t("dayVisitors")} value={`${daySummary.visitors}`} />
          <Row label={t("nightWage")} value={`−₪${daySummary.wages}`} tone="wage" />
          <Row
            label={t("cashAfterWages")}
            value={`₪${Math.floor(cashAfter)}`}
            tone={cashAfter >= 0 ? "income" : "wage"}
          />
        </dl>

        <p className="mt-3 text-center text-[11px] text-[color:var(--cit-label)]">{t("gemSkipWageHint")}</p>

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

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "income" | "wage";
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[color:var(--cit-border)] pb-1.5">
      <dt className="text-[color:var(--cit-label)]">{label}</dt>
      <dd
        className={`text-base font-extrabold tabular-nums ${
          tone === "income"
            ? "cit-income"
            : tone === "wage"
              ? "cit-wage"
              : "text-[color:var(--cit-text)]"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
