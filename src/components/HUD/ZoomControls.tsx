import { useEffect, useState } from "react";
import { useI18n } from "../../i18n/I18nContext";
import { ZOOM_MAX, ZOOM_MIN } from "../../assets/sprites/ParkRenderer";

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

  const pct = Math.round(zoom * 100);
  const detailHint =
    zoom >= 2 ? t("zoomDetailHigh") : zoom >= 1.25 ? t("zoomDetailMed") : t("zoomDetailLow");

  return (
    <div className="pointer-events-none absolute bottom-24 end-3 z-[46] flex flex-col items-end gap-1 sm:bottom-8">
      <div className="pointer-events-auto wow-frame flex flex-col overflow-hidden rounded-md">
        <button
          type="button"
          className="px-3 py-2 text-lg font-bold text-[color:var(--wow-gold)] hover:bg-[#2a2018] disabled:opacity-40"
          onClick={() => zoomDir("in")}
          disabled={zoom >= ZOOM_MAX - 0.01}
          aria-label={t("zoomIn")}
        >
          +
        </button>
        <div className="border-y border-[color:var(--wow-border)] px-2 py-1 text-center text-[10px] font-bold tabular-nums text-[color:var(--wow-parchment)]">
          {pct}%
        </div>
        <button
          type="button"
          className="px-3 py-2 text-lg font-bold text-[color:var(--wow-gold)] hover:bg-[#2a2018] disabled:opacity-40"
          onClick={() => zoomDir("out")}
          disabled={zoom <= ZOOM_MIN + 0.01}
          aria-label={t("zoomOut")}
        >
          −
        </button>
      </div>
      <span className="pointer-events-none max-w-[6.5rem] text-end text-[9px] font-medium leading-tight text-[color:var(--wow-parchment)] drop-shadow">
        {t("zoomHint")}
        <br />
        {detailHint}
      </span>
    </div>
  );
}
