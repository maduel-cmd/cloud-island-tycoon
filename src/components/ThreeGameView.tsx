import { useEffect, useRef } from "react";
import { keyOf } from "../core/GridSystem";
import { warmAssetBank } from "../assets/AssetLoader";
import { mountThreePark, type ThreeParkHandle } from "../three/ThreeParkWorld";
import { simulation } from "../managers/Simulation";

/** מרחק מינימלי (px) לפני שגרירה נחשבת הזזת מפה ולא הקשה */
const PAN_SLOP_PX = 8;

/** תצוגת פארק חיה ב־Three.js — מצלמת orbit בסגנון WoW + עולם פנטזיה */
export function ThreeGameView() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    warmAssetBank();
    const park = mountThreePark(el);
    let raf = 0;
    let last = performance.now();
    let paintingPath = false;
    let lastPaintKey = "";
    const activePointers = new Map<number, { x: number; y: number }>();

    /** הקשה ממתינה — עד שמזיזים מספיק (אצבע/עכבר) מתחילים pan */
    let pendingTap: { pointerId: number; x: number; y: number } | null = null;
    let cameraDragging = false;

    simulation.start();

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      park.sync(simulation, dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const canvas = park.renderer.domElement;

    const pinchStats = () => {
      const pts = [...activePointers.values()];
      if (pts.length < 2) return null;
      const [a, b] = pts;
      const dx = b!.x - a!.x;
      const dy = b!.y - a!.y;
      return {
        dist: Math.hypot(dx, dy),
        /** Screen angle between the two fingers — twist delta rotates the park */
        angle: Math.atan2(dy, dx),
      };
    };

    const onPointerDown = (e: PointerEvent) => {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      if (activePointers.size === 2) {
        paintingPath = false;
        pendingTap = null;
        cameraDragging = false;
        park.endDrag();
        const p = pinchStats();
        if (p) park.beginPinch(p.dist, p.angle);
        return;
      }

      // ימני / אמצעי = orbit
      if (e.button === 1 || e.button === 2) {
        paintingPath = false;
        pendingTap = null;
        cameraDragging = true;
        park.beginDrag(e.clientX, e.clientY, "orbit");
        return;
      }

      // Shift = pan מיידי
      if (e.shiftKey) {
        paintingPath = false;
        pendingTap = null;
        cameraDragging = true;
        park.beginDrag(e.clientX, e.clientY, "pan");
        return;
      }

      const pos = park.screenToGrid(e.clientX, e.clientY);
      if (simulation.state.buildMode === "path") {
        paintingPath = true;
        pendingTap = null;
        cameraDragging = false;
        lastPaintKey = keyOf(pos);
        simulation.placePath(pos);
        return;
      }

      // אצבע / לחיצה ראשונה: מחכים לתנועה — גרירה=הזזת מפה, הקשה=בחירה
      paintingPath = false;
      cameraDragging = false;
      pendingTap = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (activePointers.has(e.pointerId)) {
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      if (activePointers.size >= 2) {
        pendingTap = null;
        const p = pinchStats();
        if (p) park.pinch(p.dist, p.angle);
        return;
      }

      // המרת הקשה לגרירת מפה (pan) כשהאצבע זזה
      if (pendingTap && pendingTap.pointerId === e.pointerId && !cameraDragging) {
        const dist = Math.hypot(e.clientX - pendingTap.x, e.clientY - pendingTap.y);
        if (dist >= PAN_SLOP_PX) {
          cameraDragging = true;
          park.beginDrag(pendingTap.x, pendingTap.y, "pan");
          pendingTap = null;
          park.drag(e.clientX, e.clientY);
          return;
        }
      }

      if (cameraDragging) {
        park.drag(e.clientX, e.clientY);
      }

      const pos = park.screenToGrid(e.clientX, e.clientY);
      park.setHover(pos);
      if (paintingPath && simulation.state.buildMode === "path") {
        const k = keyOf(pos);
        if (k !== lastPaintKey) {
          lastPaintKey = k;
          simulation.placePath(pos, true);
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      activePointers.delete(e.pointerId);
      if (activePointers.size < 2) park.endPinch();

      // הקשה בלי גרירה = רוח על ענני ערפל מעל הפארק, ואז לחיצה על משבצת
      if (pendingTap && pendingTap.pointerId === e.pointerId && !cameraDragging) {
        park.blowCloudsAt(e.clientX, e.clientY);
        const pos = park.screenToGrid(e.clientX, e.clientY);
        simulation.handleTileClick(pos);
      }

      pendingTap = null;
      paintingPath = false;
      lastPaintKey = "";
      cameraDragging = false;
      park.endDrag();
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      park.zoomAt(e.deltaY, e.clientX, e.clientY);
    };
    const onContext = (e: Event) => e.preventDefault();
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        park.zoomBy(1.12);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        park.zoomBy(1 / 1.12);
      } else if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") {
        e.preventDefault();
        park.nudge(1, 0);
      } else if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") {
        e.preventDefault();
        park.nudge(-1, 0);
      } else if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
        e.preventDefault();
        park.nudge(0, -1);
      } else if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
        e.preventDefault();
        park.nudge(0, 1);
      }
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", onContext);
    window.addEventListener("keydown", onKey);

    const onZoomBtn = (e: Event) => {
      const dir = (e as CustomEvent<{ dir: "in" | "out" }>).detail?.dir;
      if (dir === "in") park.zoomBy(1.15);
      else if (dir === "out") park.zoomBy(1 / 1.15);
    };
    window.addEventListener("cit-zoom", onZoomBtn);

    const unsubZoom = park.onZoomChange((z) => {
      window.dispatchEvent(new CustomEvent("cit-zoom-level", { detail: { zoom: z } }));
    });
    window.dispatchEvent(new CustomEvent("cit-zoom-level", { detail: { zoom: park.getZoom() } }));

    return () => {
      cancelAnimationFrame(raf);
      simulation.stop();
      unsubZoom();
      window.removeEventListener("cit-zoom", onZoomBtn);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onContext);
      park.dispose();
    };
  }, []);

  return (
    <div
      ref={ref}
      className="absolute inset-0 h-full w-full touch-none"
      aria-label="מפת פארק השמיים תלת־ממד"
    />
  );
}

export type { ThreeParkHandle };
