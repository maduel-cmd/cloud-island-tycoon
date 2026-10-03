import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Simulation, GEM_REPAIR_COST, STAFF_WAGE } from "./Simulation.ts";
import { writeSave, readSave, clearSave, SAVE_VERSION } from "./SaveGame.ts";

/** Minimal localStorage for node tests */
function installMemoryStorage(): void {
  const map = new Map<string, string>();
  // @ts-expect-error test shim
  globalThis.localStorage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

function freshSim(): Simulation {
  return new Simulation({ skipLoad: true, skipPersist: true });
}

function connectCarousel(sim: Simulation): { gate: { x: number; y: number }; ridePos: { x: number; y: number } } {
  const gate = sim.grid.gatePos;
  const ridePos = { x: gate.x - 1, y: gate.y - 8 };
  assert.equal(sim.placeAttraction("grand_carousel", ridePos, true), true);
  for (let y = gate.y - 1; y >= ridePos.y + 2; y--) {
    assert.equal(sim.placePath({ x: gate.x, y }, true), true);
  }
  return { gate, ridePos };
}

installMemoryStorage();

describe("local full-session save", () => {
  it("round-trips grid tiles, plots, staff, cash, day, level, rides, stalls", () => {
    clearSave();
    const sim = freshSim();
    const { gate, ridePos } = connectCarousel(sim);
    const stallPos = { x: gate.x + 1, y: ridePos.y + 2 };
    assert.equal(sim.placeStall("cotton_candy", stallPos, true), true);
    assert.equal(sim.placeBin({ x: gate.x, y: gate.y - 2 }), true);
    sim.hireStaff("janitor");
    sim.state.cash = 4321;
    sim.state.day = 3;
    sim.state.parkLevel = 2;
    const north = sim.grid.plots.find((p) => p.id === "north");
    assert.ok(north);
    sim.grid.unlockPlot("north");

    const snap = sim.toSnapshot();
    assert.equal(snap.saveVersion ?? SAVE_VERSION, SAVE_VERSION);
    writeSave(snap);
    assert.ok(readSave());

    const loaded = freshSim();
    const saved = readSave();
    assert.ok(saved);
    loaded.applySnapshot(saved!);
    assert.equal(loaded.state.cash, 4321);
    assert.equal(loaded.state.day, 3);
    assert.equal(loaded.state.parkLevel, 2);
    assert.equal(loaded.state.attractions.length, 1);
    assert.equal(loaded.state.stalls.length, 1);
    assert.equal(loaded.state.staff.length, 1);
    assert.equal(loaded.binCount(), 1);
    assert.equal(loaded.grid.plots.find((p) => p.id === "north")?.unlocked, true);
    assert.equal(loaded.grid.get(gate.x, gate.y - 1), "path");
  });
});

describe("first loop: admission + clock gate", () => {
  it("does not advance day clock until gate connects to an open ride", () => {
    const sim = freshSim();
    const t0 = sim.state.timeOfDay;
    const cash0 = sim.state.cash;
    sim.tickForTest(1);
    assert.equal(sim.bootstrapClockHeld(), true);
    assert.equal(sim.state.timeOfDay, t0);
    assert.equal(sim.state.cash, cash0);
    assert.equal(sim.state.visitorsToday, 0);

    const gate = sim.grid.gatePos;
    const ridePos = { x: gate.x - 1, y: gate.y - 8 };
    assert.equal(sim.placeAttraction("grand_carousel", ridePos, true), true);
    assert.equal(sim.bootstrapClockHeld(), true);
    for (let y = gate.y - 1; y >= ridePos.y + 2; y--) sim.placePath({ x: gate.x, y }, true);
    assert.equal(sim.bootstrapClockHeld(), false);

    sim.tickForTest(1);
    assert.ok(sim.state.timeOfDay > t0);
  });
});

describe("build mode exits after one successful placement", () => {
  it("turns off attraction build mode so a map check click does not buy another ride", () => {
    const sim = freshSim();
    const gate = sim.grid.gatePos;
    for (let y = gate.y - 1; y >= gate.y - 3; y--) sim.placePath({ x: gate.x, y }, true);
    sim.setBuildMode("attraction", "sky_coaster");
    const cashBefore = sim.state.cash;
    const ridePos = { x: gate.x - 1, y: gate.y - 8 };
    assert.equal(sim.placeAttraction("sky_coaster", ridePos), true);
    assert.equal(sim.state.buildMode, "none");
    assert.equal(sim.state.selectedBuildId, null);
    assert.equal(sim.state.attractions.length, 1);
    const cashAfterPlace = sim.state.cash;
    assert.ok(cashAfterPlace < cashBefore);

    // Second map click with mode off must not purchase
    sim.handleTileClick({ x: gate.x + 3, y: gate.y - 8 });
    assert.equal(sim.state.attractions.length, 1);
    assert.equal(sim.state.cash, cashAfterPlace);
  });

  it("keeps path mode for continuous paving", () => {
    const sim = freshSim();
    const gate = sim.grid.gatePos;
    sim.setBuildMode("path");
    assert.equal(sim.placePath({ x: gate.x, y: gate.y - 1 }), true);
    assert.equal(sim.state.buildMode, "path");
  });
});

describe("gems: instant repair only", () => {
  it("repairs a broken ride with gems, not cash", () => {
    const sim = freshSim();
    const gate = sim.grid.gatePos;
    const ridePos = { x: gate.x - 1, y: gate.y - 8 };
    assert.equal(sim.placeAttraction("grand_carousel", ridePos, true), true);
    const a = sim.state.attractions[0]!;
    a.broken = true;
    a.durability = 0;
    const cash = sim.state.cash;
    const gems = sim.state.gems;
    sim.repairAttraction(a.uid);
    assert.equal(a.broken, false);
    assert.equal(sim.state.cash, cash);
    assert.equal(sim.state.gems, gems - GEM_REPAIR_COST);
  });
});

describe("22:00 day summary", () => {
  it("shows P&L and allows fire then pay wages", () => {
    const sim = freshSim();
    connectCarousel(sim);
    assert.equal(sim.bootstrapClockHeld(), false);

    sim.hireStaff("janitor");
    sim.hireStaff("janitor");
    sim.hireStaff("mechanic");
    sim.state.cash = 50; // less than 3 * STAFF_WAGE
    sim.state.revenueToday = 200;
    sim.state.frustratedLeftToday = 4;
    sim.state.timeOfDay = 21.99;
    sim.tickForTest(1);
    assert.ok(sim.state.daySummary);
    assert.equal(sim.state.daySummary!.frustrated, 4);
    assert.equal(sim.state.daySummary!.wages, 3 * STAFF_WAGE);
    assert.equal(sim.state.cash, 50);

    while (sim.state.staff.length > 1) {
      sim.fireStaff(sim.state.staff[0]!.id);
    }
    sim.state.daySummary = {
      ...sim.state.daySummary!,
      wages: sim.nightWageCost(),
    };
    assert.ok(sim.state.cash >= sim.state.daySummary!.wages);
    const day = sim.state.day;
    const gems = sim.state.gems;
    sim.confirmDayEnd(false);
    assert.equal(sim.state.daySummary, null);
    assert.equal(sim.state.day, day + 1);
    assert.equal(sim.state.timeOfDay, 9);
    assert.equal(sim.state.gems, gems);
  });
});

describe("warehouse supply order messaging", () => {
  it("does not charge when there is no warehouse and sets a clear message", () => {
    const sim = freshSim();
    const cash = sim.state.cash;
    sim.buyWarehouseStock(40);
    assert.equal(sim.state.cash, cash);
    assert.equal(sim.state.warehouseStock, 0);
    assert.match(sim.state.message ?? "", /מחסן/);
  });
});

describe("loop goals", () => {
  it("tracks path, ride, and stocked stall", () => {
    const sim = freshSim();
    const gate = sim.grid.gatePos;
    let g = sim.getLoopGoals();
    assert.equal(g.path, false);
    assert.equal(g.ride, false);
    assert.equal(g.stockedStall, false);
    sim.placePath({ x: gate.x, y: gate.y - 1 }, true);
    g = sim.getLoopGoals();
    assert.equal(g.path, true);
    const ridePos = { x: gate.x - 1, y: gate.y - 8 };
    sim.placeAttraction("grand_carousel", ridePos, true);
    assert.equal(sim.getLoopGoals().ride, true);
    sim.placeStall("cotton_candy", { x: gate.x + 1, y: ridePos.y + 2 }, true);
    assert.equal(sim.getLoopGoals().stockedStall, true);
  });
});
