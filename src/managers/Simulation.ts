import {
  attractionCapacity,
  attractionPrice,
  attractionUpgradeCost,
  getAttraction,
} from "../data/attractions";
import { getDecor } from "../data/decor";
import { getStall, stallBuildCost, stallPrice, stallStockCap, stallUpgradeCost } from "../data/stalls";
import type {
  BuildMode,
  DecorKind,
  GameSnapshot,
  GridPos,
  ParkingSpot,
  PlacedAttraction,
  PlacedStall,
  StaffMember,
  TileKind,
  TrashPile,
  Visitor,
} from "../data/types";
import {
  facingFromDelta,
  pickHair,
  pickSkin,
  type IsoFacing,
} from "../assets/sprites/CharacterArt";
import { VISITOR_SHEET, heldPropFromStallIcon, visitorAgeBand } from "../assets/sprites/VisitorSheet";
import { Engine } from "../core/Engine";
import { GridSystem, keyOf, parseKey, TILE_H, TILE_W } from "../core/GridSystem";
import { astar } from "../core/Pathfinding";
import { fxSystem } from "../engine/FxSystem";
import { readSave, writeSave } from "./SaveGame";

const VISITOR_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ec4899", "#06b6d4"];
const CAR_COLORS = ["#ef4444", "#3b82f6", "#eab308", "#38bdf8", "#f97316", "#84cc16"];
const NIGHT_WAGE_PER_STAFF = 40;

let uidSeq = 1;
function uid(prefix: string): string {
  return `${prefix}_${uidSeq++}`;
}

