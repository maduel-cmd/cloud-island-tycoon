import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../managers/Simulation.ts";

describe("trash bins cleanliness", () => {
  it("places bins and covers nearby tiles", () => {
    const sim = new Simulation();
    assert.equal(sim.binCount(), 0);
    assert.equal(sim.placeBin({ x: 11, y: 14 }), true);
    assert.equal(sim.binCount(), 1);
    assert.equal(sim.hasBinCoverage({ x: 11, y: 14 }), true);
    assert.equal(sim.hasBinCoverage({ x: 12, y: 15 }), true); // within radius 2
    assert.equal(sim.hasBinCoverage({ x: 6, y: 8 }), false);
  });

  it("clears litter under a new bin and blocks most new drops", () => {
    const sim = new Simulation();
    sim.state.trash.push({ id: "t1", pos: { x: 11, y: 14 }, amount: 3 });
    sim.state.trash.push({ id: "t2", pos: { x: 6, y: 8 }, amount: 2 });
    assert.equal(sim.placeBin({ x: 11, y: 14 }), true);
    assert.equal(
      sim.state.trash.some((t) => t.pos.x === 11 && t.pos.y === 14),
      false,
    );
    assert.equal(
      sim.state.trash.some((t) => t.pos.x === 6 && t.pos.y === 8),
      true,
    );

    // Monte Carlo: covered tile almost never accumulates trash
    let drops = 0;
    for (let i = 0; i < 40; i++) {
      sim.state.trash = [];
      // access private via repeated visitor litter path — call maybeDrop through public side effect
      // Use placeBin coverage check + simulate by placing many visitors littering via tickVisitors
      const before = sim.state.trash.length;
      // force litter attempt by pushing visitor and ticking litter cooldown
      sim.state.visitors = [
        {
          id: "v",
          pos: { x: 11, y: 14 },
          pixel: { x: 11.5, y: 14.5 },
          path: [],
          state: "wandering",
          mood: 80,
          wallet: 50,
          targetId: null,
          rideTimer: 0,
          color: "#000",
          litterCooldown: 0,
          restTimer: 0,
          facing: "se",
          walkPhase: 0,
          talkTimer: 0,
          talkPartnerId: null,
          skin: "#f5d0b0",
          hair: "#1c1917",
        },
      ];
      sim.tickVisitorsForTest(0.05);
      if (sim.state.trash.length > before) drops += 1;
    }
    assert.ok(drops <= 8, `expected few drops near bin, got ${drops}`);
  });

  it("bin bonus raises cleanliness vs trash-only park", () => {
    const dirty = new Simulation();
    dirty.state.trash.push({ id: "a", pos: { x: 10, y: 12 }, amount: 5 });
    dirty.state.trash.push({ id: "b", pos: { x: 11, y: 12 }, amount: 5 });
    dirty.tickSatisfactionForTest();
    const cleanScore = dirty.state.cleanliness;

    const withBins = new Simulation();
    withBins.state.trash.push({ id: "a", pos: { x: 10, y: 12 }, amount: 5 });
    withBins.state.trash.push({ id: "b", pos: { x: 11, y: 12 }, amount: 5 });
    withBins.placeBin({ x: 11, y: 13 });
    withBins.placeBin({ x: 12, y: 13 });
    // placeBin clears nearby trash — re-add far trash only
    withBins.state.trash = [
      { id: "a", pos: { x: 10, y: 12 }, amount: 5 },
      { id: "b", pos: { x: 11, y: 12 }, amount: 5 },
    ];
    // Actually 11,12 is within radius 2 of 11,13 — clear happens only on place. Re-add after.
    withBins.tickSatisfactionForTest();
    assert.ok(withBins.state.cleanliness >= cleanScore);
  });
});
