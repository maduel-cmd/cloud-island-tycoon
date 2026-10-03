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
    const longLived = /מחסן|warehouse|יהלומ|gem|משכור|wage|סגירת יום|day close/i.test(message);
    const t = window.setTimeout(() => {
      setVisible(false);
      // clear store message so it doesn't reappear
      simulation.state.message = null;
    }, longLived ? 5200 : 3200);
    return () => window.clearTimeout(t);
  }, [message]);

  if (!visible || !message) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[6.25rem] z-[60] flex justify-center px-3 sm:bottom-8">
      <div
        className="wow-frame max-w-[min(94vw,400px)] px-3 py-2.5 text-center text-xs font-semibold text-[color:var(--wow-parchment)] sm:text-sm"
        data-testid="toast-message"
      >
        {message}
      </div>
    </div>
  );
}
