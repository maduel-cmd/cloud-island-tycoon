import type { DecorKind, GridPos, TileKind } from "../data/types";

export const TILE_W = 64;
export const TILE_H = 32;

export interface PlotDef {
  id: string;
  origin: GridPos;
  width: number;
  height: number;
  cost: number;
  unlocked: boolean;
}

export class GridSystem {
  readonly width: number;
  readonly height: number;
  tiles: TileKind[][];
  plots: PlotDef[];
  gatePos: GridPos;
  warehousePos: GridPos;
  bins: Set<string>;
  benches: Set<string>;
  /** cell key → decor kind */
  decor: Map<string, DecorKind>;

  constructor(width = 28, height = 22) {
    this.width = width;
    this.height = height;
    this.tiles = Array.from({ length: height }, () =>
      Array.from({ length: width }, (): TileKind => "cloud"),
    );
    this.bins = new Set();
    this.benches = new Set();
    this.decor = new Map();
    this.plots = [
      {
        id: "starter",
        origin: { x: 6, y: 6 },
        width: 12,
        height: 10,
        cost: 0,
        unlocked: true,
      },
      {
        id: "north",
        origin: { x: 6, y: 2 },
        width: 12,
        height: 4,
        cost: 2500,
        unlocked: false,
      },
      {
        id: "east",
        origin: { x: 18, y: 6 },
        width: 6,
        height: 10,
        cost: 3200,
        unlocked: false,
      },
      {
        id: "west",
        origin: { x: 2, y: 6 },
        width: 4,
        height: 10,
        cost: 2800,
        unlocked: false,
      },
      {
        id: "south",
        origin: { x: 6, y: 16 },
        width: 12,
        height: 4,
        cost: 3000,
        unlocked: false,
      },
    ];
    this.gatePos = { x: 11, y: 15 };
    this.warehousePos = { x: 7, y: 13 };
    this.applyStarterLayout();
  }

  private applyStarterLayout(): void {
    for (const plot of this.plots) {
      if (!plot.unlocked) continue;
      this.unlockPlotTiles(plot);
    }
    // Memory rule: lot + gate only. Paths / parking / warehouse come from the build bank.
    this.set(this.gatePos.x, this.gatePos.y, "path");
    const gateTwin = { x: this.gatePos.x + 1, y: this.gatePos.y };
    if (this.inBounds(gateTwin)) this.set(gateTwin.x, gateTwin.y, "path");
  }

  unlockPlotTiles(plot: PlotDef): void {
    for (let y = plot.origin.y; y < plot.origin.y + plot.height; y++) {
      for (let x = plot.origin.x; x < plot.origin.x + plot.width; x++) {
        if (!this.inBounds({ x, y })) continue;
        const cur = this.get(x, y);
        if (cur === "cloud" || cur === "locked" || cur === "void") {
          this.set(x, y, "grass");
        }
      }
    }
  }

  unlockPlot(id: string): boolean {
    const plot = this.plots.find((p) => p.id === id);
    if (!plot || plot.unlocked) return false;
    plot.unlocked = true;
    this.unlockPlotTiles(plot);
    return true;
  }

  inBounds(p: GridPos): boolean {
    return p.x >= 0 && p.y >= 0 && p.x < this.width && p.y < this.height;
  }

  get(x: number, y: number): TileKind {
    return this.tiles[y]?.[x] ?? "void";
  }

  set(x: number, y: number, kind: TileKind): void {
    if (!this.inBounds({ x, y })) return;
    this.tiles[y]![x] = kind;
  }

  isWalkable(p: GridPos): boolean {
    const t = this.get(p.x, p.y);
    return t === "path" || t === "road" || t === "parking";
  }

  isBuildableGrass(p: GridPos): boolean {
    return this.get(p.x, p.y) === "grass";
  }

  neighbors4(p: GridPos): GridPos[] {
    const dirs = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];
    return dirs
      .map((d) => ({ x: p.x + d.x, y: p.y + d.y }))
      .filter((n) => this.inBounds(n));
  }

  static gridToScreen(p: GridPos, originX: number, originY: number): { x: number; y: number } {
    return {
      x: originX + (p.x - p.y) * (TILE_W / 2),
      y: originY + (p.x + p.y) * (TILE_H / 2),
    };
  }

  static screenToGrid(
    sx: number,
    sy: number,
    originX: number,
    originY: number,
  ): GridPos {
    const rx = sx - originX;
    const ry = sy - originY;
    const x = Math.floor((rx / (TILE_W / 2) + ry / (TILE_H / 2)) / 2);
    const y = Math.floor((ry / (TILE_H / 2) - rx / (TILE_W / 2)) / 2);
    return { x, y };
  }
}

export function keyOf(p: GridPos): string {
  return `${p.x},${p.y}`;
}

export function parseKey(k: string): GridPos {
  const [xs, ys] = k.split(",");
  return { x: Number(xs), y: Number(ys) };
}
