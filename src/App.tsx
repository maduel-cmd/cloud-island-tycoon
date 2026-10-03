import { ThreeGameView } from "./components/ThreeGameView";
import { TopBar } from "./components/HUD/TopBar";
import { BottomFabBar } from "./components/HUD/BottomFabBar";
import { ZoomControls } from "./components/HUD/ZoomControls";
import { PlacementBar } from "./components/HUD/PlacementBar";
import { NextStepHint } from "./components/HUD/NextStepHint";
import { SidePanels } from "./components/Panels/SidePanels";
import { ToastMessage } from "./components/Modals/ToastMessage";
import { WelcomeModal } from "./components/Modals/WelcomeModal";
import { DaySummaryModal } from "./components/Modals/DaySummaryModal";
import { GameOverModal } from "./components/Modals/GameOverModal";
import { I18nProvider, useI18n } from "./i18n/I18nContext";

function AppShell() {
  const { dir } = useI18n();

  return (
    <div className="relative h-full w-full overflow-hidden bg-[color:var(--wow-bg)]" dir={dir}>
      <div className="absolute inset-0 z-0">
        <ThreeGameView />
      </div>

      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(8,6,4,0.55) 100%)",
        }}
      />

      <TopBar />
      <NextStepHint />
      <ToastMessage />
      <ZoomControls />
      <SidePanels />
      <PlacementBar />
      <BottomFabBar />
      <WelcomeModal />
      <DaySummaryModal />
      <GameOverModal />
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AppShell />
    </I18nProvider>
  );
}
