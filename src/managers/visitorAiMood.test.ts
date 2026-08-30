import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "./Simulation.ts";
import { mockVisitor } from "./testVisitor.ts";

describe("Theme Park Master — visitor AI & mood", () => {
  it("drains mood when hunger is high and can flash 🍔", () => {
    const sim = new Simulation();
    const v = mockVisitor({
      id: "v-hunger",
      pos: { ...sim.grid.gatePos },
      hunger: 78,
      thirst: 10,
      mood: 60,
      thoughtEmoji: null,
      thoughtTimer: 0,
      state: "wandering",
    });
    sim.state.visitors.push(v);
    const moodBefore = v.mood;
    for (let i = 0; i < 20; i++) sim.tickAmbientForTest(0.5);
    assert.ok(v.mood < moodBefore || v.thoughtEmoji === "🍔");
  });

  it("cheers nearby guests when a janitor cleans litter", () => {
    const sim = new Simulation();
    const gate = { ...sim.grid.gatePos };
    sim.state.trash.push({ id: "t1", pos: { ...gate }, amount: 3 });
    const v = mockVisitor({
      id: "v-cheer",
      pos: { x: gate.x, y: gate.y },
      mood: 50,
      thoughtEmoji: null,
      thoughtTimer: 0,
      state: "wandering",
    });
    sim.state.visitors.push(v);
    sim.state.staff.push({
      id: "jan1",
      role: "janitor",
      pos: { ...gate },
      pixel: { x: gate.x + 0.5, y: gate.y + 0.5 },
      path: [{ ...gate }],
      task: "t1",
      carryAmount: 0,
      busyTimer: 0,
      facing: "se",
      walkPhase: 0,
      skin: "#f5d0b0",
      hair: "#1c1917",
    });
    sim.tickStaffForTest(1);
    assert.equal(
      sim.state.trash.find((t) => t.id === "t1"),
      undefined,
    );
    assert.ok(v.mood > 50);
    assert.equal(v.thoughtEmoji, "😊");
  });

  it("after food purchase: lowers hunger, sets held prop, schedules litter", () => {
    const sim = new Simulation();
    assert.equal(sim.placeStall("burger_shack", { x: 11, y: 12 }, true), true);
    const s = sim.state.stalls[0]!;
    const v = mockVisitor({
      id: "v-food",
      pos: { ...s.pos },
      wallet: 200,
      hunger: 80,
      litterCooldown: 99,
      heldProp: "none",
      state: "dining",
    });
    s.queue.push(v.id);
    s.servingTimer = 0;
    s.stock = 5;
    sim.state.visitors.push(v);
    sim.tickStallsForTest(2);
    assert.ok(v.hunger < 80);
    assert.ok(v.heldProp !== "none");
    assert.ok(v.litterCooldown < 10);
    assert.ok(v.thoughtEmoji === "🍔" || v.interactTimer > 0);
  });

  it("averages visitor mood into park satisfaction (0–5 stars scale)", () => {
    const sim = new Simulation();
    sim.state.visitors = [
      mockVisitor({ id: "a", pos: { ...sim.grid.gatePos }, mood: 95 }),
      mockVisitor({ id: "b", pos: { ...sim.grid.gatePos }, mood: 90 }),
    ];
    sim.state.satisfaction = 40;
    for (let i = 0; i < 25; i++) sim.tickSatisfactionForTest();
    assert.ok(sim.state.satisfaction > 40);
    const stars = Math.max(0, Math.min(5, Math.round(sim.state.satisfaction / 20)));
    assert.ok(stars >= 2 && stars <= 5);
  });
});
