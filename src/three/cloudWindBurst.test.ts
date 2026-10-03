import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeWindBurst, WIND_BURST_RADIUS } from "./cloudWindBurst.ts";

describe("cloudWindBurst", () => {
  it("only moves clouds inside the burst radius", () => {
    const impulses = computeWindBurst(0, 0, [
      { id: "near", x: 1, z: 0 },
      { id: "far", x: WIND_BURST_RADIUS + 2, z: 0 },
    ]);
    assert.equal(impulses.length, 1);
    assert.equal(impulses[0]!.id, "near");
    assert.ok(impulses[0]!.vx > 0);
  });

  it("pushes outward from the touch origin", () => {
    const impulses = computeWindBurst(0, 0, [
      { id: "e", x: 2, z: 0 },
      { id: "n", x: 0, z: -2 },
    ]);
    const e = impulses.find((i) => i.id === "e")!;
    const n = impulses.find((i) => i.id === "n")!;
    assert.ok(e.vx > 0);
    assert.ok(Math.abs(e.vz) < 0.01);
    assert.ok(n.vz < 0);
    assert.ok(Math.abs(n.vx) < 0.01);
    assert.ok(e.vy > 0 && n.vy > 0);
  });

  it("leaves an empty set alone", () => {
    assert.deepEqual(computeWindBurst(1, 1, []), []);
  });
});
