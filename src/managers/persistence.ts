import type { DecorKind, TileKind, GridPos } from "../data/types";
import type { SimState } from "./Simulation";

export const SAVE_KEY = "cit_full_session_v1";
export const SAVE_VERSION = 1;

export interface GridSnapshot {
  tiles: TileKind[][];
  plots: { id: string; unlocked: boolean }[];
  bins: string[];
  benches: string[];
  decor: [string, DecorKind][];
  warehousePos: GridPos;
}

export interface GameSave {
  version: number;
  savedAt: number;
  state: SimState;
  grid: GridSnapshot;
}

export function canUseLocalStorage(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage !== null;
  } catch {
    return false;
  }
}

export function loadGameSave(): GameSave | null {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameSave;
    if (!parsed || parsed.version !== SAVE_VERSION || !parsed.state || !parsed.grid) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeGameSave(save: GameSave): void {
  if (!canUseLocalStorage()) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function clearGameSave(): void {
  if (!canUseLocalStorage()) return;
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
