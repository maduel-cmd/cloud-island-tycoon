import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECOR } from "../data/decor.ts";
import { Simulation } from "../managers/Simulation.ts";
import { mockVisitor } from "./testVisitor.ts";

describe("scenery decor mood", () => {
  it("catalog has statue tree bush flower", () => {
    assert.equal(DECOR.length, 4);
    assert.deepEqual(
      DECOR.map((d) => d.id).sort(),
      ["bush", "flower", "statue", "tree"],
    );
  });

  it("places decor and applies mood aura while resting nearby", () => {
    const sim = new Simulation();
    assert.equal(sim.placeDecor("statue", { x: 10, y: 12 }), true);
    assert.equal(sim.decorCount(), 1);
    assert.ok(sim.decorMoodAura({ x: 10, y: 12 }) > 1);
    assert.ok(sim.decorMoodAura({ x: 11, y: 13 }) > 0);
    assert.equal(sim.decorMoodAura({ x: 6, y: 8 }), 0);

    const v = mockVisitor({
      id: "vis_aura",
      pos: { x: 10, y: 12 },
      state: "resting",
      mood: 50,
      wallet: 40,
      restTimer: 30,
      color: "#abc",
    });
    sim.state.visitors.push(v);
    const before = v.mood;
    for (let i = 0; i < 8; i++) sim.tickVisitorsForTest(0.25);
    assert.ok(v.mood > before + 2, `mood should rise near statue (${before} → ${v.mood})`);
  });
});