function bumpUidSeqFromId(id: string): void {
  const m = /_(\d+)$/.exec(id);
  if (!m) return;
  const n = Number(m[1]);
  if (Number.isFinite(n) && n >= uidSeq) uidSeq = n + 1;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function personLooks(id: string): { skin: string; hair: string; facing: IsoFacing; walkPhase: number } {
  const h = hashStr(id);
  return {
    skin: pickSkin(h),
    hair: pickHair(h + 17),
    facing: "se",
    walkPhase: (h % 100) / 10,
  };
}

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export interface SimState {
  cash: number;
  gems: number;
  day: number;
  timeOfDay: number;
  satisfaction: number;
  cleanliness: number;
  visitorsToday: number;
  revenueToday: number;
  expensesToday: number;
  warehouseStock: number;
  /** Built from bank — not pre-placed on the empty lot */
  warehouseBuilt: boolean;
  entranceLanes: number;
  parkingBays: number;
  ticketGateFee: number;
  paused: boolean;
  speed: 1 | 2 | 3;
  buildMode: BuildMode;
  selectedBuildId: string | null;
  selectedEntity: { kind: "attraction" | "stall" | "staff"; id: string } | null;
  message: string | null;
  attractions: PlacedAttraction[];
  stalls: PlacedStall[];
  visitors: Visitor[];
  staff: StaffMember[];
  trash: TrashPile[];
  parking: ParkingSpot[];
  spawnAcc: number;
  gateQueue: number;
  enterAcc: number;
  /** Guests who stormed out today after mood crashed (lost spend) */
  frustratedLeftToday: number;
  parkLevel: number;
  parkXp: number;
  /** Free starter placements — bank only (no pre-place on map) */
  starterKit: {
    attractionId: string;
    stallId: string;
    attractionLeft: number;
    stallLeft: number;
    binLeft: number;
    /** Free staff hires from bank (memory: not pre-spawned on lot) */
    janitorLeft: number;
    runnerLeft: number;
  };
  /** Nightly P&L held until the player confirms (blocks 22:00 silent reset) */
  daySummary: {
    day: number;
    revenue: number;
    expenses: number;
    wages: number;
    visitors: number;
    frustrated: number;
    cashBeforeWages: number;
  } | null;
  gameOver: boolean;
  gameOverReason: string | null;
  /** Engine tick counter (saved as GameSnapshot.tick) */
  tick: number;
}

/** Mood at or below this → guest leaves angry and won't spend */
const MOOD_LEAVE_THRESHOLD = 30;
/** Cost per trash bin after the free starter kit bin */
const BIN_COST = 100;
/** Manhattan radius where bins prevent litter / clean piles */
const BIN_RADIUS = 2;
/** Cost to place a park bench */
const BENCH_COST = 80;

export class Simulation {
  grid = new GridSystem();
  engine = new Engine();
  state: SimState;
  private listeners = new Set<() => void>();
  private occupy = new Set<string>();

  constructor() {
    this.state = this.freshState();
    this.seedStarterPark();
    const saved = typeof localStorage !== "undefined" ? readSave() : null;
    if (saved?.grid?.tiles?.length) {
      this.applySnapshot(saved);
    }
    this.engine.on((dt) => this.tick(dt));
  }

  private freshState(): SimState {
    return {
      cash: 6500,
      gems: 25,
      day: 1,
      timeOfDay: 9,
      satisfaction: 62,
      cleanliness: 100,
      visitorsToday: 0,
      revenueToday: 0,
      expensesToday: 0,
      warehouseStock: 0,
      warehouseBuilt: false,
      entranceLanes: 1,
      parkingBays: 0,
      ticketGateFee: 12,
      paused: false,
      speed: 1,
      buildMode: "none",
      selectedBuildId: null,
      selectedEntity: null,
      message: "מגרש ריק מוכן! בנו מתקנים ודוכנים מבנק הבנייה בלבד.",
      attractions: [],
      stalls: [],
      visitors: [],
      staff: [],
      trash: [],
      parking: [],
      spawnAcc: 0,
      gateQueue: 0,
      enterAcc: 0,
      frustratedLeftToday: 0,
      parkLevel: 1,
      parkXp: 0,
      starterKit: {
        attractionId: "grand_carousel",
        stallId: "cotton_candy",
        attractionLeft: 1,
        stallLeft: 1,
        binLeft: 1,
        janitorLeft: 1,
        runnerLeft: 1,
      },
      daySummary: null,
      gameOver: false,
      gameOverReason: null,
      tick: 0,
    };
  }

  /** Night wage preview — shown next to cash in the HUD */
  nightWageCost(): number {
    return this.state.staff.length * NIGHT_WAGE_PER_STAFF;
  }

  /** True until the free carousel is placed and path-connected to the gate */
  bootstrapClockHeld(): boolean {
    if (this.state.gameOver || this.state.daySummary) return true;
    const kitId = this.state.starterKit.attractionId;
    const ride = this.state.attractions.find((a) => a.defId === kitId);
    if (!ride) return true;
    const def = getAttraction(ride.defId);
    if (!def) return true;
    return !this.isFacilityConnected(ride.pos, def.footprint.w, def.footprint.h);
  }

  /** Gate twins only → need at least one more path tile into the lot */
  hasOutboundPathFromGate(): boolean {
    let pathTiles = 0;
    for (let y = 0; y < this.grid.height; y++) {
      for (let x = 0; x < this.grid.width; x++) {
        if (this.grid.get(x, y) === "path") pathTiles += 1;
      }
    }
    return pathTiles > 2;
  }

  setTicketGateFee(fee: number): void {
    this.state.ticketGateFee = Math.max(5, Math.min(40, Math.round(fee)));
    this.state.message = `דמי כניסה: ₪${this.state.ticketGateFee}`;
    this.notify();
    this.persist();
  }

  confirmDayEnd(skipWagesWithGem: boolean): void {
    const summary = this.state.daySummary;
    if (!summary) return;
    let wages = summary.wages;
    if (skipWagesWithGem && this.state.gems >= 1 && wages > 0) {
      this.state.gems -= 1;
      wages = 0;
      this.state.message = "דילגתם על שכר הלילה עם יהלום";
    } else if (wages > 0) {
      this.state.cash -= wages;
      this.state.message = `שכר לילה: −₪${wages}`;
    }
    this.state.daySummary = null;
    this.state.timeOfDay = 9;
    this.state.day += 1;
    this.state.visitorsToday = 0;
    this.state.revenueToday = 0;
    this.state.expensesToday = wages > 0 ? wages : 0;
    this.state.frustratedLeftToday = 0;
    for (const a of this.state.attractions) a.revenueToday = 0;
    for (const s of this.state.stalls) s.revenueToday = 0;
    this.state.visitors = [];
    this.state.gateQueue = 0;
    if (this.state.cash < 0) {
      this.triggerGameOver("הקופה שלילית — הפארק פשט רגל");
    } else if (this.state.satisfaction <= 8) {
      this.triggerGameOver("שביעות הרצון קרסה — האורחים נטשו");
    } else {
      this.state.paused = false;
      this.engine.setPaused(false);
    }
    this.notify();
    this.persist();
  }

  private triggerGameOver(reason: string): void {
    this.state.gameOver = true;
    this.state.gameOverReason = reason;
    this.state.paused = true;
    this.engine.setPaused(true);
    this.state.message = reason;
  }

  restartPark(): void {
    this.occupy.clear();
    this.grid = new GridSystem();
    this.state = this.freshState();
    this.seedStarterPark();
    uidSeq = 1;
    this.engine.setPaused(false);
    this.notify();
    this.persist();
  }

  toSnapshot(): GameSnapshot {
    return {
      cash: this.state.cash,
      day: this.state.day,
      tick: this.state.tick,
      satisfaction: this.state.satisfaction,
      cleanliness: this.state.cleanliness,
      visitorsToday: this.state.visitorsToday,
      revenueToday: this.state.revenueToday,
      expensesToday: this.state.expensesToday,
      warehouseStock: this.state.warehouseStock,
      unlockedPlots: this.grid.plots.filter((p) => p.unlocked).map((p) => p.id),
      entranceLanes: this.state.entranceLanes,
      parkingBays: this.state.parkingBays,
      paused: this.state.paused,
      speed: this.state.speed,
      gems: this.state.gems,
      timeOfDay: this.state.timeOfDay,
      ticketGateFee: this.state.ticketGateFee,
      warehouseBuilt: this.state.warehouseBuilt,
      parkLevel: this.state.parkLevel,
      parkXp: this.state.parkXp,
      frustratedLeftToday: this.state.frustratedLeftToday,
      gameOver: this.state.gameOver,
      gameOverReason: this.state.gameOverReason,
      starterKit: { ...this.state.starterKit },
      attractions: this.state.attractions.map((a) => ({ ...a, pos: { ...a.pos }, queue: [...a.queue], riders: [...a.riders] })),
      stalls: this.state.stalls.map((s) => ({ ...s, pos: { ...s.pos }, queue: [...s.queue] })),
      staff: this.state.staff.map((s) => ({ ...s, pos: { ...s.pos }, path: s.path.map((p) => ({ ...p })), pixel: { ...s.pixel } })),
      trash: this.state.trash.map((t) => ({ ...t, pos: { ...t.pos } })),
      parking: this.state.parking.map((p) => ({ ...p, pos: { ...p.pos } })),
      visitors: this.state.visitors.map((v) => ({
        ...v,
        pos: { ...v.pos },
        path: v.path.map((p) => ({ ...p })),
        pixel: { ...v.pixel },
      })),
      grid: {
        width: this.grid.width,
        height: this.grid.height,
        tiles: this.grid.tiles.map((row) => row.slice() as TileKind[]),
        bins: [...this.grid.bins],
        benches: [...this.grid.benches],
        decor: [...this.grid.decor.entries()] as [string, DecorKind][],
        gatePos: { ...this.grid.gatePos },
        warehousePos: { ...this.grid.warehousePos },
      },
    };
  }

  applySnapshot(snap: GameSnapshot): void {
    if (!snap.grid?.tiles?.length) return;
    this.occupy.clear();
    this.grid = new GridSystem(snap.grid.width, snap.grid.height);
    this.grid.tiles = snap.grid.tiles.map((row) => row.slice() as TileKind[]);
    this.grid.bins = new Set(snap.grid.bins ?? []);
    this.grid.benches = new Set(snap.grid.benches ?? []);
    this.grid.decor = new Map(snap.grid.decor ?? []);
    if (snap.grid.gatePos) this.grid.gatePos = { ...snap.grid.gatePos };
    if (snap.grid.warehousePos) this.grid.warehousePos = { ...snap.grid.warehousePos };
    const unlocked = new Set(snap.unlockedPlots ?? ["starter"]);
    for (const plot of this.grid.plots) {
      plot.unlocked = unlocked.has(plot.id);
    }

    this.state.cash = snap.cash;
    this.state.day = snap.day;
    this.state.tick = snap.tick ?? 0;
    this.state.satisfaction = snap.satisfaction;
    this.state.cleanliness = snap.cleanliness;
    this.state.visitorsToday = snap.visitorsToday;
    this.state.revenueToday = snap.revenueToday;
    this.state.expensesToday = snap.expensesToday;
    this.state.warehouseStock = snap.warehouseStock;
    this.state.entranceLanes = snap.entranceLanes;
    this.state.parkingBays = snap.parkingBays;
    this.state.paused = snap.paused;
    this.state.speed = snap.speed;
    this.state.gems = snap.gems ?? this.state.gems;
    this.state.timeOfDay = snap.timeOfDay ?? 9;
    this.state.ticketGateFee = snap.ticketGateFee ?? 12;
    this.state.warehouseBuilt = snap.warehouseBuilt ?? false;
    this.state.parkLevel = snap.parkLevel ?? 1;
    this.state.parkXp = snap.parkXp ?? 0;
    this.state.frustratedLeftToday = snap.frustratedLeftToday ?? 0;
    this.state.gameOver = snap.gameOver ?? false;
    this.state.gameOverReason = snap.gameOverReason ?? null;
    this.state.daySummary = null;
    if (snap.starterKit) this.state.starterKit = { ...snap.starterKit };
    this.state.attractions = (snap.attractions ?? []).map((a) => ({
      ...a,
      pos: { ...a.pos },
      queue: [...(a.queue ?? [])],
      riders: [...(a.riders ?? [])],
    }));
    this.state.stalls = (snap.stalls ?? []).map((s) => ({
      ...s,
      pos: { ...s.pos },
      queue: [...(s.queue ?? [])],
      restockAcc: s.restockAcc ?? 0,
    }));
    this.state.staff = (snap.staff ?? []).map((s) => ({
      ...s,
      pos: { ...s.pos },
      path: (s.path ?? []).map((p) => ({ ...p })),
      pixel: { ...s.pixel },
    }));
    this.state.trash = (snap.trash ?? []).map((t) => ({ ...t, pos: { ...t.pos } }));
    this.state.parking = (snap.parking ?? []).map((p) => ({ ...p, pos: { ...p.pos } }));
    this.state.visitors = (snap.visitors ?? []).map((v) => ({
      ...v,
      pos: { ...v.pos },
      path: (v.path ?? []).map((p) => ({ ...p })),
      pixel: { ...v.pixel },
    }));
    this.state.buildMode = "none";
    this.state.selectedBuildId = null;
    this.state.selectedEntity = null;
    this.state.gateQueue = 0;
    this.state.spawnAcc = 0;
    this.state.enterAcc = 0;

    for (const a of this.state.attractions) {
      const def = getAttraction(a.defId);
      if (def) this.markOccupy(a.pos, def.footprint.w, def.footprint.h);
      bumpUidSeqFromId(a.uid);
    }
    for (const s of this.state.stalls) {
      this.markOccupy(s.pos, 1, 1);
      bumpUidSeqFromId(s.uid);
    }
    if (this.state.warehouseBuilt) this.occupy.add(keyOf(this.grid.warehousePos));
    for (const s of this.state.staff) bumpUidSeqFromId(s.id);
    for (const v of this.state.visitors) bumpUidSeqFromId(v.id);
    for (const t of this.state.trash) bumpUidSeqFromId(t.id);
    for (const p of this.state.parking) bumpUidSeqFromId(p.id);

    this.engine.setPaused(this.state.paused || this.state.gameOver);
    this.engine.setSpeed(this.state.speed);
  }

  private persist(): void {
    if (typeof localStorage === "undefined") return;
    writeSave(this.toSnapshot());
  }

  private seedStarterPark(): void {
    // Memory rule: empty lot + gate only. Parking / warehouse / paths / rides → build bank.
  }

  private addParkXp(amount: number): void {
    this.state.parkXp += amount;
    const need = 100 + this.state.parkLevel * 80;
    while (this.state.parkXp >= need) {
      this.state.parkXp -= need;
      this.state.parkLevel += 1;
      this.state.gems += 5;
      this.state.message = `🎉 רמת פארק ${this.state.parkLevel}! +5 יהלומים`;
    }
  }

  private earnCash(amount: number, at?: GridPos): void {
    this.state.cash += amount;
    this.state.revenueToday += amount;
    this.addParkXp(Math.max(1, Math.round(amount * 0.15)));
    if (at) {
      const c = this.cellCenter(at);
      fxSystem.spawnMoney(c.x, c.y - 0.35, amount);
    }
  }

  /** True when placing the designated free starter attraction/stall */
  private consumeStarterAttraction(defId: string): boolean {
    const kit = this.state.starterKit;
    if (kit.attractionLeft > 0 && defId === kit.attractionId) {
      kit.attractionLeft -= 1;
      return true;
    }
    return false;
  }

  private consumeStarterStall(defId: string): boolean {
    const kit = this.state.starterKit;
    if (kit.stallLeft > 0 && defId === kit.stallId) {
      kit.stallLeft -= 1;
      return true;
    }
    return false;
  }

  private consumeStarterBin(): boolean {
    const kit = this.state.starterKit;
    if (kit.binLeft > 0) {
      kit.binLeft -= 1;
      return true;
    }
    return false;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    for (const l of this.listeners) l();
    this.persistSoon();
  }

  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private persistSoon(): void {
    if (typeof localStorage === "undefined") return;
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.persist();
    }, 400);
  }

  start(): void {
    this.engine.start();
  }

  stop(): void {
    this.engine.stop();
  }

  setPaused(p: boolean): void {
    if (this.state.gameOver || this.state.daySummary) return;
    this.state.paused = p;
    this.engine.setPaused(p);
    this.notify();
  }

  setSpeed(s: 1 | 2 | 3): void {
    this.state.speed = s;
    this.engine.setSpeed(s);
    this.notify();
    this.persist();
  }

  setBuildMode(mode: BuildMode, buildId: string | null = null): void {
    this.state.buildMode = mode;
    this.state.selectedBuildId = buildId;
    this.state.message =
      mode === "none"
        ? null
        : mode === "path"
          ? "גררו על הדשא כדי לסלול שביל רציף (₪40 למשבצת)"
          : mode === "bin"
            ? "לחצו ליד שביל/דשא להציב פח — מפחית לכלוך ומשפר מצב רוח"
            : mode === "bench"
              ? "לחצו על שביל להציב ספסל — מבקרים יושבים ומצב הרוח עולה"
              : mode === "decor"
                ? "לחצו על דשא/שביל להציב נוי — פרחים, שיחים, עצים ופסלים משפרים מצב רוח"
                : mode === "demolish"
                  ? "לחצו לפירוק"
                  : mode === "expand"
                    ? "בחרו הרחבה מהתפריט"
                    : "לחצו על משבצת פנויה למיקום — אל תשכחו שביל מהכניסה!";
    this.notify();
  }

  /** Public toast helper (quests tip, etc.) */
  flashMessage(msg: string): void {
    this.state.message = msg;
    this.notify();
  }

  selectEntity(kind: "attraction" | "stall" | "staff", id: string): void {
    this.state.selectedEntity = { kind, id };
    this.state.buildMode = "none";
    this.notify();
  }

  clearSelection(): void {
    this.state.selectedEntity = null;
    this.notify();
  }

  private makeStaff(role: StaffMember["role"], pos: GridPos): StaffMember {
    const id = uid(role);
    const looks = personLooks(id);
    return {
      id,
      role,
      pos: { ...pos },
      pixel: this.cellCenter(pos),
      path: [],
      task: null,
      carryAmount: 0,
      busyTimer: 0,
      facing: looks.facing,
      walkPhase: looks.walkPhase,
      skin: looks.skin,
      hair: looks.hair,
    };
  }

  private cellCenter(p: GridPos): { x: number; y: number } {
    // pixel space in grid units for interpolation (not screen)
    return { x: p.x + 0.5, y: p.y + 0.5 };
  }

  private footprintKeys(pos: GridPos, w: number, h: number): string[] {
    const keys: string[] = [];
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        keys.push(keyOf({ x: pos.x + dx, y: pos.y + dy }));
      }
    }
    return keys;
  }

  private canPlace(pos: GridPos, w: number, h: number): boolean {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const p = { x: pos.x + dx, y: pos.y + dy };
        if (!this.grid.inBounds(p)) return false;
        if (!this.grid.isBuildableGrass(p)) return false;
        if (this.occupy.has(keyOf(p))) return false;
      }
    }
    return true;
  }

  private markOccupy(pos: GridPos, w: number, h: number): void {
    for (const k of this.footprintKeys(pos, w, h)) this.occupy.add(k);
  }

  private clearOccupy(pos: GridPos, w: number, h: number): void {
    for (const k of this.footprintKeys(pos, w, h)) this.occupy.delete(k);
  }

  placeAttraction(defId: string, pos: GridPos, free = false): boolean {
    const def = getAttraction(defId);
    if (!def) return false;
    if (!this.canPlace(pos, def.footprint.w, def.footprint.h)) return false;
    const fromKit = !free && this.state.starterKit.attractionLeft > 0 && defId === this.state.starterKit.attractionId;
    if (fromKit && !this.hasOutboundPathFromGate()) {
      this.state.message = "קודם סללו שביל מהשער — ואז הציבו את הקרוסלה החינמית";
      this.notify();
      return false;
    }
    const isFree = free || fromKit;
    const cost = isFree ? 0 : Math.round(300 + def.excitementScore * 12);
    if (this.state.cash < cost) {
      this.state.message = "אין מספיק מזומן למתקן";
      this.notify();
      return false;
    }
    if (fromKit) this.consumeStarterAttraction(defId);
    this.state.cash -= cost;
    if (cost > 0) this.state.expensesToday += cost;
    this.markOccupy(pos, def.footprint.w, def.footprint.h);
    this.state.attractions.push({
      uid: uid("attr"),
      defId,
      pos: { ...pos },
      tier: 1,
      durability: 100,
      queue: [],
      riders: [],
      rideTimer: 0,
      broken: false,
      revenueToday: 0,
    });
    const connected = this.isFacilityConnected(pos, def.footprint.w, def.footprint.h);
    this.state.message = fromKit
      ? connected
        ? `הותקן מערכה: ${def.nameHe}`
        : `הותקן מערכה: ${def.nameHe} — סללו שביל מהכניסה עד המתקן!`
      : connected
        ? `נבנה: ${def.nameHe}`
        : `נבנה: ${def.nameHe} — בלי שביל המבקרים לא יגיעו. סללו שביל!`;
    this.notify();
    return true;
  }

  placeStall(defId: string, pos: GridPos, free = false): boolean {
    const def = getStall(defId);
    if (!def) return false;
    if (!this.canPlace(pos, 1, 1)) return false;
    const fromKit = !free && this.state.starterKit.stallLeft > 0 && defId === this.state.starterKit.stallId;
    if (fromKit && !this.hasOutboundPathFromGate()) {
      this.state.message = "קודם סללו שביל מהשער — ואז הציבו את הדוכן החינמי";
      this.notify();
      return false;
    }
    const isFree = free || fromKit;
    const cost = isFree ? 0 : stallBuildCost(def);
    if (this.state.cash < cost) {
      this.state.message = "אין מספיק מזומן לדוכן";
      this.notify();
      return false;
    }
    if (fromKit) this.consumeStarterStall(defId);
    this.state.cash -= cost;
    if (cost > 0) this.state.expensesToday += cost;
    this.markOccupy(pos, 1, 1);
    // Small starter stock until a warehouse exists (full cap once warehouse is built)
    const cap = stallStockCap(def, 1);
    const startStock = this.state.warehouseBuilt ? cap : Math.min(12, Math.max(6, Math.floor(cap * 0.35)));
    this.state.stalls.push({
      uid: uid("stall"),
      defId,
      pos: { ...pos },
      tier: 1,
      stock: startStock,
      queue: [],
      servingTimer: 0,
      revenueToday: 0,
      awaitingRestock: false,
      restockAcc: 0,
    });
    const connected = this.isFacilityConnected(pos, 1, 1);
    this.state.message = fromKit
      ? connected
        ? `הותקן מערכה: ${def.nameHe}`
        : `הותקן מערכה: ${def.nameHe} — חברו שביל מהכניסה לדוכן!`
      : connected
        ? `נפתח: ${def.nameHe}`
        : `נפתח: ${def.nameHe} — בלי שביל הלקוחות לא יגיעו!`;
    this.notify();
    return true;
  }

  /** Place a single path tile; returns true if a new tile was laid */
  placePath(pos: GridPos, quiet = false): boolean {
    if (!this.grid.isBuildableGrass(pos) || this.occupy.has(keyOf(pos))) return false;
    const cost = 40;
    if (this.state.cash < cost) {
      if (!quiet) {
        this.state.message = "אין מספיק כסף לשביל";
        this.notify();
      }
      return false;
    }
    this.state.cash -= cost;
    this.state.expensesToday += cost;
    this.grid.set(pos.x, pos.y, "path");
    if (!quiet) this.state.message = "שביל נסלל — גררו להמשך";
    this.notify();
    return true;
  }

  placeBin(pos: GridPos): boolean {
    const tile = this.grid.get(pos.x, pos.y);
    if (!(this.grid.isWalkable(pos) || tile === "grass")) {
      this.state.message = "פח רק על שביל או דשא";
      this.notify();
      return false;
    }
    if (this.occupy.has(keyOf(pos))) {
      this.state.message = "לא ניתן להציב פח על מתקן או דוכן";
      this.notify();
      return false;
    }
    if (this.grid.bins.has(keyOf(pos))) {
      this.state.message = "כבר יש פח כאן";
      this.notify();
      return false;
    }
    if (this.grid.benches.has(keyOf(pos)) || this.grid.decor.has(keyOf(pos))) {
      this.state.message = "המשבצת תפוסה — בחרו מקום אחר";
      this.notify();
      return false;
    }
    const fromKit = this.state.starterKit.binLeft > 0;
    const cost = fromKit ? 0 : BIN_COST;
    if (this.state.cash < cost) {
      this.state.message = "אין מספיק מזומן לפח";
      this.notify();
      return false;
    }
    if (fromKit) this.consumeStarterBin();
    this.state.cash -= cost;
    if (cost > 0) this.state.expensesToday += cost;
    this.grid.bins.add(keyOf(pos));
    // Immediately clear litter in coverage so the player feels the effect
    this.clearTrashNear(pos, BIN_RADIUS);
    const n = this.grid.bins.size;
    this.state.message = fromKit
      ? `פח מערכה הותקן · ${n} פחים בפארק`
      : `פח אשפה הוצב (₪${cost}) · ${n} פחים — פחות לכלוך, מבקרים מרוצים יותר`;
    this.notify();
    return true;
  }

  binCount(): number {
    return this.grid.bins.size;
  }

  /** True if a bin covers this cell within BIN_RADIUS */
  hasBinCoverage(pos: GridPos): boolean {
    for (const k of this.grid.bins) {
      const [x, y] = k.split(",").map(Number);
      if (Math.abs(x! - pos.x) + Math.abs(y! - pos.y) <= BIN_RADIUS) return true;
    }
    return false;
  }

  private clearTrashNear(pos: GridPos, radius: number): void {
    this.state.trash = this.state.trash.filter((t) => {
      const d = Math.abs(t.pos.x - pos.x) + Math.abs(t.pos.y - pos.y);
      return d > radius;
    });
  }

  placeBench(pos: GridPos): boolean {
    if (!this.grid.isWalkable(pos) && this.grid.get(pos.x, pos.y) !== "grass") {
      this.state.message = "ספסל רק על שביל או דשא";
      this.notify();
      return false;
    }
    if (this.occupy.has(keyOf(pos))) {
      this.state.message = "לא ניתן להציב ספסל על מתקן או דוכן";
      this.notify();
      return false;
    }
    if (this.grid.bins.has(keyOf(pos))) {
      this.state.message = "כבר יש פח כאן — בחרו משבצת אחרת";
      this.notify();
      return false;
    }
    if (this.grid.benches.has(keyOf(pos)) || this.grid.decor.has(keyOf(pos))) {
      this.state.message = "המשבצת תפוסה — בחרו מקום אחר";
      this.notify();
      return false;
    }
    if (this.state.cash < BENCH_COST) {
      this.state.message = "אין מספיק מזומן לספסל";
      this.notify();
      return false;
    }
    this.state.cash -= BENCH_COST;
    this.state.expensesToday += BENCH_COST;
    this.grid.benches.add(keyOf(pos));
    if (this.grid.get(pos.x, pos.y) === "grass") {
      this.grid.set(pos.x, pos.y, "path");
    }
    const n = this.grid.benches.size;
    this.state.message = `ספסל הוצב (₪${BENCH_COST}) · ${n} ספסלים — אורחים יושבים ונחים`;
    this.notify();
    return true;
  }

  benchCount(): number {
    return this.grid.benches.size;
  }

  /** Place a parking bay from the build bank (not pre-seeded on the lot). */
  placeParking(pos: GridPos): boolean {
    if (!this.grid.isBuildableGrass(pos) || this.occupy.has(keyOf(pos))) {
      this.state.message = "חניה רק על דשא פנוי";
      this.notify();
      return false;
    }
    if (this.grid.bins.has(keyOf(pos)) || this.grid.benches.has(keyOf(pos)) || this.grid.decor.has(keyOf(pos))) {
      this.state.message = "המשבצת תפוסה";
      this.notify();
      return false;
    }
    if (this.state.parkingBays >= 18) {
      this.state.message = "הגעתם למקסימום חניות";
      this.notify();
      return false;
    }
    const cost = 800;
    if (this.state.cash < cost) {
      this.state.message = "אין מספיק מזומן לחניה";
      this.notify();
      return false;
    }
    this.state.cash -= cost;
    this.state.expensesToday += cost;
    this.grid.set(pos.x, pos.y, "parking");
    this.state.parkingBays += 1;
    this.state.parking.push({
      id: uid("park"),
      pos: { ...pos },
      occupied: false,
      carColor: rand(CAR_COLORS),
      timer: 0,
    });
    this.state.message = `מקום חניה נוסף · ${this.state.parkingBays}/18`;
    this.setBuildMode("none");
    this.notify();
    return true;
  }

  /** Place logistics warehouse from the build bank. */
  placeWarehouse(pos: GridPos): boolean {
    if (this.state.warehouseBuilt) {
      this.state.message = "כבר יש מחסן בפארק";
      this.notify();
      return false;
    }
    if (!this.grid.isBuildableGrass(pos) || this.occupy.has(keyOf(pos))) {
      this.state.message = "מחסן רק על דשא פנוי";
      this.notify();
      return false;
    }
    const cost = 1200;
    if (this.state.cash < cost) {
      this.state.message = "אין מספיק מזומן למחסן";
      this.notify();
      return false;
    }
    this.state.cash -= cost;
    this.state.expensesToday += cost;
    this.grid.warehousePos = { ...pos };
    // Small service path under warehouse so staff can stand there
    this.grid.set(pos.x, pos.y, "path");
    this.state.warehouseBuilt = true;
    this.state.warehouseStock = 20;
    this.occupy.add(keyOf(pos));
    this.state.message = "מחסן לוגיסטיקה הוצב — הזמינו מלאי מהתפריט";
    this.setBuildMode("none");
    this.notify();
    return true;
  }

  placeDecor(kind: DecorKind, pos: GridPos): boolean {
    const def = getDecor(kind);
    if (!def) return false;
    const tile = this.grid.get(pos.x, pos.y);
    if (!(this.grid.isWalkable(pos) || tile === "grass")) {
      this.state.message = "נוי רק על שביל או דשא";
      this.notify();
      return false;
    }
    if (this.occupy.has(keyOf(pos))) {
      this.state.message = "לא ניתן להציב נוי על מתקן או דוכן";
      this.notify();
      return false;
    }
    if (this.grid.bins.has(keyOf(pos)) || this.grid.benches.has(keyOf(pos)) || this.grid.decor.has(keyOf(pos))) {
      this.state.message = "המשבצת תפוסה — בחרו מקום אחר";
      this.notify();
      return false;
    }
    if (this.state.cash < def.cost) {
      this.state.message = `אין מספיק מזומן ל${def.nameHe}`;
      this.notify();
      return false;
    }
    this.state.cash -= def.cost;
    this.state.expensesToday += def.cost;
    this.grid.decor.set(keyOf(pos), kind);
    const n = this.grid.decor.size;
    this.state.message = `${def.nameHe} הוצב (₪${def.cost}) · ${n} פריטי נוי — מצב הרוח עולה`;
    this.notify();
    return true;
  }

  decorCount(): number {
    return this.grid.decor.size;
  }

  /** Best mood/sec aura from scenery covering this cell */
  decorMoodAura(pos: GridPos): number {
    let best = 0;
    for (const [k, kind] of this.grid.decor) {
      const def = getDecor(kind);
      if (!def) continue;
      const [x, y] = k.split(",").map(Number);
      const d = Math.abs(x! - pos.x) + Math.abs(y! - pos.y);
      if (d <= def.radius) best = Math.max(best, def.moodPerSec);
    }
    return best;
  }

  handleTileClick(pos: GridPos): void {
    const { buildMode, selectedBuildId } = this.state;
    if (buildMode === "path") {
      this.placePath(pos);
    } else if (buildMode === "bin") {
      this.placeBin(pos);
    } else if (buildMode === "bench") {
      this.placeBench(pos);
    } else if (buildMode === "parking") {
      this.placeParking(pos);
    } else if (buildMode === "warehouse") {
      this.placeWarehouse(pos);
    } else if (buildMode === "decor" && selectedBuildId) {
      this.placeDecor(selectedBuildId as DecorKind, pos);
    } else if (buildMode === "attraction" && selectedBuildId) {
      this.placeAttraction(selectedBuildId, pos);
    } else if (buildMode === "stall" && selectedBuildId) {
      this.placeStall(selectedBuildId, pos);
    } else if (buildMode === "demolish") {
      this.demolishAt(pos);
    } else {
      // select nearby entity
      const attr = this.state.attractions.find(
        (a) =>
          pos.x >= a.pos.x &&
          pos.y >= a.pos.y &&
          pos.x < a.pos.x + (getAttraction(a.defId)?.footprint.w ?? 1) &&
          pos.y < a.pos.y + (getAttraction(a.defId)?.footprint.h ?? 1),
      );
      if (attr) {
        this.selectEntity("attraction", attr.uid);
        return;
      }
      const stall = this.state.stalls.find((s) => s.pos.x === pos.x && s.pos.y === pos.y);
      if (stall) {
        this.selectEntity("stall", stall.uid);
        return;
      }
      this.clearSelection();
    }
    this.notify();
  }

  demolishAt(pos: GridPos): void {
    const cellKey = keyOf(pos);
    if (this.grid.bins.has(cellKey)) {
      this.grid.bins.delete(cellKey);
      const refund = Math.floor(BIN_COST * 0.4);
      this.state.cash += refund;
      this.state.message = `פח פורק (+₪${refund})`;
      return;
    }
    if (this.grid.benches.has(cellKey)) {
      this.grid.benches.delete(cellKey);
      const refund = Math.floor(BENCH_COST * 0.4);
      this.state.cash += refund;
      this.state.message = `ספסל פורק (+₪${refund})`;
      return;
    }
    const decorKind = this.grid.decor.get(cellKey);
    if (decorKind) {
      const def = getDecor(decorKind);
      this.grid.decor.delete(cellKey);
      const refund = Math.floor((def?.cost ?? 40) * (def?.refundRate ?? 0.4));
      this.state.cash += refund;
      this.state.message = `${def?.nameHe ?? "נוי"} פורק (+₪${refund})`;
      return;
    }
    const ai = this.state.attractions.findIndex(
      (a) =>
        pos.x >= a.pos.x &&
        pos.y >= a.pos.y &&
        pos.x < a.pos.x + (getAttraction(a.defId)?.footprint.w ?? 1) &&
        pos.y < a.pos.y + (getAttraction(a.defId)?.footprint.h ?? 1),
    );
    if (ai >= 0) {
      const a = this.state.attractions[ai]!;
      const def = getAttraction(a.defId)!;
      this.clearOccupy(a.pos, def.footprint.w, def.footprint.h);
      this.state.attractions.splice(ai, 1);
      this.state.message = "מתקן פורק";
      return;
    }
    const si = this.state.stalls.findIndex((s) => s.pos.x === pos.x && s.pos.y === pos.y);
    if (si >= 0) {
      const s = this.state.stalls[si]!;
      this.clearOccupy(s.pos, 1, 1);
      this.state.stalls.splice(si, 1);
      this.state.message = "דוכן פורק";
    }
  }

  buyExpansion(plotId: string): void {
    const plot = this.grid.plots.find((p) => p.id === plotId);
    if (!plot || plot.unlocked) return;
    if (this.state.cash < plot.cost) {
      this.state.message = "אין מספיק מזומן להרחבה";
      this.notify();
      return;
    }
    this.state.cash -= plot.cost;
    this.state.expensesToday += plot.cost;
    this.grid.unlockPlot(plotId);
    this.state.message = `נפתח אזור חדש: ${plotId}`;
    this.notify();
  }

  upgradeAttraction(uidStr: string): void {
    const a = this.state.attractions.find((x) => x.uid === uidStr);
    if (!a || a.tier >= 5) return;
    const def = getAttraction(a.defId);
    if (!def) return;
    const cost = attractionUpgradeCost(def, a.tier);
    if (this.state.cash < cost) {
      this.state.message = "אין מספיק מזומן לשדרוג";
      this.notify();
      return;
    }
    this.state.cash -= cost;
    this.state.expensesToday += cost;
    a.tier += 1;
    a.durability = Math.min(100, a.durability + 20);
    a.broken = false;
    this.state.message = `${def.nameHe} שודרג לרמה ${a.tier}`;
    this.notify();
  }

  upgradeStall(uidStr: string): void {
    const s = this.state.stalls.find((x) => x.uid === uidStr);
    if (!s || s.tier >= 5) return;
    const def = getStall(s.defId);
    if (!def) return;
    const cost = stallUpgradeCost(def, s.tier);
    if (this.state.cash < cost) {
      this.state.message = "אין מספיק מזומן לשדרוג";
      this.notify();
      return;
    }
    this.state.cash -= cost;
    this.state.expensesToday += cost;
    s.tier += 1;
    s.stock = stallStockCap(def, s.tier);
    this.state.message = `${def.nameHe} שודרג לרמה ${s.tier}`;
    this.notify();
  }

  hireStaff(role: StaffMember["role"]): void {
    const costs: Record<StaffMember["role"], number> = { janitor: 600, runner: 700, mechanic: 900 };
    let cost = costs[role];
    if (role === "janitor" && this.state.starterKit.janitorLeft > 0) {
      this.state.starterKit.janitorLeft -= 1;
      cost = 0;
    } else if (role === "runner" && this.state.starterKit.runnerLeft > 0) {
      this.state.starterKit.runnerLeft -= 1;
      cost = 0;
    }
    if (this.state.cash < cost) {
      this.state.message = "אין מספיק מזומן לגיוס צוות";
      this.notify();
      return;
    }
    if (cost > 0) {
      this.state.cash -= cost;
      this.state.expensesToday += cost;
    }
    const spawnAt = this.state.warehouseBuilt
      ? { ...this.grid.warehousePos }
      : { ...this.grid.gatePos };
    this.state.staff.push(this.makeStaff(role, spawnAt));
    this.state.message =
      cost === 0
        ? `צוות ${role} מהערכה החינמית הצטרף!`
        : `גויס ${role} — ₪${cost}`;
    this.notify();
  }

  buyWarehouseStock(amount = 40): void {
    if (!this.state.warehouseBuilt) {
      this.state.message = "בנו מחסן מבנק הבנייה לפני הזמנת מלאי";
      this.notify();
      return;
    }
    const cost = amount * 3;
    if (this.state.cash < cost) return;
    this.state.cash -= cost;
    this.state.expensesToday += cost;
    this.state.warehouseStock += amount;
    this.state.message = `המחסן התמלא (+${amount})`;
    this.notify();
  }

  upgradeEntrance(): void {
    if (this.state.entranceLanes >= 4) return;
    const cost = 1500 * this.state.entranceLanes;
    if (this.state.cash < cost) return;
    this.state.cash -= cost;
    this.state.entranceLanes += 1;
    this.state.message = `נתיב כניסה נוסף (${this.state.entranceLanes})`;
    this.notify();
  }

  upgradeParking(): void {
    // Prefer placing via build bank; this keeps a logistics shortcut that opens place mode.
    this.setBuildMode("parking");
    this.state.message = "בחרו משבצת דשא להצבת חניה (₪800)";
    this.notify();
  }

  repairAttraction(uidStr: string): void {
    const a = this.state.attractions.find((x) => x.uid === uidStr);
    if (!a) return;
    const cost = 350;
    if (this.state.cash < cost) return;
    this.state.cash -= cost;
    a.durability = 100;
    a.broken = false;
    this.state.message = "המתקן תוקן";
    this.notify();
  }

  // ——— Simulation tick ———
  private tick(dt: number): void {
    this.state.tick += 1;
    if (this.state.gameOver || this.state.daySummary) {
      fxSystem.update(dt);
      this.notify();
      return;
    }

    // Clock stays frozen until the free carousel is path-connected to the gate
    if (this.bootstrapClockHeld()) {
      fxSystem.update(dt);
      this.notify();
      return;
    }

    this.state.timeOfDay += dt * 0.05;
    if (this.state.timeOfDay >= 22 && !this.state.daySummary) {
      const wages = this.nightWageCost();
      this.state.daySummary = {
        day: this.state.day,
        revenue: this.state.revenueToday,
        expenses: this.state.expensesToday,
        wages,
        visitors: this.state.visitorsToday,
        frustrated: this.state.frustratedLeftToday,
        cashBeforeWages: this.state.cash,
      };
      this.state.timeOfDay = 21.99;
      this.state.paused = true;
      this.engine.setPaused(true);
      this.state.message = `סיכום יום ${this.state.day}`;
      this.notify();
      return;
    }

    this.spawnFlow(dt);
    this.updateVisitors(dt);
    this.updateAttractions(dt);
    this.updateStalls(dt);
    this.updateStaff(dt);
    this.updateBinCleaning(dt);
    this.updateSatisfaction(dt);
    this.emitAmbientFx(dt);
    fxSystem.update(dt);

    if (this.state.cash < 0) {
      this.triggerGameOver("הקופה שלילית — הפארק פשט רגל");
    } else if (this.state.satisfaction <= 8 && this.state.day > 1) {
      this.triggerGameOver("שביעות הרצון קרסה — האורחים נטשו");
    }
    this.notify();
  }

  private emitAmbientFx(dt: number): void {
    for (const a of this.state.attractions) {
      if (a.broken && Math.random() < dt * 1.4) {
        const def = getAttraction(a.defId);
        const cx = a.pos.x + (def?.footprint.w ?? 1) / 2;
        const cy = a.pos.y + (def?.footprint.h ?? 1) / 2;
        fxSystem.spawnSmoke(cx, cy);
      }
    }
    for (const v of this.state.visitors) {
      if (v.thoughtTimer > 0) {
        v.thoughtTimer -= dt;
        if (v.thoughtTimer <= 0) v.thoughtEmoji = null;
      }
      if (v.interactTimer > 0) v.interactTimer = Math.max(0, v.interactTimer - dt);

      // רעב / צמא עולים עם הזמן
      if (v.state !== "riding" && v.state !== "leaving") {
        v.hunger = Math.min(100, v.hunger + dt * (v.ageBand === "child" ? 1.6 : 1.15));
        v.thirst = Math.min(100, v.thirst + dt * 1.05);
        if (v.hunger > 72) this.hurtMood(v, dt * 0.55);
        if (v.thirst > 72) this.hurtMood(v, dt * 0.45);
      }

      if (v.thoughtEmoji) continue;
      if (v.state === "wandering" || v.state === "entering") {
        if (v.hunger > 70 && Math.random() < dt * 0.12) {
          this.flashThought(v, "🍔");
        } else if (v.thirst > 70 && Math.random() < dt * 0.12) {
          this.flashThought(v, "🥤");
        } else if (v.mood >= 80 && Math.random() < dt * 0.05) {
          this.flashThought(v, "😊");
        } else if (v.mood < 55 && Math.random() < dt * 0.06) {
          const hasBalloonStall = this.state.stalls.some((s) => getStall(s.defId)?.icon === "balloon");
          if (!hasBalloonStall && Math.random() < 0.35) this.flashThought(v, "🎈");
          else if (v.mood < 40) this.flashThought(v, "😡");
        }
      }
    }
  }

  private spawnFlow(dt: number): void {
    const hour = this.state.timeOfDay;
    const peak = hour > 11 && hour < 18 ? 1.4 : 0.7;
    const demand = (0.9 + this.state.satisfaction / 180) * peak * (0.8 + this.state.parkingBays / 18);
    this.state.spawnAcc += dt * demand;

    while (this.state.spawnAcc >= 1) {
      this.state.spawnAcc -= 1;
      if (this.state.visitors.length >= 55) break;
      const freeSpot = this.state.parking.find((p) => !p.occupied);
      if (freeSpot) {
        freeSpot.occupied = true;
        freeSpot.carColor = rand(CAR_COLORS);
        freeSpot.timer = 12 + Math.random() * 20;
        this.state.gateQueue += 1;
      } else {
        // walk-ins when parking is full
        if (Math.random() < 0.55) this.state.gateQueue += 1;
      }
    }

    const throughput = this.state.entranceLanes * 1.8;
    this.state.enterAcc += throughput * dt;
    while (this.state.enterAcc >= 1 && this.state.gateQueue > 0) {
      this.state.enterAcc -= 1;
      this.state.gateQueue -= 1;
      this.spawnVisitor();
    }

    for (const p of this.state.parking) {
      if (!p.occupied) continue;
      p.timer -= dt;
      if (p.timer <= 0) p.occupied = false;
    }
  }

  private spawnVisitor(): void {
    // Gate fee is charged only when the guest first boards a ride — not at spawn.
    this.state.visitorsToday += 1;
    const start = { ...this.grid.gatePos };
    const id = uid("vis");
    const looks = personLooks(id);
    const archetype = hashStr(id) % VISITOR_SHEET.archetypeCount;
    const ageBand = visitorAgeBand(archetype);
    const v: Visitor = {
      id,
      pos: { ...start },
      pixel: this.cellCenter(start),
      path: [],
      state: "entering",
      mood: 70 + Math.random() * 20,
      wallet: ageBand === "child" ? 25 + Math.random() * 40 : 40 + Math.random() * 80,
      targetId: null,
      rideTimer: 0,
      restTimer: 0,
      color: rand(VISITOR_COLORS),
      litterCooldown: 8 + Math.random() * 20,
      archetype,
      ageBand,
      hunger: 15 + Math.random() * 35,
      thirst: 10 + Math.random() * 30,
      heldProp: "none",
      interactTimer: 0,
      thoughtEmoji: null,
      thoughtTimer: 0,
      paidAdmission: false,
      facing: looks.facing,
      walkPhase: looks.walkPhase,
      talkTimer: 0,
      talkPartnerId: null,
      skin: looks.skin,
      hair: looks.hair,
    };
    this.assignVisitorGoal(v);
    this.state.visitors.push(v);
  }

  /** Walkable tiles adjacent to a facility footprint (queue / entry points) */
  entryTiles(pos: GridPos, w: number, h: number): GridPos[] {
    const occupied = new Set(this.footprintKeys(pos, w, h));
    const entries: GridPos[] = [];
    const seen = new Set<string>();
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        for (const n of this.grid.neighbors4({ x: pos.x + dx, y: pos.y + dy })) {
          const k = keyOf(n);
          if (occupied.has(k) || seen.has(k)) continue;
          if (!this.grid.isWalkable(n)) continue;
          seen.add(k);
          entries.push(n);
        }
      }
    }
    return entries;
  }

  /** Shortest walkable path from `from` to any entry tile of the facility */
  pathToFacility(from: GridPos, pos: GridPos, w: number, h: number): GridPos[] {
    const entries = this.entryTiles(pos, w, h);
    if (!entries.length) return [];
    let best: GridPos[] = [];
    for (const e of entries) {
      const p = astar(this.grid, from, e);
      if (p.length && (!best.length || p.length < best.length)) best = p;
    }
    return best;
  }

  /** True if guests can walk from the gate to an entry next to this facility */
  isFacilityConnected(pos: GridPos, w: number, h: number): boolean {
    return this.pathToFacility(this.grid.gatePos, pos, w, h).length > 0;
  }

  private atFacilityEntry(guestPos: GridPos, pos: GridPos, w: number, h: number): boolean {
    return this.entryTiles(pos, w, h).some((e) => e.x === guestPos.x && e.y === guestPos.y);
  }

  private nearestPath(pos: GridPos): GridPos {
    if (this.grid.isWalkable(pos)) return pos;
    const n = this.grid.neighbors4(pos).find((p) => this.grid.isWalkable(p));
    return n ?? pos;
  }

  private clampMood(v: Visitor): void {
    v.mood = Math.max(0, Math.min(100, v.mood));
  }

  private isFrustrated(v: Visitor): boolean {
    return v.mood <= MOOD_LEAVE_THRESHOLD;
  }

  /** Remove guest from all ride/stall queues so they stop blocking and stop spending */
  private detachFromQueues(v: Visitor): void {
    for (const a of this.state.attractions) {
      a.queue = a.queue.filter((id) => id !== v.id);
      a.riders = a.riders.filter((id) => id !== v.id);
    }
    for (const s of this.state.stalls) {
      s.queue = s.queue.filter((id) => id !== v.id);
    }
  }

  /** Storm out — no more wallet spend inside the park */
  private beginFrustratedLeave(v: Visitor): void {
    if (v.state === "leaving" && v.angryLeave) return;
    const wasInside = v.state !== "leaving";
    this.detachFromQueues(v);
    v.angryLeave = true;
    v.state = "leaving";
    v.targetId = null;
    v.restTimer = 0;
    const leave = astar(this.grid, v.pos, this.grid.gatePos);
    v.path = leave.length ? leave : [];
    if (!leave.length) {
      v.pos = { ...this.grid.gatePos };
      v.pixel = this.cellCenter(v.pos);
    }
    if (wasInside) {
      this.state.frustratedLeftToday += 1;
      if (this.state.frustratedLeftToday === 1 || this.state.frustratedLeftToday % 4 === 0) {
        this.state.message =
          "מבקרים מתוסכלים עוזבים בלי לקנות! קצרו תורים, סללו שבילים ונקו — אחרת אין הכנסות.";
      }
    }
  }

  private hurtMood(v: Visitor, amount: number): boolean {
    if (v.angryLeave || v.state === "leaving") {
      v.mood -= amount;
      this.clampMood(v);
      return true;
    }
    const before = v.mood;
    v.mood -= amount;
    this.clampMood(v);
    if (amount >= 8 || before - v.mood >= 10) {
      this.flashThought(v, v.mood < 40 ? "😡" : "😤");
    }
    // Mid-ride: finish the cycle, then assignVisitorGoal will eject them
    if (this.isFrustrated(v) && v.state !== "riding") {
      this.beginFrustratedLeave(v);
      return true;
    }
    return false;
  }

  private boostMood(v: Visitor, amount: number, feedback: string | false | undefined = undefined): void {
    v.mood += amount;
    this.clampMood(v);
    if (feedback === false) return;
    if (typeof feedback === "string") {
      this.flashThought(v, feedback);
      return;
    }
    if (amount >= 10) {
      this.flashThought(v, v.mood >= 85 ? "😊" : "✨");
    }
  }

  private flashThought(v: Visitor, emoji: string): void {
    v.thoughtEmoji = emoji;
    v.thoughtTimer = 2.2;
    fxSystem.spawnEmoji(v.pixel.x, v.pixel.y, emoji);
  }

  private trashNear(pos: GridPos): boolean {
    return this.state.trash.some(
      (t) => Math.abs(t.pos.x - pos.x) + Math.abs(t.pos.y - pos.y) <= 1 && t.amount > 0,
    );
  }

  private assignVisitorGoal(v: Visitor): void {
    if (v.angryLeave || this.isFrustrated(v)) {
      this.beginFrustratedLeave(v);
      return;
    }

    // Low-but-not-yet-leaving mood → higher chance to bail early
    const leaveChance = 0.1 + Math.max(0, (50 - v.mood) / 200);
    const roll = Math.random();
    if (roll < leaveChance || this.state.visitors.length > 55) {
      v.state = "leaving";
      v.targetId = null;
      const leave = astar(this.grid, v.pos, this.grid.gatePos);
      v.path = leave.length ? leave : [];
      if (!leave.length) {
        v.pos = { ...this.grid.gatePos };
        v.pixel = this.cellCenter(v.pos);
      }
      return;
    }

    // Tired / mid mood → sit on a bench between rides
    const wantRest =
      this.grid.benches.size > 0 &&
      v.mood < 78 &&
      (roll < 0.22 || (v.mood < 55 && Math.random() < 0.45));
    if (wantRest && this.goToBench(v)) return;

    if (roll < 0.55 && this.state.attractions.length) {
      const open = this.state.attractions.filter((a) => {
        if (a.broken) return false;
        const def = getAttraction(a.defId);
        if (!def) return false;
        return this.pathToFacility(v.pos, a.pos, def.footprint.w, def.footprint.h).length > 0;
      });
      if (open.length) {
        const a = rand(open);
        const def = getAttraction(a.defId)!;
        v.state = "wandering";
        v.targetId = a.uid;
        v.path = this.pathToFacility(v.pos, a.pos, def.footprint.w, def.footprint.h);
        return;
      }
    }

    const reachableStalls = this.state.stalls.filter(
      (s) => this.pathToFacility(v.pos, s.pos, 1, 1).length > 0,
    );
    const stocked = reachableStalls.filter((s) => s.stock > 0);
    const pool = stocked.length ? stocked : reachableStalls;
    if (pool.length) {
      const s = rand(pool);
      v.state = "wandering";
      v.targetId = s.uid;
      v.path = this.pathToFacility(v.pos, s.pos, 1, 1);
      return;
    }

    const roamTarget = this.randomWalkableNear(v.pos);
    if (roamTarget) {
      v.targetId = null;
      v.state = "wandering";
      v.path = astar(this.grid, v.pos, roamTarget);
      return;
    }
    v.state = "leaving";
    v.targetId = null;
    v.path = astar(this.grid, v.pos, this.grid.gatePos);
  }

  /** Path guest to a reachable bench; prefer less crowded seats */
  private goToBench(v: Visitor): boolean {
    if (!this.grid.benches.size) return false;
    const sitters = new Map<string, number>();
    for (const o of this.state.visitors) {
      if (o.state !== "resting" && !(o.targetId?.startsWith("bench:") && o.state === "wandering")) {
        continue;
      }
      const k =
        o.state === "resting"
          ? keyOf(o.pos)
          : (o.targetId?.slice("bench:".length) ?? "");
      if (!k) continue;
      sitters.set(k, (sitters.get(k) ?? 0) + 1);
    }

    let bestPath: GridPos[] = [];
    let bestKey = "";
    for (const k of this.grid.benches) {
      if ((sitters.get(k) ?? 0) >= 2) continue;
      const bench = parseKey(k);
      const path = astar(this.grid, v.pos, bench);
      if (!path.length) continue;
      if (!bestPath.length || path.length < bestPath.length) {
        bestPath = path;
        bestKey = k;
      }
    }
    if (!bestKey) return false;
    v.state = "wandering";
    v.targetId = `bench:${bestKey}`;
    v.path = bestPath;
    return true;
  }

  private startResting(v: Visitor): void {
    v.state = "resting";
    v.restTimer = 3.2 + Math.random() * 2.8;
    v.path = [];
    this.boostMood(v, 4);
  }

  private randomWalkableNear(from: GridPos): GridPos | null {
    const candidates: GridPos[] = [];
    for (let y = 0; y < this.grid.height; y++) {
      for (let x = 0; x < this.grid.width; x++) {
        if (this.grid.isWalkable({ x, y }) && Math.random() < 0.04) {
          candidates.push({ x, y });
        }
      }
    }
    if (!candidates.length) return null;
    const pick = rand(candidates);
    const path = astar(this.grid, from, pick);
    return path.length ? pick : null;
  }

  /**
   * Returns true when the entity finished its path.
   * Empty path = nowhere to go (NOT arrived at a goal) — returns false so callers don't join queues.
   */
  private moveAlongPath(
    entity: {
      pos: GridPos;
      pixel: { x: number; y: number };
      path: GridPos[];
      facing?: IsoFacing;
      walkPhase?: number;
    },
    dt: number,
    speed = 2.2,
  ): "moving" | "arrived" | "stuck" {
    if (!entity.path.length) return "stuck";
    const next = entity.path[0]!;
    const tx = next.x + 0.5;
    const ty = next.y + 0.5;
    const dx = tx - entity.pixel.x;
    const dy = ty - entity.pixel.y;
    const dist = Math.hypot(dx, dy);
    const step = speed * dt;
    if (dist > 0.0001) {
      if (entity.facing !== undefined) entity.facing = facingFromDelta(dx, dy);
      if (entity.walkPhase !== undefined) entity.walkPhase += dt * 11;
    }
    if (dist <= step) {
      entity.pixel.x = tx;
      entity.pixel.y = ty;
      entity.pos = { ...next };
      entity.path.shift();
      return entity.path.length === 0 ? "arrived" : "moving";
    }
    entity.pixel.x += (dx / dist) * step;
    entity.pixel.y += (dy / dist) * step;
    return "moving";
  }

  /** זוגות מבקרים סמוכים מדברים (בועת דיבור + בונוס מצב־רוח קטן) */
  private updateVisitorChatter(dt: number): void {
    for (const v of this.state.visitors) {
      if (v.talkTimer > 0) {
        v.talkTimer -= dt;
        if (v.talkTimer <= 0) {
          v.talkTimer = 0;
          v.talkPartnerId = null;
        }
      }
    }

    const idle = this.state.visitors.filter(
      (v) =>
        v.state === "wandering" &&
        v.path.length === 0 &&
        v.talkTimer <= 0 &&
        !v.angryLeave &&
        !v.targetId?.startsWith("bench:"),
    );

    for (let i = 0; i < idle.length; i++) {
      const a = idle[i]!;
      if (a.talkTimer > 0) continue;
      for (let j = i + 1; j < idle.length; j++) {
        const b = idle[j]!;
        if (b.talkTimer > 0) continue;
        const d = Math.hypot(a.pixel.x - b.pixel.x, a.pixel.y - b.pixel.y);
        if (d > 1.4) continue;
        if (Math.random() > dt * 0.4) continue;
        const dur = 2.8 + Math.random() * 2.2;
        a.talkTimer = dur;
        b.talkTimer = dur;
        a.talkPartnerId = b.id;
        b.talkPartnerId = a.id;
        a.facing = facingFromDelta(b.pixel.x - a.pixel.x, b.pixel.y - a.pixel.y);
        b.facing = facingFromDelta(a.pixel.x - b.pixel.x, a.pixel.y - b.pixel.y);
        this.boostMood(a, 2);
        this.boostMood(b, 2);
        break;
      }
    }
  }

  private updateVisitors(dt: number): void {
    this.updateVisitorChatter(dt);
    const remain: Visitor[] = [];
    for (const v of this.state.visitors) {
      if (v.path.length > 0 && v.talkTimer > 0) {
        v.talkTimer = 0;
        v.talkPartnerId = null;
      }
      v.litterCooldown -= dt;
      if (v.litterCooldown <= 0) {
        v.litterCooldown = 15 + Math.random() * 25;
        this.maybeDropTrash(v.pos);
      }

      // Dirt nearby steadily frustrates guests (bins in range soften it)
      if (this.trashNear(v.pos) && v.state !== "riding") {
        const drain = this.hasBinCoverage(v.pos) ? dt * 0.6 : dt * 2.2;
        if (this.hurtMood(v, drain)) {
          if (v.state === "leaving") {
            remain.push(v);
            continue;
          }
        }
      } else if (this.hasBinCoverage(v.pos) && v.state === "wandering" && Math.random() < dt * 0.15) {
        this.boostMood(v, 0.4);
      }

      // Scenery aura — statues / trees / bushes / flowers lift mood
      if (v.state !== "leaving" && v.state !== "riding" && !v.angryLeave) {
        const aura = this.decorMoodAura(v.pos);
        if (aura > 0) this.boostMood(v, aura * dt);
      }

      if (v.state === "riding") {
        remain.push(v);
        continue;
      }

      if (v.state === "resting") {
        v.restTimer -= dt;
        this.boostMood(v, dt * 4.5);
        if (v.restTimer <= 0) {
          v.restTimer = 0;
          v.targetId = null;
          this.assignVisitorGoal(v);
        }
        remain.push(v);
        continue;
      }

      // Already standing on the bench tile — sit without waiting for path arrival
      if (
        v.targetId?.startsWith("bench:") &&
        this.grid.benches.has(v.targetId.slice("bench:".length)) &&
        keyOf(v.pos) === v.targetId.slice("bench:".length)
      ) {
        this.startResting(v);
        remain.push(v);
        continue;
      }

      // Waiting in line: longer queue = faster mood crash → leave without paying
      if (v.state === "queuing") {
        const attr = this.state.attractions.find((a) => a.queue.includes(v.id));
        const idx = attr ? Math.max(0, attr.queue.indexOf(v.id)) : 0;
        if (this.hurtMood(v, dt * (1.8 + idx * 0.55))) {
          remain.push(v);
          continue;
        }
        remain.push(v);
        continue;
      }

      if (v.state === "dining") {
        const stall = this.state.stalls.find((s) => s.queue.includes(v.id));
        const idx = stall ? Math.max(0, stall.queue.indexOf(v.id)) : 0;
        if (this.hurtMood(v, dt * (1.2 + idx * 0.35))) {
          remain.push(v);
          continue;
        }
        remain.push(v);
        continue;
      }

      const leaveSpeed = v.angryLeave ? 3.2 : 2.4;
      const move = this.moveAlongPath(v, dt, leaveSpeed);
      if (move === "moving") {
        remain.push(v);
        continue;
      }

      if (move === "stuck") {
        // באמצע שיחה — נשארים במקום
        if (v.talkTimer > 0 && v.state === "wandering") {
          remain.push(v);
          continue;
        }
        if (this.hurtMood(v, 3)) {
          if (v.angryLeave) continue;
          remain.push(v);
          continue;
        }
        this.assignVisitorGoal(v);
        remain.push(v);
        continue;
      }

      if (v.state === "leaving") {
        // Arrived at gate — gone (lost spend if angryLeave)
        continue;
      }

      if (v.angryLeave || this.isFrustrated(v)) {
        this.beginFrustratedLeave(v);
        remain.push(v);
        continue;
      }

      if (v.targetId?.startsWith("bench:")) {
        const benchKey = v.targetId.slice("bench:".length);
        if (this.grid.benches.has(benchKey) && keyOf(v.pos) === benchKey) {
          this.startResting(v);
          remain.push(v);
          continue;
        }
        // Lost the bench — pick something else
        v.targetId = null;
        this.assignVisitorGoal(v);
        remain.push(v);
        continue;
      }

      if (v.targetId) {
        const attr = this.state.attractions.find((a) => a.uid === v.targetId);
        if (attr && !attr.broken) {
          const def = getAttraction(attr.defId);
          if (def && this.atFacilityEntry(v.pos, attr.pos, def.footprint.w, def.footprint.h)) {
            // Won't join absurd queues — leave angry instead of spending
            if (attr.queue.length >= 14) {
              if (!this.hurtMood(v, 18)) this.beginFrustratedLeave(v);
              remain.push(v);
              continue;
            }
            attr.queue.push(v.id);
            v.state = "queuing";
            if (attr.queue.length <= 3) this.boostMood(v, 4, "😊");
            else this.hurtMood(v, Math.min(12, attr.queue.length * 1.2));
            remain.push(v);
            continue;
          }
          if (!this.hurtMood(v, 4)) this.assignVisitorGoal(v);
          remain.push(v);
          continue;
        }
        const stall = this.state.stalls.find((s) => s.uid === v.targetId);
        if (stall) {
          if (!this.atFacilityEntry(v.pos, stall.pos, 1, 1)) {
            this.assignVisitorGoal(v);
            remain.push(v);
            continue;
          }
          if (stall.stock <= 0) {
            if (!this.hurtMood(v, 14)) this.assignVisitorGoal(v);
            remain.push(v);
            continue;
          }
          stall.queue.push(v.id);
          v.state = "dining";
          if (stall.queue.length <= 2) this.boostMood(v, 3, "😊");
          remain.push(v);
          continue;
        }
      }
      this.assignVisitorGoal(v);
      remain.push(v);
    }
    this.state.visitors = remain;
  }

  private maybeDropTrash(pos: GridPos): void {
    if (this.hasBinCoverage(pos) && Math.random() < 0.92) return;
    const existing = this.state.trash.find((t) => t.pos.x === pos.x && t.pos.y === pos.y);
    if (existing) existing.amount = Math.min(5, existing.amount + 1);
    else this.state.trash.push({ id: uid("trash"), pos: { ...pos }, amount: 1 });
  }

  /** Bins slowly dissolve nearby litter between janitor sweeps */
  private updateBinCleaning(dt: number): void {
    if (!this.grid.bins.size || !this.state.trash.length) return;
    const remain: typeof this.state.trash = [];
    for (const t of this.state.trash) {
      if (this.hasBinCoverage(t.pos) && Math.random() < dt * 0.55) {
        t.amount -= 1;
        if (t.amount <= 0) continue;
      }
      remain.push(t);
    }
    this.state.trash = remain;
  }

  private updateAttractions(dt: number): void {
    for (const a of this.state.attractions) {
      const def = getAttraction(a.defId);
      if (!def) continue;

      if (!a.broken) {
        a.durability -= def.maintenanceRate * dt * 0.35;
        if (a.durability <= 0) {
          a.durability = 0;
          a.broken = true;
          // eject queue mood hit
          for (const id of a.queue) {
            const v = this.state.visitors.find((x) => x.id === id);
            if (v) {
              if (!this.hurtMood(v, 25)) {
                v.state = "wandering";
                this.assignVisitorGoal(v);
              }
            }
          }
          a.queue = [];
          a.riders = [];
        }
      }

      if (a.broken) continue;

      const cap = attractionCapacity(def, a.tier);
      if (a.riders.length === 0 && a.queue.length > 0) {
        while (a.riders.length < cap && a.queue.length) {
          const id = a.queue.shift()!;
          const v = this.state.visitors.find((x) => x.id === id);
          if (!v) continue;
          if (v.angryLeave || this.isFrustrated(v)) {
            this.beginFrustratedLeave(v);
            continue;
          }
          const price = attractionPrice(def, a.tier);
          const gateFee = v.paidAdmission ? 0 : this.state.ticketGateFee;
          if (v.wallet < price + gateFee) {
            if (!this.hurtMood(v, 8)) {
              v.state = "wandering";
              this.assignVisitorGoal(v);
            }
            continue;
          }
          if (gateFee > 0) {
            v.wallet -= gateFee;
            v.paidAdmission = true;
            this.earnCash(gateFee, this.grid.gatePos);
          }
          v.wallet -= price;
          v.state = "riding";
          v.rideTimer = 4 + def.excitementScore / 40;
          this.earnCash(price, a.pos);
          a.revenueToday += price;
          a.riders.push(id);
          const thrill = def.excitementScore >= 80;
          this.boostMood(v, 6 + def.excitementScore / 30, thrill ? "🤮" : "✨");
        }
      }

      if (a.riders.length) {
        // use first rider timer as cycle
        let done = true;
        for (const id of a.riders) {
          const v = this.state.visitors.find((x) => x.id === id);
          if (!v) continue;
          v.rideTimer -= dt;
          if (v.rideTimer > 0) done = false;
        }
        if (done) {
          for (const id of a.riders) {
            const v = this.state.visitors.find((x) => x.id === id);
            if (!v) continue;
            v.state = "wandering";
            this.boostMood(v, 10, "😊");
            const entries = this.entryTiles(a.pos, def.footprint.w, def.footprint.h);
            v.pos = entries[0] ? { ...entries[0] } : this.nearestPath(a.pos);
            v.pixel = this.cellCenter(v.pos);
            this.assignVisitorGoal(v);
          }
          a.riders = [];
        }
      }
    }
  }

  private updateStalls(dt: number): void {
    for (const s of this.state.stalls) {
      const def = getStall(s.defId);
      if (!def) continue;

      // Without a warehouse, use restockTime for a slow trickle of stock
      if (!this.state.warehouseBuilt) {
        const cap = stallStockCap(def, s.tier);
        if (s.stock < cap) {
          s.restockAcc = (s.restockAcc ?? 0) + dt;
          if ((s.restockAcc ?? 0) >= def.restockTime) {
            s.restockAcc = 0;
            s.stock = Math.min(cap, s.stock + 1);
            if (s.stock > cap * 0.3) s.awaitingRestock = false;
          }
        }
      }

      if (s.stock <= Math.ceil(stallStockCap(def, s.tier) * 0.3)) {
        s.awaitingRestock = true;
      }

      if (!s.queue.length) continue;
      s.servingTimer -= dt;
      if (s.servingTimer > 0) continue;
      s.servingTimer = 1.2;

      const id = s.queue.shift()!;
      const v = this.state.visitors.find((x) => x.id === id);
      if (!v) continue;

      if (v.angryLeave || this.isFrustrated(v)) {
        this.beginFrustratedLeave(v);
        continue;
      }

      if (s.stock <= 0) {
        if (!this.hurtMood(v, 14)) {
          this.flashThought(v, "😡");
          v.state = "wandering";
          this.assignVisitorGoal(v);
        }
        continue;
      }

      const price = stallPrice(def, s.tier);
      if (v.wallet < price) {
        if (!this.hurtMood(v, 6)) {
          v.state = "wandering";
          this.assignVisitorGoal(v);
        }
        continue;
      }

      s.stock -= 1;
      v.wallet -= price;
      this.boostMood(v, def.buyMoodBoost ?? 8);
      this.earnCash(price, s.pos);
      s.revenueToday += price;

      const isDrink = def.icon === "coffee" || def.icon === "drink";
      const isBalloon = def.icon === "balloon";
      if (isDrink) {
        v.thirst = Math.max(0, v.thirst - 55);
        this.flashThought(v, "🥤");
      } else if (isBalloon) {
        v.heldProp = "balloons";
        v.interactTimer = 6;
        this.flashThought(v, "🎈");
      } else {
        v.hunger = Math.max(0, v.hunger - 50);
        v.heldProp = heldPropFromStallIcon(def.icon);
        v.interactTimer = 5;
        this.flashThought(v, "🍔");
        // אחרי אוכל — סיכוי גבוה לזרוק זבל בקרוב (אלא אם יש פח)
        v.litterCooldown = 1.5 + Math.random() * 2.5;
      }

      v.state = "wandering";
      this.assignVisitorGoal(v);
    }
  }

  private updateStaff(dt: number): void {
    for (const st of this.state.staff) {
      if (st.busyTimer > 0) {
        st.busyTimer -= dt;
        continue;
      }

      if (st.path.length) {
        const move = this.moveAlongPath(st, dt, st.role === "janitor" ? 2.0 : 2.6);
        if (move === "moving") continue;
        if (move === "arrived") {
          this.completeStaffTask(st);
          continue;
        }
        // stuck — clear path and retry next tick
        st.path = [];
        continue;
      }

      if (st.role === "janitor") {
        const pile = this.state.trash
          .slice()
          .sort((a, b) => b.amount - a.amount)[0];
        if (pile) {
          st.task = pile.id;
          st.path = astar(this.grid, st.pos, pile.pos, { allowGrass: true });
          if (!st.path.length) {
            st.pos = { ...pile.pos };
            this.completeStaffTask(st);
          }
        } else {
          // roam
          const roam = this.randomPathNear(st.pos);
          st.path = roam;
        }
      } else if (st.role === "runner") {
        const need = this.state.stalls.find((s) => s.awaitingRestock || s.stock <= 2);
        if (need && this.state.warehouseStock > 0) {
          if (st.carryAmount <= 0) {
            st.task = "pickup";
            st.path = astar(this.grid, st.pos, this.grid.warehousePos, { allowGrass: true });
            if (!st.path.length) {
              st.pos = { ...this.grid.warehousePos };
              this.completeStaffTask(st);
            }
          } else {
            st.task = need.uid;
            st.path = astar(this.grid, st.pos, this.nearestPath(need.pos), { allowGrass: true });
          }
        }
      } else if (st.role === "mechanic") {
        const broken = this.state.attractions.find((a) => a.broken || a.durability < 35);
        if (broken) {
          st.task = broken.uid;
          st.path = astar(this.grid, st.pos, this.nearestPath(broken.pos), { allowGrass: true });
        }
      }
    }
  }

  private cheerVisitorsNearClean(pos: GridPos): void {
    for (const v of this.state.visitors) {
      if (v.angryLeave || v.state === "leaving" || v.state === "riding") continue;
      const d = Math.abs(v.pos.x - pos.x) + Math.abs(v.pos.y - pos.y);
      if (d <= 2) this.boostMood(v, 7, "😊");
    }
  }

  private completeStaffTask(st: StaffMember): void {
    if (st.role === "janitor" && st.task) {
      const idx = this.state.trash.findIndex((t) => t.id === st.task);
      if (idx >= 0) {
        const pile = this.state.trash[idx]!;
        fxSystem.spawnSparkle(pile.pos.x + 0.5, pile.pos.y + 0.5);
        this.state.trash.splice(idx, 1);
        st.busyTimer = 1.2;
        this.cheerVisitorsNearClean(pile.pos);
      }
      st.task = null;
    } else if (st.role === "runner") {
      if (st.task === "pickup") {
        const take = Math.min(15, this.state.warehouseStock);
        this.state.warehouseStock -= take;
        st.carryAmount = take;
        st.task = null;
        st.busyTimer = 0.6;
      } else if (st.task) {
        const stall = this.state.stalls.find((s) => s.uid === st.task);
        if (stall) {
          const def = getStall(stall.defId);
          const cap = def ? stallStockCap(def, stall.tier) : 40;
          const add = Math.min(st.carryAmount, cap - stall.stock);
          stall.stock += add;
          st.carryAmount -= add;
          if (stall.stock > cap * 0.3) stall.awaitingRestock = false;
          st.busyTimer = 0.8;
        }
        st.task = null;
      }
    } else if (st.role === "mechanic" && st.task) {
      const a = this.state.attractions.find((x) => x.uid === st.task);
      if (a) {
        a.durability = Math.min(100, a.durability + 55);
        if (a.durability > 20) a.broken = false;
        st.busyTimer = 2.5;
      }
      st.task = null;
    }
  }

  private randomPathNear(from: GridPos): GridPos[] {
    const paths: GridPos[] = [];
    for (let y = 0; y < this.grid.height; y++) {
      for (let x = 0; x < this.grid.width; x++) {
        if (this.grid.isWalkable({ x, y }) && Math.random() < 0.02) {
          paths.push({ x, y });
        }
      }
    }
    if (!paths.length) return [];
    return astar(this.grid, from, rand(paths), { allowGrass: true });
  }

  private updateSatisfaction(dt: number): void {
    void dt;
    const trashPenalty = Math.min(40, this.state.trash.reduce((s, t) => s + t.amount, 0) * 3);
    const binBonus = Math.min(25, this.grid.bins.size * 4);
    this.state.cleanliness = Math.max(0, Math.min(100, 100 - trashPenalty + binBonus));

    const broken = this.state.attractions.filter((a) => a.broken).length;
    const avgQueue =
      this.state.attractions.reduce((s, a) => s + a.queue.length, 0) /
      Math.max(1, this.state.attractions.length);
    const outOfStock = this.state.stalls.filter((s) => s.stock <= 0).length;

    let sat = 55;
    sat += this.state.cleanliness * 0.22;
    sat += Math.min(20, this.state.attractions.length * 1.5);
    sat += Math.min(10, this.state.stalls.length);
    sat += Math.min(12, this.grid.bins.size * 1.8);
    sat += Math.min(10, this.grid.benches.size * 1.5);
    let beauty = 0;
    for (const kind of this.grid.decor.values()) {
      beauty += getDecor(kind)?.beauty ?? 0;
    }
    sat += Math.min(16, beauty);
    sat -= broken * 12;
    sat -= Math.min(25, avgQueue * 2);
    sat -= outOfStock * 5;
    sat -= Math.max(0, (this.state.ticketGateFee - 20) * 0.8);
    sat += Math.min(8, this.state.staff.filter((s) => s.role === "janitor").length * 2);

    const disconnected =
      this.state.attractions.filter((a) => {
        const def = getAttraction(a.defId);
        return def ? !this.isFacilityConnected(a.pos, def.footprint.w, def.footprint.h) : false;
      }).length +
      this.state.stalls.filter((s) => !this.isFacilityConnected(s.pos, 1, 1)).length;
    sat -= disconnected * 6;
    if (disconnected > 0 && Math.random() < 0.01) {
      this.state.message = `${disconnected} מתקנים/דוכנים מנותקים מהשביל — המבקרים לא מגיעים!`;
    }

    sat -= Math.min(20, this.state.frustratedLeftToday * 1.5);

    const visitorsMood =
      this.state.visitors.reduce((s, v) => s + v.mood, 0) /
      Math.max(1, this.state.visitors.length);
    if (this.state.visitors.length) sat = sat * 0.55 + visitorsMood * 0.45;

    this.state.satisfaction = Math.round(
      lerp(this.state.satisfaction, Math.max(0, Math.min(100, sat)), 0.08),
    );
  }

  // helpers for renderer
  screenOrigin(viewW: number, viewH: number): { x: number; y: number } {
    const cx = this.grid.width / 2;
    const cy = this.grid.height / 2;
    return {
      x: viewW / 2 - (cx - cy) * (TILE_W / 2),
      y: viewH * 0.22 - (cx + cy) * (TILE_H / 2) + 80,
    };
  }

  /** Unit-test hooks (no gameplay use) */
  tickVisitorsForTest(dt: number): void {
    this.updateVisitors(dt);
  }

  tickStallsForTest(dt: number): void {
    this.updateStalls(dt);
  }

  tickStaffForTest(dt: number): void {
    this.updateStaff(dt);
  }

  tickAmbientForTest(dt: number): void {
    this.emitAmbientFx(dt);
  }

  tickSatisfactionForTest(): void {
    this.updateSatisfaction(0);
  }
}

export const simulation = new Simulation();
