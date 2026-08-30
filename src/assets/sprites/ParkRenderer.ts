import { getAttraction } from "../../data/attractions";
import { getStall } from "../../data/stalls";
import type { GridPos, PlacedAttraction, PlacedStall, StaffMember, Visitor } from "../../data/types";
import { GridSystem, TILE_H, TILE_W } from "../../core/GridSystem";
import type { Simulation } from "../../managers/Simulation";
import { drawIsoCharacter, type CharacterPose } from "./CharacterArt";
import {
  drawVisitorSheetFrame,
  visitorFacingFlipX,
  VISITOR_SHEET,
} from "./VisitorSheet";
import { balloonVendorTileImage, visitorSheetImage, warmAssetBank } from "../AssetLoader";
import { fxSystem } from "../../engine/FxSystem";

const CLOUD_PATCHES = [
  { x: -220, y: 40, s: 1.2, sp: 0.12, layer: 0 },
  { x: 180, y: 90, s: 0.9, sp: 0.08, layer: 1 },
  { x: -80, y: 160, s: 1.4, sp: 0.05, layer: 0 },
  { x: 320, y: 30, s: 1.1, sp: 0.1, layer: 2 },
  { x: 80, y: 220, s: 0.8, sp: 0.07, layer: 1 },
  { x: -300, y: 200, s: 1.0, sp: 0.06, layer: 0 },
  { x: 400, y: 140, s: 1.3, sp: 0.04, layer: 2 },
  { x: -150, y: 280, s: 0.95, sp: 0.09, layer: 1 },
];

