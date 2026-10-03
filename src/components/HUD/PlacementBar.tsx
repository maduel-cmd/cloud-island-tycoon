import { useGameStore } from "../../state/useGameStore";
import { useI18n } from "../../i18n/I18nContext";
import { getAttraction } from "../../data/attractions";
import { getStall } from "../../data/stalls";
import { getDecor } from "../../data/decor";

/** Compact placement strip — stays visible after the build sheet closes on phones */
export function PlacementBar() {
  const { buildMode, selectedBuildId, setBuildMode, cash } = useGameStore();
  const { t, dir, locale } = useI18n();
  if (buildMode === "none") return null;

  let label = t("build");
  if (buildMode === "path") label = t("paths");
  else if (buildMode === "bin") label = t("bins");
  else if (buildMode === "bench") label = t("benches");
  else if (buildMode === "demolish") label = t("demolish");
  else if (buildMode === "parking") label = t("addParking").split("·")[0]?.trim() ?? "Parking";
  else if (buildMode === "warehouse") label = t("warehouse");
  else if (buildMode === "decor" && selectedBuildId) {
    const d = getDecor(selectedBuildId as "statue" | "tree" | "bush" | "flower");
    label = locale === "he" ? d?.nameHe ?? t("decor") : d?.nameEn ?? t("decor");
  } else if (buildMode === "attraction" && selectedBuildId) {
    const a = getAttraction(selectedBuildId);
    label = locale === "he" ? a?.nameHe ?? t("attractions") : a?.nameEn ?? t("attractions");
  } else if (buildMode === "stall" && selectedBuildId) {
    const s = getStall(selectedBuildId);
    label = locale === "he" ? s?.nameHe ?? t("stalls") : s?.nameEn ?? t("stalls");
  }

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-[5.75rem] z-[49] flex justify-center px-2 sm:bottom-24"
      dir={dir}
      data-testid="placement-bar"
    >
      <div className="pointer-events-auto wow-frame flex max-w-[min(96vw,420px)] items-center gap-2 rounded-md px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-[color:var(--wow-gold)]">{label}</div>
          <div className="text-[10px] text-[color:var(--wow-muted)]">
            {buildMode === "path" ? t("pathHintShort") : t("tapToPlace")}
            {" · "}
            ₪{Math.floor(cash).toLocaleString()}
          </div>
        </div>
        <button type="button" className="btn-chip !px-3 !py-2 !text-xs" onClick={() => setBuildMode("none")}>
          {t("cancelPlace")}
        </button>
      </div>
    </div>
  );
}
