import type { GameSnapshot } from "../data/types";

export const SAVE_KEY = "cit_park_save_v1";
export const SAVE_VERSION = 1;

/** Persist a full park snapshot (including grid). Never drops legacy GameSnapshot fields. */
export function writeSave(snapshot: GameSnapshot): void {
  try {
    const payload: GameSnapshot = { ...snapshot, saveVersion: SAVE_VERSION };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function readSave(): GameSnapshot | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameSnapshot;
    if (typeof parsed?.cash !== "number" || typeof parsed?.day !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