function shadeHex(hex: string, amount: number): string {
  const n = hex.replace("#", "");
  if (n.length !== 6) return hex;
  const r = Math.max(0, Math.min(255, parseInt(n.slice(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(n.slice(2, 4), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(n.slice(4, 6), 16) + amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function skyColors(hour: number): [string, string, string] {
  if (hour < 11) return ["#5ec8f0", "#8ed8f5", "#d4f0fb"]; // morning
  if (hour < 16) return ["#3bb4ea", "#7ccff0", "#c8ebf8"]; // day
  if (hour < 18.5) return ["#f97316", "#c084fc", "#fda4af"]; // dusk
  return ["#0f172a", "#1e3a5f", "#312e81"]; // night
}

/** Zoom limits — wider range unlocks richer LOD on rides */
export const ZOOM_MIN = 0.35;
export const ZOOM_MAX = 3.5;

export class ParkRenderer {
  private particles: { x: number; y: number; r: number; vy: number; a: number }[] = [];
  private cam = { x: 0, y: 0, zoom: 1 };
  private dragging = false;
  private lastMouse = { x: 0, y: 0 };
  private hover: GridPos | null = null;
  private time = 0;
  private zoomListeners = new Set<(z: number) => void>();
  /** Pinch tracking */
  private pinchDist = 0;

  constructor(private canvas: HTMLCanvasElement) {
    warmAssetBank();
    for (let i = 0; i < 48; i++) {
      this.particles.push({
        x: Math.random() * 2000 - 400,
        y: Math.random() * 1200,
        r: 1 + Math.random() * 2.5,
        vy: 8 + Math.random() * 18,
        a: 0.15 + Math.random() * 0.4,
      });
    }
  }

  getZoom(): number {
    return this.cam.zoom;
  }

  setHover(p: GridPos | null): void {
    this.hover = p;
  }

  beginDrag(x: number, y: number): void {
    this.dragging = true;
    this.lastMouse = { x, y };
  }

  drag(x: number, y: number): void {
    if (!this.dragging) return;
    this.cam.x += x - this.lastMouse.x;
    this.cam.y += y - this.lastMouse.y;
    this.lastMouse = { x, y };
  }

  endDrag(): void {
    this.dragging = false;
  }

  onZoomChange(fn: (z: number) => void): () => void {
    this.zoomListeners.add(fn);
    return () => this.zoomListeners.delete(fn);
  }

  private emitZoom(): void {
    for (const fn of this.zoomListeners) fn(this.cam.zoom);
  }

  private clampZoom(z: number): number {
    return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
  }

  /** Wheel zoom toward a canvas-local point (client coords relative to canvas). */
  zoomAt(delta: number, focusClientX?: number, focusClientY?: number): void {
    const factor = delta > 0 ? 0.9 : 1.1;
    this.zoomToward(factor, focusClientX, focusClientY);
  }

  zoomBy(factor: number, focusClientX?: number, focusClientY?: number): void {
    this.zoomToward(factor, focusClientX, focusClientY);
  }

  private zoomToward(factor: number, focusClientX?: number, focusClientY?: number): void {
    const prev = this.cam.zoom;
    const next = this.clampZoom(prev * factor);
    if (next === prev) return;
    if (focusClientX != null && focusClientY != null) {
      const rect = this.canvas.getBoundingClientRect();
      const lx = focusClientX - rect.left;
      const ly = focusClientY - rect.top;
      // Keep world point under cursor stable
      const wx = (lx - this.cam.x) / prev;
      const wy = (ly - this.cam.y) / prev;
      this.cam.zoom = next;
      this.cam.x = lx - wx * next;
      this.cam.y = ly - wy * next;
    } else {
      this.cam.zoom = next;
    }
    this.emitZoom();
  }

  beginPinch(dist: number): void {
    this.pinchDist = dist;
  }

  pinch(dist: number, midClientX: number, midClientY: number): void {
    if (this.pinchDist <= 0) {
      this.pinchDist = dist;
      return;
    }
    const factor = dist / this.pinchDist;
    this.pinchDist = dist;
    this.zoomToward(factor, midClientX, midClientY);
  }

  endPinch(): void {
    this.pinchDist = 0;
  }

  screenToGrid(sim: Simulation, clientX: number, clientY: number): GridPos {
    const rect = this.canvas.getBoundingClientRect();
    const sx = (clientX - rect.left - this.cam.x) / this.cam.zoom;
    const sy = (clientY - rect.top - this.cam.y) / this.cam.zoom;
    const origin = sim.screenOrigin(this.canvas.width / this.cam.zoom, this.canvas.height / this.cam.zoom);
    return GridSystem.screenToGrid(sx, sy, origin.x, origin.y);
  }

  render(sim: Simulation, dt: number): void {
    this.time += dt;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const hour = sim.state.timeOfDay;
    const night = hour >= 18.5;
    const dusk = hour >= 16 && hour < 18.5;
    const lod = this.cam.zoom; // >1.4 = detail, <0.7 = simplified

    const [c0, c1, c2] = skyColors(hour);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, c0);
    g.addColorStop(0.45, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // celestial accents
    if (night) {
      ctx.fillStyle = "#fef9c3";
      ctx.beginPath();
      ctx.arc(w * 0.78, h * 0.12, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (let i = 0; i < 40; i++) {
        const sx = ((i * 97) % w);
        const sy = ((i * 53) % (h * 0.45));
        ctx.globalAlpha = 0.4 + (i % 5) * 0.1;
        ctx.fillRect(sx, sy, 2, 2);
      }
      ctx.globalAlpha = 1;
    } else if (dusk) {
      ctx.fillStyle = "rgba(251, 146, 60, 0.25)";
      ctx.beginPath();
      ctx.arc(w * 0.82, h * 0.18, 36, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(this.cam.x, this.cam.y);
    ctx.scale(this.cam.zoom, this.cam.zoom);

    const origin = sim.screenOrigin(w / this.cam.zoom, h / this.cam.zoom);

    this.drawParallaxClouds(ctx, w, h, hour);
    this.drawIslandCliff(ctx, sim, origin);
    this.drawTiles(ctx, sim, origin, night, lod);
    if (lod > 0.65) {
      this.drawBins(ctx, sim, origin);
      this.drawBenches(ctx, sim, origin);
      this.drawDecor(ctx, sim, origin);
    }
    this.drawParkingCars(ctx, sim, origin);
    this.drawGate(ctx, sim, origin);
    if (sim.state.warehouseBuilt) this.drawWarehouse(ctx, sim, origin);

    type DrawItem = { depth: number; draw: () => void };
    const items: DrawItem[] = [];

    for (const a of sim.state.attractions) {
      const def = getAttraction(a.defId);
      if (!def) continue;
      const cx = a.pos.x + def.footprint.w / 2;
      const cy = a.pos.y + def.footprint.h / 2;
      const connected = sim.isFacilityConnected(a.pos, def.footprint.w, def.footprint.h);
      items.push({
        depth: cx + cy,
        draw: () => this.drawAttraction(ctx, a, origin, this.time, connected, night, lod),
      });
    }
    for (const s of sim.state.stalls) {
      const connected = sim.isFacilityConnected(s.pos, 1, 1);
      items.push({
        depth: s.pos.x + s.pos.y + 0.5,
        draw: () => this.drawStall(ctx, s, origin, connected, lod),
      });
    }
    for (const t of sim.state.trash) {
      items.push({
        depth: t.pos.x + t.pos.y + 0.2,
        draw: () => this.drawTrash(ctx, t.pos, t.amount, origin),
      });
    }
    for (const v of sim.state.visitors) {
      if (v.state === "riding") continue;
      items.push({
        depth: v.pixel.x + v.pixel.y,
        draw: () => this.drawVisitor(ctx, v, origin, lod),
      });
    }
    for (const st of sim.state.staff) {
      items.push({
        depth: st.pixel.x + st.pixel.y,
        draw: () => this.drawStaff(ctx, st, origin, lod),
      });
    }

    items.sort((a, b) => a.depth - b.depth);
    for (const it of items) it.draw();

    if (this.hover && sim.state.buildMode !== "none") {
      this.drawHover(ctx, this.hover, origin, sim);
    }

    if (lod > 0.75) this.drawFloatingLabels(ctx, sim, origin);
    fxSystem.drawMapped(ctx, (gx, gy) => this.toScreen({ x: gx, y: gy }, origin));
    if (!night) this.drawParticles(ctx, dt);

    // night path glow
    if (night) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let y = 0; y < sim.grid.height; y++) {
        for (let x = 0; x < sim.grid.width; x++) {
          if (sim.grid.get(x, y) !== "path") continue;
          const s = this.tileScreen({ x, y }, origin);
          ctx.fillStyle = "rgba(125, 211, 252, 0.12)";
          ctx.beginPath();
          ctx.ellipse(s.x, s.y + 10, 18, 10, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    ctx.restore();

    // vignette dusk/night
    if (dusk || night) {
      const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.85);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, night ? "rgba(2,6,23,0.45)" : "rgba(124,45,18,0.2)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
    }
  }

  private toScreen(p: { x: number; y: number }, origin: { x: number; y: number }): { x: number; y: number } {
    return GridSystem.gridToScreen(
      { x: p.x - 0.5, y: p.y - 0.5 },
      origin.x,
      origin.y,
    );
  }

  private tileScreen(p: GridPos, origin: { x: number; y: number }): { x: number; y: number } {
    return GridSystem.gridToScreen(p, origin.x, origin.y);
  }

  private drawDiamond(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    fill: string,
    stroke?: string,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + TILE_W / 2, y + TILE_H / 2);
    ctx.lineTo(x, y + TILE_H);
    ctx.lineTo(x - TILE_W / 2, y + TILE_H / 2);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  /** משבצת עם נפח קל (פאה קדמית) — מראה 2.5D עשיר יותר */
  private drawTileBlock(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    top: string,
    side: string,
    height = 5,
  ): void {
    // left face
    ctx.fillStyle = side;
    ctx.beginPath();
    ctx.moveTo(x - TILE_W / 2, y + TILE_H / 2);
    ctx.lineTo(x, y + TILE_H);
    ctx.lineTo(x, y + TILE_H + height);
    ctx.lineTo(x - TILE_W / 2, y + TILE_H / 2 + height);
    ctx.closePath();
    ctx.fill();
    // right face (darker)
    ctx.fillStyle = shadeHex(side, -28);
    ctx.beginPath();
    ctx.moveTo(x + TILE_W / 2, y + TILE_H / 2);
    ctx.lineTo(x, y + TILE_H);
    ctx.lineTo(x, y + TILE_H + height);
    ctx.lineTo(x + TILE_W / 2, y + TILE_H / 2 + height);
    ctx.closePath();
    ctx.fill();
    this.drawDiamond(ctx, x, y, top, "rgba(255,255,255,0.12)");
  }

  private drawParallaxClouds(ctx: CanvasRenderingContext2D, w: number, h: number, hour = 12): void {
    const dusk = hour >= 16 && hour < 18.5;
    const night = hour >= 18.5;
    for (const c of CLOUD_PATCHES) {
      const drift = this.time * c.sp * (40 + c.layer * 25);
      const ox = c.x + Math.sin(this.time * c.sp) * 30 + (w * 0.15) + drift * 0.15;
      const oy = c.y + Math.cos(this.time * c.sp * 0.7) * 12 + h * 0.35 + c.layer * 8;
      const tint = night ? 0.35 : dusk ? 0.65 : 0.55;
      this.softCloud(ctx, ox, oy, 90 * c.s, tint, dusk ? "#fdba74" : night ? "#94a3b8" : "#ffffff");
    }
  }

  private softCloud(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    a: number,
    color = "#ffffff",
  ): void {
    ctx.save();
    ctx.globalAlpha = a;
    const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x - r * 0.4, y + 4, r * 0.55, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + r * 0.35, y + 2, r * 0.5, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawIslandCliff(
    ctx: CanvasRenderingContext2D,
    sim: Simulation,
    origin: { x: number; y: number },
  ): void {
    // Approximate island silhouette under unlocked grass
    const pts: { x: number; y: number }[] = [];
    for (let y = 0; y < sim.grid.height; y++) {
      for (let x = 0; x < sim.grid.width; x++) {
        const t = sim.grid.get(x, y);
        if (t === "grass" || t === "path" || t === "parking" || t === "road") {
          const s = this.tileScreen({ x, y }, origin);
          pts.push({ x: s.x, y: s.y + TILE_H });
        }
      }
    }
    if (!pts.length) return;
    let minX = Infinity,
      maxX = -Infinity,
      maxY = -Infinity,
      minY = Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
      minY = Math.min(minY, p.y);
    }
    ctx.save();
    // Rock underbelly
    const rock = ctx.createLinearGradient(0, minY, 0, maxY + 120);
    rock.addColorStop(0, "#8b7355");
    rock.addColorStop(0.4, "#6b5344");
    rock.addColorStop(1, "#4a3728");
    ctx.fillStyle = rock;
    ctx.beginPath();
    ctx.moveTo(minX - 40, minY);
    ctx.lineTo(maxX + 40, minY);
    ctx.quadraticCurveTo(maxX + 20, maxY + 90, (minX + maxX) / 2, maxY + 130);
    ctx.quadraticCurveTo(minX - 20, maxY + 90, minX - 40, minY);
    ctx.fill();

    // Waterfalls
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "#a5f3fc";
    for (const fx of [minX + 40, (minX + maxX) / 2, maxX - 50]) {
      ctx.beginPath();
      ctx.moveTo(fx, maxY - 10);
      ctx.lineTo(fx + 14, maxY - 10);
      ctx.lineTo(fx + 8 + Math.sin(this.time * 3) * 4, maxY + 100);
      ctx.lineTo(fx - 6, maxY + 100);
      ctx.fill();
    }
    ctx.restore();

    // Soft cloud ring under island
    this.softCloud(ctx, (minX + maxX) / 2, maxY + 70, 220, 0.7);
    this.softCloud(ctx, minX + 60, maxY + 50, 140, 0.5);
    this.softCloud(ctx, maxX - 40, maxY + 55, 150, 0.5);
  }

  private drawTiles(
    ctx: CanvasRenderingContext2D,
    sim: Simulation,
    origin: { x: number; y: number },
    night = false,
    lod = 1,
  ): void {
    for (let y = 0; y < sim.grid.height; y++) {
      for (let x = 0; x < sim.grid.width; x++) {
        const kind = sim.grid.get(x, y);
        if (kind === "cloud" || kind === "void") continue;
        const s = this.tileScreen({ x, y }, origin);
        if (kind === "grass") {
          const top = night
            ? (x + y) % 2 === 0
              ? "#3d7a38"
              : "#2f6b2c"
            : (x + y) % 2 === 0
              ? "#6adf55"
              : "#58c944";
          this.drawTileBlock(ctx, s.x, s.y, top, night ? "#1f4d1c" : "#3d8f30", lod > 1.2 ? 7 : 6);
          if (lod > 1.1 && (x * 7 + y * 13) % 11 === 0) {
            ctx.fillStyle = "#f472b6";
            ctx.beginPath();
            ctx.arc(s.x, s.y + 14, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (kind === "path") {
          this.drawTileBlock(ctx, s.x, s.y, night ? "#a8b0bd" : "#d8dbe1", "#9ca3af", 4);
          if (lod > 0.9) {
            ctx.fillStyle = night ? "rgba(186,230,253,0.35)" : "rgba(255,255,255,0.25)";
            ctx.beginPath();
            ctx.moveTo(s.x, s.y + 6);
            ctx.lineTo(s.x + 8, s.y + 12);
            ctx.lineTo(s.x, s.y + 18);
            ctx.lineTo(s.x - 8, s.y + 12);
            ctx.closePath();
            ctx.fill();
          }
        } else if (kind === "parking") {
          this.drawTileBlock(ctx, s.x, s.y, "#4b5563", "#374151", 4);
        } else if (kind === "road") {
          this.drawTileBlock(ctx, s.x, s.y, "#6b7280", "#4b5563", 4);
        }
      }
    }

    // locked plot outlines
    for (const plot of sim.grid.plots) {
      if (plot.unlocked) continue;
      for (let y = plot.origin.y; y < plot.origin.y + plot.height; y++) {
        for (let x = plot.origin.x; x < plot.origin.x + plot.width; x++) {
          if (sim.grid.get(x, y) !== "cloud") continue;
          const s = this.tileScreen({ x, y }, origin);
          ctx.globalAlpha = 0.12;
          this.drawDiamond(ctx, s.x, s.y, "#ffffff");
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  private drawBins(
    ctx: CanvasRenderingContext2D,
    sim: Simulation,
    origin: { x: number; y: number },
  ): void {
    const showRadius = sim.state.buildMode === "bin";
    for (const k of sim.grid.bins) {
      const [xs, ys] = k.split(",");
      const pos = { x: Number(xs), y: Number(ys) };
      const s = this.tileScreen(pos, origin);
      if (showRadius) {
        // soft coverage hint while placing more bins
        ctx.fillStyle = "rgba(34, 197, 94, 0.12)";
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 8, 48, 24, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // can body
      ctx.fillStyle = "#0f766e";
      ctx.beginPath();
      ctx.moveTo(s.x - 7, s.y + 4);
      ctx.lineTo(s.x - 6, s.y + 18);
      ctx.lineTo(s.x + 6, s.y + 18);
      ctx.lineTo(s.x + 7, s.y + 4);
      ctx.closePath();
      ctx.fill();
      // lid
      ctx.fillStyle = "#14b8a6";
      ctx.fillRect(s.x - 8, s.y + 2, 16, 4);
      ctx.fillStyle = "#5eead4";
      ctx.fillRect(s.x - 2, s.y, 4, 3);
      // recycle mark
      ctx.fillStyle = "#ecfdf5";
      ctx.font = "bold 8px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("♻", s.x, s.y + 14);
    }
  }

  private drawBenches(
    ctx: CanvasRenderingContext2D,
    sim: Simulation,
    origin: { x: number; y: number },
  ): void {
    for (const k of sim.grid.benches) {
      const [xs, ys] = k.split(",");
      const s = this.tileScreen({ x: Number(xs), y: Number(ys) }, origin);
      ctx.save();
      ctx.translate(s.x, s.y + 6);
      // legs
      ctx.fillStyle = "#78716c";
      ctx.fillRect(-10, 4, 3, 8);
      ctx.fillRect(7, 4, 3, 8);
      // seat
      ctx.fillStyle = "#a16207";
      ctx.fillRect(-12, 0, 24, 5);
      // backrest
      ctx.fillStyle = "#854d0e";
      ctx.fillRect(-12, -8, 24, 4);
      ctx.fillRect(-12, -8, 3, 8);
      ctx.fillRect(9, -8, 3, 8);
      ctx.restore();
    }
  }

  private drawDecor(
    ctx: CanvasRenderingContext2D,
    sim: Simulation,
    origin: { x: number; y: number },
  ): void {
    for (const [k, kind] of sim.grid.decor) {
      const [xs, ys] = k.split(",");
      const s = this.tileScreen({ x: Number(xs), y: Number(ys) }, origin);
      ctx.save();
      ctx.translate(s.x, s.y);
      if (kind === "flower") {
        ctx.fillStyle = "#4ade80";
        ctx.fillRect(-6, 8, 12, 4);
        const colors = ["#f472b6", "#fbbf24", "#a78bfa", "#fb7185"];
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = colors[i]!;
          ctx.beginPath();
          ctx.arc(-4 + (i % 2) * 8, 2 + Math.floor(i / 2) * 5, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (kind === "bush") {
        ctx.fillStyle = "#15803d";
        ctx.beginPath();
        ctx.ellipse(0, 6, 14, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#22c55e";
        ctx.beginPath();
        ctx.ellipse(-5, 2, 8, 7, 0, 0, Math.PI * 2);
        ctx.ellipse(5, 3, 7, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (kind === "tree") {
        ctx.fillStyle = "#78350f";
        ctx.fillRect(-3, 0, 6, 16);
        ctx.fillStyle = "#166534";
        ctx.beginPath();
        ctx.arc(0, -6, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#22c55e";
        ctx.beginPath();
        ctx.arc(-6, -10, 8, 0, Math.PI * 2);
        ctx.arc(6, -8, 7, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // statue
        ctx.fillStyle = "#94a3b8";
        ctx.fillRect(-8, 10, 16, 4);
        ctx.fillStyle = "#cbd5e1";
        ctx.fillRect(-4, -2, 8, 12);
        ctx.beginPath();
        ctx.arc(0, -8, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#64748b";
        ctx.fillRect(-10, -18, 20, 3);
        ctx.fillRect(-2, -28, 4, 10);
      }
      ctx.restore();
    }
  }

  private drawParkingCars(
    ctx: CanvasRenderingContext2D,
    sim: Simulation,
    origin: { x: number; y: number },
  ): void {
    for (const p of sim.state.parking) {
      if (!p.occupied) continue;
      const s = this.tileScreen(p.pos, origin);
      ctx.save();
      ctx.translate(s.x, s.y + 10);
      ctx.fillStyle = p.carColor;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillRect(-6, -4, 8, 4);
      ctx.restore();
    }
  }

  private drawGate(
    ctx: CanvasRenderingContext2D,
    sim: Simulation,
    origin: { x: number; y: number },
  ): void {
    const s = this.tileScreen(sim.grid.gatePos, origin);
    ctx.save();
    ctx.translate(s.x, s.y);
    // arch
    ctx.fillStyle = "#2563eb";
    ctx.fillRect(-28, -8, 10, 36);
    ctx.fillRect(18, -8, 10, 36);
    ctx.fillStyle = "#3b82f6";
    ctx.beginPath();
    ctx.moveTo(-30, -8);
    ctx.quadraticCurveTo(0, -36, 30, -8);
    ctx.lineTo(28, 0);
    ctx.quadraticCurveTo(0, -24, -28, 0);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 8px Fredoka, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Cloud Island", 0, -14);
    // ticket booth
    ctx.fillStyle = "#1d4ed8";
    ctx.fillRect(-40, 8, 14, 16);
    ctx.fillStyle = "#93c5fd";
    ctx.fillRect(-38, 12, 6, 6);
    ctx.restore();
  }

  private drawWarehouse(
    ctx: CanvasRenderingContext2D,
    sim: Simulation,
    origin: { x: number; y: number },
  ): void {
    const s = this.tileScreen(sim.grid.warehousePos, origin);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.fillStyle = "#64748b";
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(18, 4);
    ctx.lineTo(0, 14);
    ctx.lineTo(-18, 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(-12, 0, 24, 16);
    ctx.fillStyle = "#334155";
    ctx.fillRect(-4, 6, 8, 10);
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("WH", 0, -8);
    ctx.restore();
  }

  private drawAttraction(
    ctx: CanvasRenderingContext2D,
    a: PlacedAttraction,
    origin: { x: number; y: number },
    time: number,
    connected: boolean,
    night = false,
    lod = 1,
  ): void {
    const def = getAttraction(a.defId);
    if (!def) return;
    const cx = a.pos.x + def.footprint.w / 2;
    const cy = a.pos.y + def.footprint.h / 2;
    const s = GridSystem.gridToScreen({ x: cx - 0.5, y: cy - 0.5 }, origin.x, origin.y);
    const tierScale = 1 + (a.tier - 1) * 0.08;
    const animSpeed = a.broken ? 0 : 0.7 + a.tier * 0.35;
    const t = time * animSpeed;

    // Tier palette: rustic → neon
    let color = def.color;
    let accent = def.accent;
    if (a.tier >= 4) {
      color = shadeHex(def.color, 30);
      accent = shadeHex(def.accent, 40);
    }
    if (a.tier === 5) {
      color = shadeHex(def.color, 55);
      accent = "#f0abfc";
    }
    if (a.broken) {
      color = "#9ca3af";
      accent = "#78716c";
    }

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.scale(tierScale, tierScale);
    if (a.broken) {
      ctx.filter = "sepia(0.45) grayscale(0.35)";
      ctx.globalAlpha = 0.75;
    }

    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.beginPath();
    ctx.ellipse(0, 18, 28 * def.footprint.w * 0.45, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    if (!connected && !a.broken) {
      ctx.strokeStyle = "rgba(239, 68, 68, 0.85)";
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.ellipse(0, 18, 32 * def.footprint.w * 0.45, 14, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    switch (def.shape) {
      case "coaster":
        this.drawCoaster(ctx, color, accent, t, lod);
        break;
      case "wheel":
        this.drawFerris(ctx, color, accent, t, lod);
        break;
      case "carousel":
        this.drawCarousel(ctx, color, accent, t, lod);
        break;
      case "cups":
        this.drawTeacups(ctx, color, t, lod);
        break;
      case "ship":
        this.drawPirateShip(ctx, color, accent, t, lod);
        break;
      case "tower":
        this.drawTower(ctx, color, accent, t, lod);
        break;
      case "water":
        this.drawWaterRide(ctx, color, accent, lod);
        break;
      default:
        this.drawGenericRide(ctx, color, accent, lod);
    }

    // neon outline at night for high-tier coasters / wheels
    if (night && !a.broken && (def.shape === "coaster" || def.shape === "wheel") && a.tier >= 3) {
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.55 + Math.sin(time * 4) * 0.2;
      ctx.lineWidth = 2;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, -10, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // Close-up plaque + queue posts when zoomed in
    if (lod > 1.25 && !a.broken) {
      ctx.fillStyle = "rgba(15,23,42,0.78)";
      ctx.beginPath();
      ctx.roundRect(-28, 28, 56, 16, 4);
      ctx.fill();
      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 8px Heebo, Fredoka, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(def.nameHe.slice(0, 12), 0, 39);
      if (lod > 1.7) {
        ctx.fillStyle = accent;
        for (let i = -2; i <= 2; i++) {
          ctx.fillRect(i * 10 - 1, 22, 2, 6);
        }
      }
    }

    if (lod > 0.85) {
      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 10px Fredoka, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(a.tier >= 5 ? "Lvl 5 MAX" : `Lvl ${a.tier}`, 0, -54);
    }

    // Ultra zoom: sparkles + capacity pip
    if (lod > 2.0 && !a.broken) {
      ctx.fillStyle = accent;
      for (let i = 0; i < 4; i++) {
        const ang = time * 2 + i * 1.6;
        ctx.globalAlpha = 0.5 + Math.sin(time * 5 + i) * 0.3;
        ctx.beginPath();
        ctx.arc(Math.cos(ang) * 36, -12 + Math.sin(ang) * 20, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "7px sans-serif";
      ctx.fillText(`${a.queue.length}/${def.baseCapacity}`, 0, -64);
    }

    ctx.filter = "none";
    ctx.globalAlpha = 1;
    if (a.broken) {
      const bounce = Math.sin(time * 6) * 3;
      ctx.font = "18px serif";
      ctx.textAlign = "center";
      ctx.fillText("🔧", 0, -20 + bounce);
      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 11px Heebo, sans-serif";
      ctx.fillText("תקול", 0, 40);
    } else if (!connected) {
      ctx.fillStyle = "#dc2626";
      ctx.font = "bold 10px Heebo, sans-serif";
      ctx.fillText("אין שביל", 0, 40);
    }

    ctx.restore();
  }

  private drawCoaster(
    ctx: CanvasRenderingContext2D,
    color: string,
    accent: string,
    t: number,
    lod = 1,
  ): void {
    // Support pillars (visible when zoomed)
    if (lod > 1.15) {
      ctx.strokeStyle = shadeHex(color, -40);
      ctx.lineWidth = 2;
      for (const px of [-28, -8, 18, 32]) {
        ctx.beginPath();
        ctx.moveTo(px, 14);
        ctx.lineTo(px * 0.4, -6);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = lod > 1.5 ? 5 : 4;
    ctx.beginPath();
    ctx.moveTo(-36, 10);
    ctx.quadraticCurveTo(-10, -40, 10, -10);
    ctx.quadraticCurveTo(28, 20, 40, -5);
    ctx.stroke();
    // loop
    ctx.beginPath();
    ctx.arc(8, -8, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-36, 12);
    ctx.quadraticCurveTo(-10, -38, 10, -8);
    ctx.stroke();
    // car(s)
    const cars = lod > 1.8 ? 3 : lod > 1.2 ? 2 : 1;
    for (let i = 0; i < cars; i++) {
      const ang = t * 2 + i * 0.55;
      const cx = 8 + Math.cos(ang) * 14;
      const cy = -8 + Math.sin(ang) * 14;
      ctx.fillStyle = accent;
      ctx.fillRect(cx - 5, cy - 3, 10, 6);
      if (lod > 1.4) {
        ctx.fillStyle = "#fef3c7";
        ctx.fillRect(cx - 3, cy - 2, 2, 2);
        ctx.fillRect(cx + 1, cy - 2, 2, 2);
      }
    }
    if (lod > 2.0) {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "8px serif";
      ctx.fillText("🎢", 0, -48);
    }
  }

  private drawFerris(
    ctx: CanvasRenderingContext2D,
    color: string,
    accent: string,
    t: number,
    lod = 1,
  ): void {
    const gondolas = lod > 1.6 ? 12 : lod > 1.1 ? 10 : 8;
    const radius = lod > 1.5 ? 30 : 28;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -18, radius, 0, Math.PI * 2);
    ctx.stroke();
    if (lod > 1.2) {
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(Math.cos(a) * radius, -18 + Math.sin(a) * radius);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    ctx.moveTo(-10, 16);
    ctx.lineTo(0, -18);
    ctx.lineTo(10, 16);
    ctx.stroke();
    const colors = ["#ef4444", "#eab308", "#22c55e", "#3b82f6", "#a855f7", "#f97316"];
    for (let i = 0; i < gondolas; i++) {
      const a = t * 0.6 + (i * Math.PI * 2) / gondolas;
      const x = Math.cos(a) * radius;
      const y = -18 + Math.sin(a) * radius;
      ctx.fillStyle = colors[i % colors.length]!;
      ctx.beginPath();
      ctx.roundRect(x - 5, y - 4, 10, 8, 2);
      ctx.fill();
      if (lod > 1.5) {
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillRect(x - 3, y - 2, 6, 3);
      }
    }
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(0, -18, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawCarousel(
    ctx: CanvasRenderingContext2D,
    color: string,
    accent: string,
    t: number,
    lod = 1,
  ): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -36);
    ctx.lineTo(28, -12);
    ctx.lineTo(-28, -12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(0, -36);
    ctx.lineTo(14, -12);
    ctx.lineTo(-14, -12);
    ctx.closePath();
    ctx.fill();
    const horses = lod > 1.5 ? 8 : 6;
    for (let i = 0; i < horses; i++) {
      const a = t + (i * Math.PI * 2) / horses;
      const x = Math.cos(a) * 18;
      const y = -6 + Math.sin(a) * 6 + Math.sin(t * 3 + i) * (lod > 1.2 ? 3 : 1);
      ctx.fillStyle = i % 2 ? "#fbbf24" : "#f472b6";
      ctx.fillRect(x - 3, y - 6, 6, 10);
      if (lod > 1.4) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(x - 1, y - 4, 2, 2);
      }
    }
    if (lod > 1.8) {
      ctx.strokeStyle = "#fde68a";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, -8, 22, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawTeacups(ctx: CanvasRenderingContext2D, color: string, t: number, lod = 1): void {
    ctx.fillStyle = "#fda4af";
    ctx.beginPath();
    ctx.ellipse(0, 6, 24, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    const cups = lod > 1.5 ? 6 : 4;
    for (let i = 0; i < cups; i++) {
      const a = t * 1.5 + (i * Math.PI * 2) / cups;
      const x = Math.cos(a) * 14;
      const y = 4 + Math.sin(a) * 6;
      ctx.fillStyle = i % 2 ? color : "#ffffff";
      ctx.beginPath();
      ctx.ellipse(x, y, 7, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      if (lod > 1.4) {
        ctx.strokeStyle = shadeHex(color, -20);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x + 6, y, 3, -0.5, 0.5);
        ctx.stroke();
      }
    }
  }

  private drawPirateShip(
    ctx: CanvasRenderingContext2D,
    color: string,
    accent: string,
    t: number,
    lod = 1,
  ): void {
    const swing = Math.sin(t * 1.4) * 0.35;
    ctx.save();
    ctx.rotate(swing);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-24, 0);
    ctx.quadraticCurveTo(0, 18, 24, 0);
    ctx.lineTo(18, -8);
    ctx.lineTo(-18, -8);
    ctx.closePath();
    ctx.fill();
    if (lod > 1.3) {
      ctx.fillStyle = shadeHex(color, -25);
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(-14 + i * 10, -6, 6, 4);
      }
    }
    ctx.strokeStyle = "#44403c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(0, -40);
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(0, -40);
    ctx.lineTo(14, -28);
    ctx.lineTo(0, -24);
    ctx.fill();
    if (lod > 1.7) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.moveTo(0, -40);
      ctx.lineTo(10, -30);
      ctx.lineTo(0, -28);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawTower(
    ctx: CanvasRenderingContext2D,
    color: string,
    accent: string,
    t: number,
    lod = 1,
  ): void {
    ctx.fillStyle = color;
    ctx.fillRect(-6, -50, 12, 60);
    if (lod > 1.2) {
      ctx.fillStyle = shadeHex(color, 25);
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(-5, -48 + i * 12, 10, 2);
      }
    }
    const y = -40 + Math.abs(Math.sin(t * 2)) * 36;
    ctx.fillStyle = accent;
    ctx.fillRect(-14, y, 28, 10);
    if (lod > 1.5) {
      ctx.fillStyle = "#fef3c7";
      ctx.fillRect(-10, y + 2, 4, 4);
      ctx.fillRect(6, y + 2, 4, 4);
    }
  }

  private drawWaterRide(
    ctx: CanvasRenderingContext2D,
    color: string,
    accent: string,
    lod = 1,
  ): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 4, 26, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.ellipse(-8, 2, 8, 5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.arc(10, 0, 3, 0, Math.PI * 2);
    ctx.arc(16, 4, 2, 0, Math.PI * 2);
    ctx.fill();
    if (lod > 1.4) {
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 4, 22, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawGenericRide(
    ctx: CanvasRenderingContext2D,
    color: string,
    accent: string,
    lod = 1,
  ): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-16, -20, 32, 28, 6);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(0, -28, 10, 0, Math.PI * 2);
    ctx.fill();
    if (lod > 1.3) {
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillRect(-10, -14, 8, 6);
      ctx.fillRect(2, -14, 8, 6);
    }
  }

  private drawStall(
    ctx: CanvasRenderingContext2D,
    s: PlacedStall,
    origin: { x: number; y: number },
    connected: boolean,
    lod = 1,
  ): void {
    const def = getStall(s.defId);
    if (!def) return;
    const sc = this.tileScreen(s.pos, origin);
    const tierBoost = 1 + (s.tier - 1) * 0.06;
    ctx.save();
    ctx.translate(sc.x, sc.y);
    ctx.scale(tierBoost, tierBoost);
    if (!connected) {
      ctx.strokeStyle = "rgba(239, 68, 68, 0.9)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(-16, -24, 32, 44);
      ctx.setLineDash([]);
    }
    if (def.icon === "balloon") {
      const tile = balloonVendorTileImage();
      if (tile) {
        const w = 56;
        const h = (tile.naturalHeight / tile.naturalWidth) * w;
        ctx.drawImage(tile, -w / 2, -h + 14, w, h);
      } else {
        this.drawBalloonVendorSprite(ctx);
      }
    } else {
      const body = s.tier >= 4 ? shadeHex(def.color, 35) : def.color;
      ctx.fillStyle = body;
      ctx.fillRect(-14, -4, 28, 20);
      ctx.fillStyle = s.tier >= 5 ? "#f0abfc" : "#fff7ed";
      ctx.beginPath();
      ctx.moveTo(-18, -4);
      ctx.lineTo(0, -22);
      ctx.lineTo(18, -4);
      ctx.fill();
      if (lod > 0.9) {
        ctx.fillStyle = "#111827";
        ctx.font = "bold 8px Heebo, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(def.nameHe.slice(0, 8), 0, 10);
      }
    }
    const barY = def.icon === "balloon" ? 24 : 14;
    ctx.fillStyle = "#e5e7eb";
    ctx.fillRect(-12, barY, 24, 4);
    ctx.fillStyle = s.stock > 0 ? "#22c55e" : "#ef4444";
    ctx.fillRect(-12, barY, 24 * Math.min(1, s.stock / 40), 4);
    if (lod > 0.85) {
      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 9px Fredoka, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(s.tier >= 5 ? "Lvl5" : `Lvl${s.tier}`, 0, -28);
    }
    if (s.stock <= 0 || s.awaitingRestock) {
      const bounce = Math.sin(this.time * 7) * 4;
      ctx.font = "16px serif";
      ctx.textAlign = "center";
      ctx.fillText("📦❗", 10, -18 + bounce);
    }
    if (!connected) {
      ctx.fillStyle = "#dc2626";
      ctx.font = "bold 9px Heebo, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("אין שביל", 0, barY + 14);
    }
    ctx.restore();
  }

  /** עגלת מוכר בלונים — עגלה מפוספסת, מוכר וצרור בלונים (לפי קונספט) */
  private drawBalloonVendorSprite(ctx: CanvasRenderingContext2D): void {
    // cart body (striped)
    const stripes = ["#ef4444", "#fbbf24", "#3b82f6"];
    ctx.fillStyle = "#92400e";
    ctx.fillRect(-16, 0, 22, 12);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = stripes[i % 3]!;
      ctx.fillRect(-15 + i * 4, 1, 3.5, 10);
    }
    // cart top / sign
    ctx.fillStyle = "#fef3c7";
    ctx.fillRect(-12, -6, 14, 7);
    ctx.strokeStyle = "#b45309";
    ctx.lineWidth = 1;
    ctx.strokeRect(-12, -6, 14, 7);
    ctx.fillStyle = "#ec4899";
    ctx.beginPath();
    ctx.arc(-7, -2.5, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#eab308";
    this.drawStar(ctx, -2, -2.5, 2.4);
    // wheels
    ctx.fillStyle = "#44403c";
    ctx.beginPath();
    ctx.arc(-12, 13, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(2, 13, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#a8a29e";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(-12, 13, 2, 0, Math.PI * 2);
    ctx.stroke();
    // vendor
    ctx.fillStyle = "#fcd34d";
    ctx.beginPath();
    ctx.arc(10, -6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#78350f";
    ctx.fillRect(7, -10, 6, 3);
    ctx.fillStyle = "#1d4ed8";
    ctx.fillRect(7, -2, 6, 8);
    ctx.fillStyle = "#fff";
    ctx.fillRect(8, -1, 4, 5);
    ctx.fillStyle = "#1e3a8a";
    ctx.fillRect(7, 6, 6, 5);
    // held balloon cluster
    const balloons: { x: number; y: number; r: number; c: string; kind: "round" | "star" }[] = [
      { x: 4, y: -22, r: 4.5, c: "#ef4444", kind: "round" },
      { x: 11, y: -26, r: 4, c: "#3b82f6", kind: "round" },
      { x: 17, y: -22, r: 3.8, c: "#22c55e", kind: "round" },
      { x: 8, y: -18, r: 3.5, c: "#fbbf24", kind: "star" },
      { x: 14, y: -17, r: 3.2, c: "#ec4899", kind: "round" },
      { x: 2, y: -16, r: 3, c: "#a855f7", kind: "star" },
      { x: 19, y: -28, r: 3.2, c: "#f97316", kind: "round" },
    ];
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 0.6;
    for (const b of balloons) {
      ctx.beginPath();
      ctx.moveTo(12, -2);
      ctx.lineTo(b.x, b.y + b.r * 0.6);
      ctx.stroke();
    }
    for (const b of balloons) {
      ctx.fillStyle = b.c;
      if (b.kind === "star") {
        this.drawStar(ctx, b.x, b.y, b.r);
      } else {
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, b.r * 0.85, b.r, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath();
        ctx.ellipse(b.x - b.r * 0.25, b.y - b.r * 0.3, b.r * 0.25, b.r * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // tiny animal balloons
    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.ellipse(6, -30, 3.2, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#78716c";
    ctx.beginPath();
    ctx.ellipse(15, -32, 3.4, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  private drawTrash(
    ctx: CanvasRenderingContext2D,
    pos: GridPos,
    amount: number,
    origin: { x: number; y: number },
  ): void {
    const s = this.tileScreen(pos, origin);
    ctx.fillStyle = "#78716c";
    for (let i = 0; i < amount; i++) {
      ctx.fillRect(s.x - 4 + i * 3, s.y + 10 + (i % 2), 4, 4);
    }
  }

  private drawVisitor(
    ctx: CanvasRenderingContext2D,
    v: Visitor,
    origin: { x: number; y: number },
    lod = 1,
  ): void {
    const s = this.toScreen(v.pixel, origin);
    ctx.save();
    ctx.translate(s.x, s.y);

    const moving = v.path.length > 0 && v.state !== "queuing" && v.state !== "dining";
    let pose: CharacterPose = "idle";
    if (v.angryLeave || (v.state === "leaving" && v.mood <= 30)) pose = "angry";
    else if (v.state === "resting") pose = "sit";
    else if (v.talkTimer > 0) pose = "talk";
    else if (v.state === "queuing" || v.state === "dining") pose = "queue";
    else if (moving) pose = "walk";

    const moodColor =
      v.angryLeave || v.mood <= 30
        ? "#ef4444"
        : v.mood > 65
          ? "#22c55e"
          : v.mood > 40
            ? "#eab308"
            : "#f97316";

    const arch = ((v.archetype % VISITOR_SHEET.archetypeCount) + VISITOR_SHEET.archetypeCount) %
      VISITOR_SHEET.archetypeCount;
    const scale = lod > 2.0 ? 1.28 : lod > 1.4 ? 1.15 : lod < 0.7 ? 0.85 : 1.05;
    const sheet = visitorSheetImage();
    const sheetScale = lod > 2.0 ? 0.82 : lod > 1.4 ? 0.74 : lod < 0.7 ? 0.55 : 0.68;

    if (sheet) {
      // bob קל בהליכה — נוכחות בלי רעש
      const bob = moving ? Math.sin(v.walkPhase * Math.PI * 2) * 1.5 : 0;
      const interactPhase =
        v.interactTimer > 0 ? (this.time * (v.heldProp === "camera" ? 1.4 : 2.2)) % 1 : 0;
      ctx.translate(0, bob);
      drawVisitorSheetFrame(ctx, sheet, arch, {
        scale: sheetScale * (v.ageBand === "child" ? 0.88 : v.ageBand === "senior" ? 0.96 : 1),
        flipX: visitorFacingFlipX(v.facing),
        alpha: lod < 0.55 ? 0.85 : 1,
        heldProp: v.heldProp,
        interactPhase,
      });
      if (lod > 0.9) {
        ctx.fillStyle = moodColor;
        ctx.beginPath();
        ctx.arc(10, -48 * sheetScale, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const pants = arch < 10 ? "#1e3a5f" : arch < 20 ? "#7c2d12" : arch < 30 ? "#365314" : "#4c1d95";
      const kid = arch % 5 === 0;
      drawIsoCharacter(ctx, {
        style: {
          skin: v.skin,
          hair: v.hair,
          shirt: v.color,
          pants,
        },
        facing: v.facing,
        pose,
        walkPhase: v.walkPhase,
        time: this.time,
        scale: kid ? scale * 0.85 : scale,
        moodPip: lod > 0.8 ? moodColor : undefined,
        badge: pose === "angry" ? "!" : undefined,
      });
    }

    if (lod > 1.0 && v.thoughtEmoji) {
      const bounce = Math.sin(this.time * 5) * 2;
      const bubble = lod > 1.8 ? 28 : 24;
      const baseY = sheet ? -62 : -52;
      ctx.font = lod > 1.8 ? "16px serif" : "14px serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.strokeStyle = "rgba(15,23,42,0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(-bubble / 2, baseY + bounce, bubble, 20, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillText(v.thoughtEmoji, 0, baseY + 16 + bounce);
    }
    if (lod > 2.2) {
      ctx.fillStyle = "rgba(15,23,42,0.65)";
      ctx.beginPath();
      ctx.roundRect(-14, 8, 28, 10, 3);
      ctx.fill();
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "7px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${Math.round(v.mood)}%`, 0, 16);
    }

    ctx.restore();
  }

  private drawStaff(
    ctx: CanvasRenderingContext2D,
    st: StaffMember,
    origin: { x: number; y: number },
    lod = 1,
  ): void {
    const s = this.toScreen(st.pixel, origin);
    ctx.save();
    ctx.translate(s.x, s.y);

    const colors = { janitor: "#2563eb", runner: "#ea580c", mechanic: "#7c3aed" };
    const pants = { janitor: "#1e3a8a", runner: "#9a3412", mechanic: "#5b21b6" };
    const moving = st.path.length > 0 && st.busyTimer <= 0;

    drawIsoCharacter(ctx, {
      style: {
        skin: st.skin,
        hair: st.hair,
        shirt: colors[st.role],
        pants: pants[st.role],
        accent: st.role === "janitor" ? "#eab308" : st.role === "runner" ? "#fbbf24" : "#c4b5fd",
      },
      facing: st.facing,
      pose: moving ? "walk" : "idle",
      walkPhase: st.walkPhase,
      time: this.time,
      scale: lod > 1.3 ? 1.15 : 1.08,
    });

    if (st.role === "runner" && st.carryAmount > 0) {
      ctx.font = "12px serif";
      ctx.textAlign = "center";
      ctx.fillText("📦", 8, -36);
    }
    if (st.role === "janitor" && lod > 0.9) {
      ctx.font = "11px serif";
      ctx.fillText("🧹", -10, -30);
    }

    ctx.restore();
  }

  private drawHover(
    ctx: CanvasRenderingContext2D,
    pos: GridPos,
    origin: { x: number; y: number },
    sim: Simulation,
  ): void {
    const s = this.tileScreen(pos, origin);
    const ok =
      sim.state.buildMode === "path"
        ? sim.grid.isBuildableGrass(pos)
        : sim.state.buildMode === "bin"
          ? (sim.grid.isWalkable(pos) || sim.grid.isBuildableGrass(pos)) &&
            !sim.grid.bins.has(`${pos.x},${pos.y}`) &&
            !sim.grid.benches.has(`${pos.x},${pos.y}`) &&
            !sim.grid.decor.has(`${pos.x},${pos.y}`)
          : sim.state.buildMode === "bench"
            ? (sim.grid.isWalkable(pos) || sim.grid.isBuildableGrass(pos)) &&
              !sim.grid.bins.has(`${pos.x},${pos.y}`) &&
              !sim.grid.benches.has(`${pos.x},${pos.y}`) &&
              !sim.grid.decor.has(`${pos.x},${pos.y}`)
            : sim.state.buildMode === "decor"
              ? (sim.grid.isWalkable(pos) || sim.grid.isBuildableGrass(pos)) &&
                !sim.grid.bins.has(`${pos.x},${pos.y}`) &&
                !sim.grid.benches.has(`${pos.x},${pos.y}`) &&
                !sim.grid.decor.has(`${pos.x},${pos.y}`)
              : sim.grid.isBuildableGrass(pos);
    this.drawDiamond(ctx, s.x, s.y, ok ? "rgba(74, 222, 128, 0.45)" : "rgba(248, 113, 113, 0.45)");
    if (sim.state.buildMode === "bin" && ok) {
      ctx.fillStyle = "rgba(20, 184, 166, 0.2)";
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 8, 44, 22, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (sim.state.buildMode === "bench" && ok) {
      ctx.fillStyle = "rgba(161, 98, 7, 0.35)";
      ctx.fillRect(s.x - 12, s.y + 2, 24, 6);
    }
    if (sim.state.buildMode === "decor" && ok) {
      ctx.fillStyle = "rgba(132, 204, 22, 0.28)";
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 4, 20, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawFloatingLabels(
    ctx: CanvasRenderingContext2D,
    sim: Simulation,
    origin: { x: number; y: number },
  ): void {
    for (const a of sim.state.attractions) {
      const def = getAttraction(a.defId);
      if (!def) continue;
      const cx = a.pos.x + def.footprint.w / 2;
      const cy = a.pos.y + def.footprint.h / 2;
      const s = GridSystem.gridToScreen({ x: cx - 0.5, y: cy - 0.5 }, origin.x, origin.y);
      const yOff = -60 + Math.sin(this.time * 2 + a.pos.x) * 3;

      this.bubble(ctx, s.x - 28, s.y + yOff, a.broken ? "🔧" : "😊", a.broken ? 0 : Math.round(def.excitementScore / 3 + a.queue.length));
      if (a.revenueToday > 0) {
        this.bubble(ctx, s.x + 10, s.y + yOff - 4, "🪙", Math.round(a.revenueToday));
      }
    }
  }

  private bubble(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    icon: string,
    value: number,
  ): void {
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.shadowColor = "rgba(30,80,120,0.2)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.roundRect(x, y, 42, 18, 9);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = "11px Fredoka, sans-serif";
    ctx.fillStyle = "#1e293b";
    ctx.textAlign = "left";
    ctx.fillText(`${icon} ${value}`, x + 4, y + 13);
    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D, dt: number): void {
    for (const p of this.particles) {
      p.y -= p.vy * dt;
      if (p.y < -20) {
        p.y = 900;
        p.x = Math.random() * 1600 - 200;
      }
      ctx.globalAlpha = p.a;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
