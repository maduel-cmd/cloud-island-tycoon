/** Shared domain types for Cloud Island Tycoon */

export type GridPos = { x: number; y: number };

export type TileKind =
  | "void"
  | "cloud"
  | "grass"
  | "path"
  | "parking"
  | "road"
  | "locked"
  | "water";

export type AttractionCategory =
  | "thrill"
  | "family"
  | "water"
  | "carnival";

export type StaffRole = "janitor" | "runner" | "mechanic";

export type VisitorState =
  | "arriving"
  | "entering"
  | "wandering"
  | "queuing"
  | "riding"
  | "dining"
  | "resting"
  | "leaving";

export type BuildMode =
  | "none"
  | "path"
  | "attraction"
  | "stall"
  | "bin"
  | "bench"
  | "decor"
  | "demolish"
  | "expand"
  | "parking"
  | "warehouse";

export type DecorKind = "statue" | "tree" | "bush" | "flower";

export interface PlacedDecor {
  id: string;
  kind: DecorKind;
  pos: GridPos;
}

export interface AttractionDef {
  id: string;
  nameHe: string;
  nameEn: string;
  category: AttractionCategory;
  baseCapacity: number;
  baseTicketPrice: number;
  maintenanceRate: number;
  excitementScore: number;
  footprint: { w: number; h: number };
  color: string;
  accent: string;
  shape: "coaster" | "wheel" | "carousel" | "tower" | "ship" | "cups" | "generic" | "water" | "game";
}

export interface StallDef {
  id: string;
  nameHe: string;
  nameEn: string;
  productPrice: number;
  stockCapacity: number;
  consumptionRate: number;
  restockTime: number;
  color: string;
  icon:
    | "coffee"
    | "candy"
    | "popcorn"
    | "burger"
    | "pizza"
    | "ice"
    | "drink"
    | "shop"
    | "balloon"
    | "generic";
  /** בונוס מצב־רוח בקנייה (ברירת מחדל 8) */
  buyMoodBoost?: number;
}

export interface PlacedAttraction {
  uid: string;
  defId: string;
  pos: GridPos;
  tier: number;
  durability: number;
  queue: string[];
  riders: string[];
  rideTimer: number;
  broken: boolean;
  revenueToday: number;
}

export interface PlacedStall {
  uid: string;
  defId: string;
  pos: GridPos;
  tier: number;
  stock: number;
  queue: string[];
  servingTimer: number;
  revenueToday: number;
  awaitingRestock: boolean;
}

export interface Visitor {
  id: string;
  pos: GridPos;
  pixel: { x: number; y: number };
  path: GridPos[];
  state: VisitorState;
  /** 0–100; below ~30 they leave angry and stop spending */
  mood: number;
  wallet: number;
  targetId: string | null;
  rideTimer: number;
  /** Seconds left while sitting on a bench */
  restTimer: number;
  color: string;
  litterCooldown: number;
  /** 0–39 visitor visual archetype (גליון 12×4, 40 מתוך 48) */
  archetype: number;
  /** ילד / מבוגר / קשיש — לגיוון ספונינג */
  ageBand: "child" | "adult" | "senior";
  /** רעב 0–100 — מעל ~70 פוגע במצב רוח + בועת 🍔 */
  hunger: number;
  /** צמא 0–100 — מעל ~70 פוגע במצב רוח + בועת 🥤 */
  thirst: number;
  /** אביזר מוחזק לאינטראקציה ויזואלית */
  heldProp: "none" | "balloons" | "cotton_candy" | "ice_cream" | "camera" | "map" | "bags" | "phone";
  /** שניות שנותרו לאנימציית אינטראקציה עם האביזר */
  interactTimer: number;
  thoughtEmoji: string | null;
  thoughtTimer: number;
  /** Left (or leaving) because mood crashed — no more purchases */
  angryLeave?: boolean;
  /** אנימציית דמות 2.5D */
  facing: "ne" | "se" | "sw" | "nw";
  walkPhase: number;
  talkTimer: number;
  talkPartnerId: string | null;
  skin: string;
  hair: string;
}

export interface StaffMember {
  id: string;
  role: StaffRole;
  pos: GridPos;
  pixel: { x: number; y: number };
  path: GridPos[];
  task: string | null;
  carryAmount: number;
  busyTimer: number;
  facing: "ne" | "se" | "sw" | "nw";
  walkPhase: number;
  skin: string;
  hair: string;
}

export interface TrashPile {
  id: string;
  pos: GridPos;
  amount: number;
}

export interface ParkingSpot {
  id: string;
  pos: GridPos;
  occupied: boolean;
  carColor: string;
  timer: number;
}

export interface GameSnapshot {
  cash: number;
  day: number;
  tick: number;
  satisfaction: number;
  cleanliness: number;
  visitorsToday: number;
  revenueToday: number;
  expensesToday: number;
  warehouseStock: number;
  unlockedPlots: string[];
  entranceLanes: number;
  parkingBays: number;
  paused: boolean;
  speed: 1 | 2 | 3;
}
