import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../managers/Simulation.ts";
import { mockVisitor } from "./testVisitor.ts";

describe("frustrated visitors leave without spending", () => {
  it("storms out when mood crashes and leaves attraction queue", () => {
    const sim = new Simulation();
    sim.placeAttraction("grand_carousel", { x: 10, y: 8 }, true);
    for (const y of [12, 11, 10]) sim.placePath({ x: 11, y }, true);
    const a = sim.state.attractions[0]!;

    const v = mockVisitor({
      id: "vis_angry",
      pos: { x: 11, y: 10 },
      state: "queuing",
      mood: 32,
      wallet: 100,
      targetId: a.uid,
      color: "#f00",
    });
    a.queue.push(v.id);
    sim.state.visitors.push(v);

    const cashBefore = sim.state.cash;
    for (let i = 0; i < 40; i++) {
      sim.tickVisitorsForTest(0.25);
    }

    assert.equal(a.queue.includes(v.id), false);
    assert.ok(v.angryLeave === true || v.state === "leaving");
    assert.ok(sim.state.frustratedLeftToday >= 1);
    assert.equal(sim.state.cash, cashBefore);
  });

  it("does not charge stall when guest is already angry", () => {
    const sim = new Simulation();
    sim.placeStall("cotton_candy", { x: 11, y: 12 }, true);
    const s = sim.state.stalls[0]!;
    const v = mockVisitor({
      id: "vis_skip",
      pos: { ...s.pos },
      state: "dining",
      mood: 10,
      wallet: 100,
      targetId: s.uid,
      color: "#0f0",
      angryLeave: true,
    });
    s.queue.push(v.id);
    sim.state.visitors.push(v);
    const cashBefore = sim.state.cash;
    const stockBefore = s.stock;
    sim.tickStallsForTest(2);
    assert.equal(sim.state.cash, cashBefore);
    assert.equal(s.stock, stockBefore);
    assert.equal(s.queue.includes(v.id), false);
  });
});
