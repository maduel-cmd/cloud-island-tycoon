import { useEffect, useState } from "react";
import { useGameStore } from "../../state/useGameStore";
import { simulation } from "../../managers/Simulation";
import { localizeSimMessage } from "../../i18n/localizeSimMessage";
import { useI18n } from "../../i18n/I18nContext";

/** Auto-dismiss toast above the bottom bar — thin card, no glow */
export function ToastMessage() {
  const message = useGameStore().message;
  const { locale } = useI18n();
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
      simulation.state.message = null;
    }, longLived ? 5200 : 3200);
    return () => window.clearTimeout(t);
  }, [message]);

  if (!visible || !message) return null;

  const text = localizeSimMessage(message, locale);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[4.75rem] z-[45] flex justify-center px-3 sm:bottom-6">
      <div
        className="cit-card max-w-[min(92vw,360px)] rounded px-3 py-2 text-center text-xs font-semibold text-[color:var(--cit-text)] sm:text-sm"
        data-testid="toast-message"
      >
        {text}
      </div>
    </div>
  );
}
