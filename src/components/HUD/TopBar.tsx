import { useGameStore } from "../../state/useGameStore";
import { useI18n } from "../../i18n/I18nContext";

/** HUD עליון בסגנון RPG / WoW-inspired — פאנל כהה, זהב, פסי משאבים */
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
    parkLevel,
    parkXp,
    nightWageCost,
    ticketGateFee,
    setTicketGateFee,
    bootstrapClockHeld,
  } = useGameStore();
  const { t, locale, setLocale, locales, dir } = useI18n();

  const hour = Math.floor(timeOfDay);
  const minute = Math.floor((timeOfDay % 1) * 60);
  const xpNeed = 100 + parkLevel * 80;
  const xpPct = Math.min(100, (parkXp / xpNeed) * 100);
  const nextLevel = parkLevel + 1;
  const zoneName = parkLevel <= 1 ? t("zoneStarter") : parkLevel <= 3 ? t("zoneGrowing") : t("zoneEpic");
  const wage = nightWageCost();
  const clockHeld = bootstrapClockHeld();

  return (
    <header
      className="pointer-events-none absolute inset-x-0 top-0 z-40 px-2 pt-[max(0.4rem,env(safe-area-inset-top))] sm:px-3 sm:pt-2"
      dir={dir}
    >
      <div className="pointer-events-auto wow-frame flex flex-wrap items-center gap-1.5 rounded-md px-2 py-1.5 sm:gap-3 sm:px-3 sm:py-2">
        <div className="flex min-w-0 flex-col pe-1 sm:pe-2">
          <div className="wow-title text-[10px] font-extrabold uppercase tracking-wide sm:text-[11px]">
            {t("brand")}
          </div>
          <div className="truncate text-[9px] font-semibold text-[color:var(--wow-muted)] sm:text-[10px]">
            {zoneName}
          </div>
        </div>

        <div className="wow-resource min-w-0">
          <div className="flex min-w-0 flex-col">
            <span className="text-[9px] font-bold uppercase text-[color:var(--wow-muted)]">{t("cash")}</span>
            <span className="text-xs font-extrabold tabular-nums text-[color:var(--wow-parchment)] sm:text-sm">
              ₪{Math.floor(cash).toLocaleString()}
            </span>
            <span className="text-[9px] font-semibold tabular-nums text-amber-200/90">
              {t("nightWageShort", { n: wage })}
            </span>
          </div>
        </div>

        <ResourceChip label={t("gems")} value={`${gems}`} barColor="#3b82f6" pct={Math.min(100, gems * 4)} />
        <ResourceChip
          label={t("satisfaction")}
          value={`${satisfaction}`}
          barColor="#2d8f3a"
          pct={satisfaction}
          extra={"★".repeat(Math.max(0, Math.min(5, Math.round(satisfaction / 20))))}
        />

        <div className="flex items-center gap-0.5 rounded border border-[color:var(--wow-border)] bg-[#120e0a]/90 px-1 py-0.5">
          <button
            type="button"
            className="px-1 text-[11px] font-bold text-[color:var(--wow-gold)]"
            aria-label={t("ticketDown")}
            onClick={() => setTicketGateFee(ticketGateFee - 1)}
          >
            −
          </button>
          <div className="flex flex-col items-center leading-none">
            <span className="text-[8px] font-bold uppercase text-[color:var(--wow-muted)]">{t("ticketFee")}</span>
            <span className="text-[11px] font-extrabold tabular-nums text-[color:var(--wow-parchment)]">
              ₪{ticketGateFee}
            </span>
          </div>
          <button
            type="button"
            className="px-1 text-[11px] font-bold text-[color:var(--wow-gold)]"
            aria-label={t("ticketUp")}
            onClick={() => setTicketGateFee(ticketGateFee + 1)}
          >
            +
          </button>
        </div>

        <div className="ms-auto flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2 sm:max-w-md">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="mb-0.5 flex justify-between text-[9px] font-bold text-[color:var(--wow-gold)] sm:text-[10px]">
              <span>
                {t("parkLevel")} {parkLevel}
              </span>
              <span className="text-[color:var(--wow-muted)]">→ {nextLevel}</span>
            </div>
            <div className="wow-bar-track">
              <div
                className="h-full bg-gradient-to-l from-[#a855f7] to-[#6b21a8]"
                style={{ width: `${xpPct}%` }}
              />
            </div>
          </div>

          <div className="text-[10px] font-bold tabular-nums text-[color:var(--wow-parchment)]">
            {t("day")} {day}
            {clockHeld ? (
              <span className="text-[color:var(--wow-gold-dim)]"> · {t("clockHeld")}</span>
            ) : (
              <span>
                {" "}
                · {String(hour).padStart(2, "0")}:{String(minute).padStart(2, "0")}
              </span>
            )}
          </div>

          <select
            className="rounded border border-[color:var(--wow-border)] bg-[#120e0a] px-1 py-1 text-[10px] font-semibold text-[color:var(--wow-parchment)]"
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

          <div className="flex items-center gap-0.5 border-s border-[color:var(--wow-border)] ps-1.5">
            <button type="button" className="btn-chip !px-2 !py-1 !text-xs" onClick={() => setPaused(!paused)}>
              {paused ? "▶" : "⏸"}
            </button>
            {([1, 2, 3] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={`rounded border px-1.5 py-1 text-[10px] font-bold ${
                  speed === s
                    ? "border-[color:var(--wow-gold)] bg-[#5a4018] text-[color:var(--wow-gold)]"
                    : "border-[color:var(--wow-border)] bg-[#1a1410] text-[color:var(--wow-muted)]"
                }`}
                onClick={() => setSpeed(s)}
              >
                ×{s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

function ResourceChip({
  label,
  value,
  barColor,
  pct,
  extra,
}: {
  label: string;
  value: string;
  barColor: string;
  pct: number;
  extra?: string;
}) {
  return (
    <div className="wow-resource min-w-[3.75rem] sm:min-w-[4.5rem]">
      <div className="flex min-w-0 flex-col">
        <div className="flex items-baseline gap-1">
          <span className="text-[9px] font-bold uppercase text-[color:var(--wow-muted)]">{label}</span>
          {extra ? <span className="text-[9px] text-amber-300">{extra}</span> : null}
        </div>
        <span className="text-xs font-extrabold tabular-nums text-[color:var(--wow-parchment)] sm:text-sm">{value}</span>
        <div className="wow-bar-track mt-0.5 w-12 sm:w-16">
          <div className="h-full" style={{ width: `${Math.max(4, Math.min(100, pct))}%`, background: barColor }} />
        </div>
      </div>
    </div>
  );
}
