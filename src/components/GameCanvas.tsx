import { useEffect, useRef } from "react";
import { keyOf } from "../core/GridSystem";
import { ParkRenderer } from "../assets/sprites/ParkRenderer";
import { simulation } from "../managers/Simulation";

export function GameCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const renderer = new ParkRenderer(canvas);
    let raf = 0;
    let last = performance.now();
    let paintingPath = false;
    let lastPaintKey = "";
    let activePointers = new Map<number, { x: number; y: number }>();

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = parent.clientWidth * dpr;
      canvas.height = parent.clientHeight * dpr;
      canvas.style.width = `${parent.clientWidth}px`;
      canvas.style.height = `${parent.clientHeight}px`;
    };
    resize();
    window.addEventListener("resize", resize);

    simulation.start();

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      renderer.render(simulation, dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const pinchStats = () => {
      const pts = [...activePointers.values()];
      if (pts.length < 2) return null;
      const [a, b] = pts;
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      return { dist, mx: (a!.x + b!.x) / 2, my: (a!.y + b!.y) / 2 };
    };

    const onPointerDown = (e: PointerEvent) => {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointers.size === 2) {
        paintingPath = false;
        renderer.endDrag();
        const p = pinchStats();
        if (p) renderer.beginPinch(p.dist);
        return;
      }
      if (e.button === 1 || e.button === 2 || e.shiftKey) {
        paintingPath = false;
        renderer.beginDrag(e.clientX, e.clientY);
        return;
      }
      const pos = renderer.screenToGrid(simulation, e.clientX, e.clientY);
      if (simulation.state.buildMode === "path") {
        paintingPath = true;
        lastPaintKey = keyOf(pos);
        simulation.placePath(pos);
        return;
      }
      paintingPath = false;
      simulation.handleTileClick(pos);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (activePointers.has(e.pointerId)) {
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      if (activePointers.size >= 2) {
        const p = pinchStats();
        if (p) renderer.pinch(p.dist, p.mx, p.my);
        return;
      }
      renderer.drag(e.clientX, e.clientY);
      const pos = renderer.screenToGrid(simulation, e.clientX, e.clientY);
      renderer.setHover(pos);
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
      if (activePointers.size < 2) renderer.endPinch();
      paintingPath = false;
      lastPaintKey = "";
      renderer.endDrag();
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      renderer.zoomAt(e.deltaY, e.clientX, e.clientY);
    };
    const onContext = (e: Event) => e.preventDefault();
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        renderer.zoomBy(1.12);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        renderer.zoomBy(1 / 1.12);
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
      if (dir === "in") renderer.zoomBy(1.15);
      else if (dir === "out") renderer.zoomBy(1 / 1.15);
    };
    window.addEventListener("cit-zoom", onZoomBtn);

    const unsubZoom = renderer.onZoomChange((z) => {
      window.dispatchEvent(new CustomEvent("cit-zoom-level", { detail: { zoom: z } }));
    });
    window.dispatchEvent(new CustomEvent("cit-zoom-level", { detail: { zoom: renderer.getZoom() } }));

    return () => {
      cancelAnimationFrame(raf);
      simulation.stop();
      unsubZoom();
      window.removeEventListener("resize", resize);
      window.removeEventListener("cit-zoom", onZoomBtn);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onContext);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="absolute inset-0 h-full w-full touch-none"
      aria-label="מפת פארק השמיים"
    />
  );
}
