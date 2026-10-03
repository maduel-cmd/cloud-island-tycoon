import { useGameStore } from "../../state/useGameStore";
import { useI18n } from "../../i18n/I18nContext";

/** Visible first-loop goals: path, ride, stocked stall (replaces fake quests→expand). */
export function LoopGoalsHud() {
  const store = useGameStore();
  const { t, dir } = useI18n();
  const goals = {
    path: false,
    ride: false,
    stockedStall: false,
  };
  // Recompute from live store fields so UI stays reactive without a dedicated method in the hook
  let pathTiles = 0;
  for (let y = 0; y < store.grid.height; y++) {
    for (let x = 0; x < store.grid.width; x++) {
      if (store.grid.get(x, y) === "path") pathTiles += 1;
    }
  }
  goals.path = pathTiles > 2;
  goals.ride = store.attractions.length > 0;
  goals.stockedStall = store.stalls.some((s) => s.stock > 0);

  const allDone = goals.path && goals.ride && goals.stockedStall;
  const clockHeld = store.bootstrapClockHeld();
  if (allDone && !clockHeld) return null;

  const rows: { id: keyof typeof goals; label: string; done: boolean }[] = [
    { id: "path", label: t("goalPath"), done: goals.path },
    { id: "ride", label: t("goalRide"), done: goals.ride },
    { id: "stockedStall", label: t("goalStockedStall"), done: goals.stockedStall },
  ];

  return (
    <div
      className="pointer-events-none absolute start-2 top-24 z-[45] max-w-[min(100%,16rem)] sm:start-3 sm:top-28"
      dir={dir}
      data-testid="loop-goals"
    >
      <div className="pointer-events-auto wow-frame rounded-md px-3 py-2">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[color:var(--wow-gold)]">
          {t("goalsTitle")}
        </div>
        <ul className="space-y-1">
          {rows.map((r) => (
            <li
              key={r.id}
              className={`flex items-start gap-1.5 text-[11px] leading-snug ${
                r.done ? "text-[color:var(--wow-gold-dim)] line-through opacity-80" : "text-[color:var(--wow-parchment)]"
              }`}
              data-testid={`goal-${r.id}`}
              data-done={r.done ? "1" : "0"}
            >
              <span aria-hidden>{r.done ? "✓" : "○"}</span>
              <span>{r.label}</span>
            </li>
          ))}
        </ul>
        {clockHeld && (
          <p className="mt-1.5 text-[10px] text-[color:var(--wow-muted)]">{t("goalsClockHint")}</p>
        )}
      </div>
    </div>
  );
}
