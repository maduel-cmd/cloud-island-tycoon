import { useEffect, useState } from "react";
import { useGameStore } from "../../state/useGameStore";
import { simulation } from "../../managers/Simulation";

/** Auto-dismissing toast — sits above the bottom dock, never over the HUD */
export function ToastMessage() {
  const message = useGameStore().message;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const t = window.setTimeout(() => {
      setVisible(false);
      // clear store message so it doesn't reappear
      simulation.state.message = null;
    }, 2800);
    return () => window.clearTimeout(t);
  }, [message]);

  if (!visible || !message) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[5.5rem] z-[45] flex justify-center px-3 sm:bottom-6 sm:z-30">
      <div className="glass-panel max-w-[min(92vw,360px)] px-3 py-2 text-center text-xs font-semibold text-[color:var(--wow-parchment)] sm:text-sm">
        {message}
      </div>
    </div>
  );
}
