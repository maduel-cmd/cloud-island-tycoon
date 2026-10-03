import { useGameStore } from "../../state/useGameStore";
import { useI18n } from "../../i18n/I18nContext";

export function GameOverModal() {
  const { gameOver, gameOverReason, restartPark } = useGameStore();
  const { t, dir } = useI18n();
  if (!gameOver) return null;

  return (
    <div
      className="absolute inset-0 z-[75] grid place-items-center bg-black/80 p-4"
      dir={dir}
      data-testid="game-over-modal"
    >
      <div className="wow-frame w-full max-w-sm rounded-md p-5 text-center">
        <h2 className="wow-title text-2xl font-extrabold">{t("gameOverTitle")}</h2>
        <p className="mt-3 text-sm text-[color:var(--wow-parchment)]">
          {gameOverReason ?? t("gameOverFallback")}
        </p>
        <button type="button" className="btn-primary mt-5 w-full py-3" onClick={() => restartPark()}>
          {t("restartPark")}
        </button>
      </div>
    </div>
  );
}
