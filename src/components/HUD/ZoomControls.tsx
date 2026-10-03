import { useEffect, useState } from "react";
import { useI18n } from "../../i18n/I18nContext";
import { ZOOM_MAX, ZOOM_MIN } from "../../assets/sprites/ParkRenderer";

/** Two small bare buttons — no frame around zoom */
export function ZoomControls() {
  const { t } = useI18n();
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const onLevel = (e: Event) => {
      const z = (e as CustomEvent<{ zoom: number }>).detail?.zoom;
      if (typeof z === "number") setZoom(z);
    };
    window.addEventListener("cit-zoom-level", onLevel);
    return () => window.removeEventListener("cit-zoom-level", onLevel);
  }, []);

  const zoomDir = (dir: "in" | "out") => {
    window.dispatchEvent(new CustomEvent("cit-zoom", { detail: { dir } }));
  };

  return (
    <div className="pointer-events-none absolute bottom-20 end-2 z-[46] flex flex-col gap-1 sm:bottom-8 sm:end-3">
      <button
        type="button"
        className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded border border-[color:var(--cit-border)] bg-[color:var(--cit-card)] text-base font-bold text-[color:var(--cit-text)] disabled:opacity-40"
        onClick={() => zoomDir("in")}
        disabled={zoom >= ZOOM_MAX - 0.01}
        aria-label={t("zoomIn")}
      >
        +
      </button>
      <button
        type="button"
        className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded border border-[color:var(--cit-border)] bg-[color:var(--cit-card)] text-base font-bold text-[color:var(--cit-text)] disabled:opacity-40"
        onClick={() => zoomDir("out")}
        disabled={zoom <= ZOOM_MIN + 0.01}
        aria-label={t("zoomOut")}
      >
        −
      </button>
    </div>
  );
}
