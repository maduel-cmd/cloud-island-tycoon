import { useGameStore } from "../../state/useGameStore";
import { useI18n } from "../../i18n/I18nContext";

/** One top bar: resources, clock, speed, and the next-step line inside — park stays visible */
export function TopBar() {
  const {
    cash,
    gems,
    day,
    timeOfDay,
    satisfaction,
    paused,
    speed,
    setPaused,
    setSpeed,
    nightWageCost,
    ticketGateFee,
    setTicketGateFee,
    bootstrapClockHeld,
    gameOver,
    daySummary,
    hasOutboundPathFromGate,
    starterKit,
    attractions,
  } = useGameStore();
  const { t, locale, setLocale, locales, dir } = useI18n();

  const hour = Math.floor(timeOfDay);
  const minute = Math.floor((timeOfDay % 1) * 60);
  const wage = nightWageCost();
  const clockHeld = bootstrapClockHeld();

  let nextStep = t("nextStepPath");
  if (!hasOutboundPathFromGate()) {
    nextStep = t("nextStepPath");
  } else if (starterKit.attractionLeft > 0) {
    nextStep = t("nextStepCarousel");
  } else if (
    attractions.some((a) => a.defId === starterKit.attractionId) &&
    bootstrapClockHeld()
  ) {
    nextStep = t("nextStepConnect");
  } else if (starterKit.stallLeft > 0) {
    nextStep = t("nextStepStall");
  } else {
    nextStep = t("nextStepEarn");
  }

  return (
    <header
      className="pointer-events-none absolute inset-x-0 top-0 z-40 px-2 pt-[max(0.35rem,env(safe-area-inset-top))] sm:px-3 sm:pt-2"
      dir={dir}
    >
      <div className="pointer-events-auto cit-card flex flex-col gap-1 rounded px-2 py-1.5 sm:px-3 sm:py-2">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <div className="flex min-w-0 flex-col pe-1">
            <span className="cit-label">{t("cash")}</span>
            <span className="cit-cash">₪{Math.floor(cash).toLocaleString()}</span>
            <span className="cit-wage text-[10px] font-semibold tabular-nums">
              {t("nightWageShort", { n: wage })}
            </span>
          </div>

          <div className="flex min-w-0 flex-col">
            <span className="cit-label">{t("gems")}</span>
            <span className="cit-num text-[color:var(--cit-gem)]">{gems}</span>
          </div>

          <div className="flex min-w-0 flex-col">
            <span className="cit-label">{t("satisfaction")}</span>
            <span className="cit-num">{satisfaction}</span>
          </div>

          <div className="flex items-center gap-0.5 rounded border border-[color:var(--cit-border)] px-1 py-0.5">
            <button
              type="button"
              className="px-1 text-xs font-bold text-[color:var(--cit-text)]"
              aria-label={t("ticketDown")}
              onClick={() => setTicketGateFee(ticketGateFee - 1)}
            >
              −
            </button>
            <div className="flex flex-col items-center leading-none">
              <span className="cit-label">{t("ticketFee")}</span>
              <span className="cit-num text-[13px]">₪{ticketGateFee}</span>
            </div>
            <button
              type="button"
              className="px-1 text-xs font-bold text-[color:var(--cit-text)]"
              aria-label={t("ticketUp")}
              onClick={() => setTicketGateFee(ticketGateFee + 1)}
            >
              +
            </button>
          </div>

          <div className="ms-auto flex items-center gap-1.5">
            <div className="text-end">
              <div className="cit-label">
                {t("day")} {day}
              </div>
              <div className="cit-num text-[13px]">
                {clockHeld
                  ? t("clockHeld")
                  : `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`}
              </div>
            </div>

            <select
              className="rounded border border-[color:var(--cit-border)] bg-[color:var(--cit-card)] px-1 py-1 text-[10px] font-semibold text-[color:var(--cit-text)]"
              value={locale}
              onChange={(e) => setLocale(e.target.value as typeof locale)}
              aria-label={t("language")}
            >
              {locales.map((l) => (
                <option key={l.id} value={l.id} className="text-slate-800">
                  {l.label}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-0.5 border-s border-[color:var(--cit-border)] ps-1.5">
              <button type="button" className="btn-chip !px-2 !py-1 !text-xs" onClick={() => setPaused(!paused)}>
                {paused ? "▶" : "⏸"}
              </button>
              {([1, 2, 3] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`rounded border px-1.5 py-1 text-[10px] font-bold ${
                    speed === s
                      ? "border-[color:var(--cit-text)] bg-[color:var(--cit-card-2)] text-[color:var(--cit-text)]"
                      : "border-[color:var(--cit-border)] bg-[color:var(--cit-card)] text-[color:var(--cit-label)]"
                  }`}
                  onClick={() => setSpeed(s)}
                >
                  ×{s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!gameOver && !daySummary ? (
          <div
            className="border-t border-[color:var(--cit-border)] pt-1 text-[11px] font-semibold text-[color:var(--cit-text)] sm:text-xs"
            data-testid="next-step-hint"
          >
            {nextStep}
          </div>
        ) : null}
      </div>
    </header>
  );
}
