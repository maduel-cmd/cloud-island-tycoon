import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "./Simulation.ts";
import { writeSave, readSave, clearSave, SAVE_KEY } from "./SaveGame.ts";

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

describe("save + first-loop economy", () => {
  installMemoryStorage();

  it("does not charge gate fee at spawn; clock held until carousel connected", () => {
    clearSave();
    const sim = new Simulation();
    assert.equal(sim.bootstrapClockHeld(), true);
    const cash0 = sim.state.cash;
    // @ts-expect-error private for test
    sim.spawnVisitor();
    assert.equal(sim.state.cash, cash0);
    assert.equal(sim.state.visitors[0]?.paidAdmission, false);
  });

  it("blocks free kit ride until a path leaves the gate", () => {
    clearSave();
    const sim = new Simulation();
    assert.equal(sim.hasOutboundPathFromGate(), false);
    const ok = sim.placeAttraction("grand_carousel", { x: 10, y: 10 });
    assert.equal(ok, false);
    assert.equal(sim.state.attractions.length, 0);
  });

  it("charges gate fee when guest boards a connected ride", () => {
    clearSave();
    const sim = new Simulation();
    // Place ride first (free bypasses kit path lock), then pave corridor to an entry tile
    assert.equal(sim.placeAttraction("grand_carousel", { x: 10, y: 8 }, true), true);
    for (const y of [14, 13, 12, 11, 10]) {
      assert.equal(sim.placePath({ x: 11, y }, true), true);
    }
    assert.equal(sim.bootstrapClockHeld(), false);

    // @ts-expect-error private for test
    sim.spawnVisitor();
    const v = sim.state.visitors[0]!;
    const a = sim.state.attractions[0]!;
    const cashBefore = sim.state.cash;
    const fee = sim.state.ticketGateFee;
    v.wallet = 200;
    v.state = "queuing";
    a.queue.push(v.id);
    // @ts-expect-error private for test
    sim.updateAttractions(0.05);
    assert.equal(v.paidAdmission, true);
    assert.ok(sim.state.cash >= cashBefore + fee);
  });

  it("persists grid + cash across toSnapshot/applySnapshot", () => {
    clearSave();
    const sim = new Simulation();
    sim.placePath({ x: 11, y: 14 }, true);
    sim.state.cash = 4242;
    const snap = sim.toSnapshot();
    assert.ok(snap.grid?.tiles?.length);
    writeSave(snap);
    const loaded = readSave();
    assert.ok(loaded);
    assert.equal(loaded!.cash, 4242);
    assert.equal(loaded!.grid!.tiles[14]![11], "path");

    clearSave();
    const sim2 = new Simulation();
    sim2.applySnapshot(loaded!);
    assert.equal(sim2.state.cash, 4242);
    assert.equal(sim2.grid.get(11, 14), "path");
    assert.equal(sim2.state.attractions.length, 0);
    assert.ok(SAVE_KEY);
  });

  it("day summary appears before wages; gem can skip wages", () => {
    clearSave();
    const sim = new Simulation();
    sim.hireStaff("janitor");
    assert.equal(sim.placeAttraction("grand_carousel", { x: 10, y: 8 }, true), true);
    for (const y of [14, 13, 12, 11, 10]) sim.placePath({ x: 11, y }, true);
    assert.equal(sim.bootstrapClockHeld(), false);
    sim.state.timeOfDay = 21.95;
    sim.state.revenueToday = 100;
    sim.state.expensesToday = 20;

    // @ts-expect-error private
    sim.tick(2);
    assert.ok(sim.state.daySummary);
    assert.equal(sim.state.daySummary!.wages, 40);
    const cash = sim.state.cash;
    sim.state.gems = 2;
    sim.confirmDayEnd(true);
    assert.equal(sim.state.daySummary, null);
    assert.equal(sim.state.cash, cash);
    assert.equal(sim.state.gems, 1);
    assert.equal(sim.state.day, 2);
  });

  it("one janitor and one runner in the starter kit", () => {
    clearSave();
    const sim = new Simulation();
    assert.equal(sim.state.starterKit.janitorLeft, 1);
    assert.equal(sim.state.starterKit.runnerLeft, 1);
    assert.equal(sim.nightWageCost(), 0);
  });
});
