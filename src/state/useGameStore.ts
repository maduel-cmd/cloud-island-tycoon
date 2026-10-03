import { useSyncExternalStore } from "react";
import { simulation, type SimState } from "../managers/Simulation";
import type { BuildMode } from "../data/types";

/** Bumps on every notify so useSyncExternalStore detects changes */
let storeEpoch = 0;
let cachedSnap: (SimState & { _epoch: number }) | null = null;

function getSnapshot(): SimState & { _epoch: number } {
  if (!cachedSnap || cachedSnap._epoch !== storeEpoch) {
    cachedSnap = { ...simulation.state, _epoch: storeEpoch };
  }
  return cachedSnap;
}

function subscribe(cb: () => void): () => void {
  return simulation.subscribe(() => {
    storeEpoch += 1;
    cachedSnap = null;
    cb();
  });
}

export function useGameStore(): SimState & {
  grid: typeof simulation.grid;
  setPaused: (p: boolean) => void;
  setSpeed: (s: 1 | 2 | 3) => void;
  setBuildMode: (mode: BuildMode, id?: string | null) => void;
  handleTileClick: (pos: { x: number; y: number }) => void;
  buyExpansion: (id: string) => void;
  upgradeAttraction: (id: string) => void;
  upgradeStall: (id: string) => void;
  hireStaff: (role: "janitor" | "runner" | "mechanic") => void;
  buyWarehouseStock: (n?: number) => void;
  upgradeEntrance: () => void;
  upgradeParking: () => void;
  repairAttraction: (id: string) => void;
  clearSelection: () => void;
  selectEntity: (kind: "attraction" | "stall" | "staff", id: string) => void;
  fireStaff: (id: string) => boolean;
  nightWageCost: () => number;
  setTicketGateFee: (fee: number) => void;
  confirmDayEnd: (skipWagesWithGem: boolean) => void;
  restartPark: () => void;
  bootstrapClockHeld: () => boolean;
  hasOutboundPathFromGate: () => boolean;
} {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    ...state,
    grid: simulation.grid,
    setPaused: (p) => simulation.setPaused(p),
    setSpeed: (s) => simulation.setSpeed(s),
    setBuildMode: (mode, id = null) => simulation.setBuildMode(mode, id),
    handleTileClick: (pos) => simulation.handleTileClick(pos),
    buyExpansion: (id) => simulation.buyExpansion(id),
    upgradeAttraction: (id) => simulation.upgradeAttraction(id),
    upgradeStall: (id) => simulation.upgradeStall(id),
    hireStaff: (role) => simulation.hireStaff(role),
    buyWarehouseStock: (n) => simulation.buyWarehouseStock(n),
    upgradeEntrance: () => simulation.upgradeEntrance(),
    upgradeParking: () => simulation.upgradeParking(),
    repairAttraction: (id) => simulation.repairAttraction(id),
    clearSelection: () => simulation.clearSelection(),
    selectEntity: (kind, id) => simulation.selectEntity(kind, id),
    fireStaff: (id) => simulation.fireStaff(id),
    nightWageCost: () => simulation.nightWageCost(),
    setTicketGateFee: (fee) => simulation.setTicketGateFee(fee),
    confirmDayEnd: (skip) => simulation.confirmDayEnd(skip),
    restartPark: () => simulation.restartPark(),
    bootstrapClockHeld: () => simulation.bootstrapClockHeld(),
    hasOutboundPathFromGate: () => simulation.hasOutboundPathFromGate(),
  };
}

export { simulation };
