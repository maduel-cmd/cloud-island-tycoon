import { BuildBankModal } from "../Panels/BuildBankModal";
import { PlacementBar } from "./PlacementBar";
import { useState } from "react";
import { useGameStore } from "../../state/useGameStore";
import { useI18n } from "../../i18n/I18nContext";
import { simulation } from "../../managers/Simulation";
import { GAME_STATIC_ASSETS } from "../../config/assets";

type FabId = "build" | "staff" | "logistics" | "quests" | "expand";

const FAB_ICONS: Record<FabId, string> = {
  build: GAME_STATIC_ASSETS.FAB_BUILD!.src,
  staff: GAME_STATIC_ASSETS.FAB_STAFF!.src,
  logistics: GAME_STATIC_ASSETS.FAB_LOGISTICS!.src,
  quests: GAME_STATIC_ASSETS.FAB_QUESTS!.src,
  expand: GAME_STATIC_ASSETS.FAB_EXPAND!.src,
};

/**
 * One bottom bar. While placing, the placement strip replaces this bar
 * (does not stack on top of it). Icons already include the gold frame.
 */
export function BottomFabBar() {
  const { t } = useI18n();
  const { buildMode } = useGameStore();
  const [bankOpen, setBankOpen] = useState(false);
  const placing = buildMode !== "none";

  const openPanel = (tab: "build" | "staff" | "logistics" | "expand") => {
    window.dispatchEvent(new CustomEvent("cit-open-panel", { detail: { tab } }));
  };

  const onQuests = () => {
    if (!simulation.hasOutboundPathFromGate()) {
      simulation.flashMessage(t("nextStepPath"));
    } else if (simulation.state.starterKit.attractionLeft > 0) {
      simulation.flashMessage(t("nextStepCarousel"));
    } else if (simulation.bootstrapClockHeld()) {
      simulation.flashMessage(t("nextStepConnect"));
    } else if (simulation.state.starterKit.stallLeft > 0) {
      simulation.flashMessage(t("nextStepStall"));
    } else {
      simulation.flashMessage(t("nextStepEarn"));
    }
  };

  const fabs: { id: FabId; label: string; action: () => void }[] = [
    { id: "build", label: t("build"), action: () => setBankOpen(true) },
    { id: "staff", label: t("staff"), action: () => openPanel("staff") },
    { id: "logistics", label: t("logistics"), action: () => openPanel("logistics") },
    { id: "quests", label: t("quests"), action: onQuests },
    { id: "expand", label: t("expand"), action: () => openPanel("expand") },
  ];

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[48] flex justify-center pb-[max(0.65rem,env(safe-area-inset-bottom))] sm:bottom-3">
        {placing ? (
          <PlacementBar />
        ) : (
          /* LTR so quests ≠ expand regardless of UI language */
          <div
            className="pointer-events-auto flex items-end gap-1.5 rounded-xl bg-[#0c1018]/55 px-2 py-1.5 backdrop-blur-[2px] sm:gap-2"
            dir="ltr"
          >
            {fabs.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={f.action}
                data-testid={f.id === "build" ? "fab-build" : f.id === "quests" ? "fab-quests" : undefined}
                className="flex flex-col items-center gap-0.5 border-0 bg-transparent p-0 transition hover:brightness-110 active:scale-95"
                title={f.label}
                aria-label={f.label}
              >
                <img
                  src={FAB_ICONS[f.id]}
                  alt=""
                  draggable={false}
                  className="h-12 w-12 object-contain sm:h-14 sm:w-14"
                />
                <span className="max-w-[3.5rem] truncate text-[9px] font-bold leading-none text-[color:var(--cit-text)] sm:text-[10px]">
                  {f.label}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <BuildBankModal open={bankOpen} onClose={() => setBankOpen(false)} />
    </>
  );
}
