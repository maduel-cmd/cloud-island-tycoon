import { useGameStore } from "../../state/useGameStore";
import { useI18n } from "../../i18n/I18nContext";

/** One-line next step under the top bar — not a new phone screen */
export function NextStepHint() {
  const store = useGameStore();
  const { t, dir } = useI18n();
  if (store.gameOver || store.daySummary) return null;

  let text = t("nextStepPath");
  if (!store.hasOutboundPathFromGate()) {
    text = t("nextStepPath");
  } else if (store.starterKit.attractionLeft > 0) {
    text = t("nextStepCarousel");
  } else if (
    store.attractions.some((a) => a.defId === store.starterKit.attractionId) &&
    store.bootstrapClockHeld()
  ) {
    text = t("nextStepConnect");
  } else if (store.starterKit.stallLeft > 0) {
    text = t("nextStepStall");
  } else {
    text = t("nextStepEarn");
  }

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-[3.6rem] z-[35] flex justify-center px-2 sm:top-[4.25rem]"
      dir={dir}
    >
      <div
        className="wow-frame max-w-[min(96vw,420px)] rounded-md px-3 py-1.5 text-center text-[11px] font-semibold text-[color:var(--wow-parchment)] sm:text-xs"
        data-testid="next-step-hint"
      >
        {text}
      </div>
    </div>
  );
}
