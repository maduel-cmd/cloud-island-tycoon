import { BuildBankModal } from "../Panels/BuildBankModal";
import { useState } from "react";
import { useI18n } from "../../i18n/I18nContext";
import { simulation } from "../../managers/Simulation";

type FabId = "build" | "staff" | "logistics" | "quests" | "expand";

/** Action bar תחתון בסגנון RPG — משבצות זהב במקום FAB מודרני */
export function BottomFabBar() {
  const { t, dir } = useI18n();
  const [bankOpen, setBankOpen] = useState(false);

  const openPanel = (tab: "build" | "staff" | "logistics" | "expand") => {
    window.dispatchEvent(new CustomEvent("cit-open-panel", { detail: { tab } }));
  };

  const onQuests = () => {
    // Do not open land-expansion — tip only.
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

  const fabs: { id: FabId; icon: string; label: string; action: () => void; hotkey: string }[] = [
    { id: "build", icon: "⚒️", label: t("build"), action: () => setBankOpen(true), hotkey: "1" },
    { id: "staff", icon: "🛡️", label: t("staff"), action: () => openPanel("staff"), hotkey: "2" },
    { id: "logistics", icon: "📦", label: t("logistics"), action: () => openPanel("logistics"), hotkey: "3" },
    { id: "quests", icon: "📜", label: t("quests"), action: onQuests, hotkey: "4" },
    { id: "expand", icon: "🗺️", label: t("expand"), action: () => openPanel("expand"), hotkey: "5" },
  ];

  return (
    <>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[48] flex justify-center pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:bottom-3"
        dir={dir}
      >
        <div className="pointer-events-auto wow-frame flex items-end gap-1.5 rounded-md px-3 py-2">
          {fabs.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={f.action}
              data-testid={f.id === "build" ? "fab-build" : f.id === "quests" ? "fab-quests" : undefined}
              className={`${f.id === "build" ? "wow-action-slot wow-action-slot-active -mt-2 h-16 w-16" : "wow-action-slot"}`}
              title={`${f.label} [${f.hotkey}]`}
            >
              <span className="absolute start-0.5 top-0 text-[8px] font-bold text-[color:var(--wow-gold-dim)]">{f.hotkey}</span>
              <span className="text-xl leading-none">{f.icon}</span>
              <span className="mt-0.5 text-[8px] font-bold leading-tight">{f.label}</span>
            </button>
          ))}
        </div>
      </div>
      <BuildBankModal open={bankOpen} onClose={() => setBankOpen(false)} />
    </>
  );
}
