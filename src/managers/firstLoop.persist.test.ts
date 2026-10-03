import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Simulation, GEM_REPAIR_COST, STAFF_WAGE } from "./Simulation.ts";
import { SAVE_VERSION } from "./persistence.ts";

function freshSim(): Simulation {
  return new Simulation({ skipLoad: true, skipPersist: true });
}

describe("local full-session save", () => {
  it("round-trips grid tiles, plots, staff, cash, day, level, rides, stalls", () => {
    const sim = freshSim();
    sim.placePath({ x: 11, y: 14 }, true);
    sim.placeAttraction("grand_carousel", { x: 10, y: 8 }, true);
    sim.placeStall("cotton_candy", { x: 12, y: 10 }, true);
    sim.placeBin({ x: 11, y: 13 });
    sim.hireStaff("janitor");
    sim.state.cash = 4321;
    sim.state.day = 3;
    sim.state.parkLevel = 2;
    sim.state.operationsStarted = true;
    const north = sim.grid.plots.find((p) => p.id === "north");
    assert.ok(north);
    sim.grid.unlockPlot("north");

    const save = sim.captureSave();
    assert.equal(save.version, SAVE_VERSION);
    assert.ok(save.grid.tiles.length > 0);
    assert.ok(save.grid.bins.length >= 1);

    const loaded = freshSim();
    assert.equal(loaded.applySave(save), true);
    assert.equal(loaded.state.cash, 4321);
    assert.equal(loaded.state.day, 3);
    assert.equal(loaded.state.parkLevel, 2);
    assert.equal(loaded.state.attractions.length, 1);
    assert.equal(loaded.state.stalls.length, 1);
    assert.equal(loaded.state.staff.length, 1);
    assert.equal(loaded.binCount(), 1);
    assert.equal(loaded.grid.plots.find((p) => p.id === "north")?.unlocked, true);
    assert.equal(loaded.grid.get(11, 14), "path");
  });
});

describe("first loop: admission + clock gate", () => {
  it("does not advance day clock or spawn until gate connects to an open ride", () => {
    const sim = freshSim();
    const t0 = sim.state.timeOfDay;
    const cash0 = sim.state.cash;
    sim.tickForTest(1);
    assert.equal(sim.state.operationsStarted, false);
    assert.equal(sim.state.timeOfDay, t0);
    assert.equal(sim.state.cash, cash0);
    assert.equal(sim.state.visitorsToday, 0);

    sim.placeAttraction("grand_carousel", { x: 10, y: 8 }, true);
    assert.equal(sim.state.operationsStarted, false);
    for (const y of [14, 13, 12, 11, 10]) sim.placePath({ x: 11, y }, true);
    assert.equal(sim.state.operationsStarted, true);

    sim.tickForTest(1);
    assert.ok(sim.state.timeOfDay > t0);
  });
});

describe("build mode exits after one successful placement", () => {
  it("turns off attraction build mode so a map check click does not buy another ride", () => {
    const sim = freshSim();
    sim.setBuildMode("attraction", "sky_coaster");
    const cashBefore = sim.state.cash;
    assert.equal(sim.placeAttraction("sky_coaster", { x: 10, y: 8 }), true);
    assert.equal(sim.state.buildMode, "none");
    assert.equal(sim.state.selectedBuildId, null);
    assert.equal(sim.state.attractions.length, 1);
    const cashAfterPlace = sim.state.cash;
    assert.ok(cashAfterPlace < cashBefore);

    // Second map click with mode off must not purchase
    sim.handleTileClick({ x: 14, y: 8 });
    assert.equal(sim.state.attractions.length, 1);
    assert.equal(sim.state.cash, cashAfterPlace);
  });

  it("keeps path mode for continuous paving", () => {
    const sim = freshSim();
    sim.setBuildMode("path");
    assert.equal(sim.placePath({ x: 11, y: 14 }), true);
    assert.equal(sim.state.buildMode, "path");
  });
});

describe("gems: instant repair only", () => {
  it("repairs a broken ride with gems, not cash", () => {
    const sim = freshSim();
    sim.placeAttraction("grand_carousel", { x: 10, y: 8 }, true);
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

describe("22:00 day close", () => {
  it("shows report and refuses to drive cash negative; firing unlocks confirm", () => {
    const sim = freshSim();
    sim.state.operationsStarted = true;
    sim.hireStaff("janitor");
    sim.hireStaff("janitor");
    sim.hireStaff("mechanic");
    sim.state.cash = 50; // less than 3 * STAFF_WAGE
    sim.state.revenueToday = 200;
    sim.state.frustratedLeftToday = 4;
    sim.state.timeOfDay = 21.99;
    sim.tickForTest(1);
    assert.ok(sim.state.dayClose);
    assert.equal(sim.state.dayClose!.angryLeft, 4);
    assert.equal(sim.state.cash, 50);
    assert.equal(sim.confirmDayClose(), false);

    while (sim.state.staff.length > 1) {
      sim.fireStaff(sim.state.staff[0]!.id);
    }
    assert.ok(sim.state.cash >= sim.state.staff.length * STAFF_WAGE);
    const day = sim.state.day;
    assert.equal(sim.confirmDayClose(), true);
    assert.equal(sim.state.dayClose, null);
    assert.equal(sim.state.day, day + 1);
    assert.equal(sim.state.timeOfDay, 9);
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
    let g = sim.getLoopGoals();
    assert.equal(g.path, false);
    assert.equal(g.ride, false);
    assert.equal(g.stockedStall, false);
    sim.placePath({ x: 11, y: 14 }, true);
    g = sim.getLoopGoals();
    assert.equal(g.path, true);
    sim.placeAttraction("grand_carousel", { x: 10, y: 8 }, true);
    assert.equal(sim.getLoopGoals().ride, true);
    sim.placeStall("cotton_candy", { x: 12, y: 10 }, true);
    assert.equal(sim.getLoopGoals().stockedStall, true);
  });
});
