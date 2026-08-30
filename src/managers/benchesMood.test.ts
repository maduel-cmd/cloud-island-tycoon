import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../managers/Simulation.ts";
import { mockVisitor } from "./testVisitor.ts";

describe("park benches raise mood", () => {
  it("places a bench on the entrance path", () => {
    const sim = new Simulation();
    assert.equal(sim.benchCount(), 0);
    assert.equal(sim.placeBench({ x: 11, y: 14 }), true);
    assert.equal(sim.benchCount(), 1);
    assert.ok(sim.grid.benches.has("11,14"));
  });

  it("guest sitting on a bench recovers mood", () => {
    const sim = new Simulation();
    assert.equal(sim.placeBench({ x: 11, y: 14 }), true);
    const v = mockVisitor({
      id: "vis_rest",
      pos: { x: 11, y: 14 },
      mood: 40,
      targetId: "bench:11,14",
      color: "#0af",
    });
    sim.state.visitors.push(v);
    sim.tickVisitorsForTest(0.05);
    assert.equal(v.state, "resting");
    const moodAfterSit = v.mood;
    assert.ok(moodAfterSit > 40);
    for (let i = 0; i < 20; i++) sim.tickVisitorsForTest(0.25);
    assert.ok(v.mood > moodAfterSit);
  });
});
