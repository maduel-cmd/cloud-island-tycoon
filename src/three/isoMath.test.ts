import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { gridToWorld, worldToGrid, gridWorldBounds, ISO_TILE } from "./isoMath.ts";

describe("isoMath grid ↔ world", () => {
  it("round-trips integer grid cells", () => {
    for (const [x, y] of [
      [0, 0],
      [11, 15],
      [5, 8],
      [20, 3],
    ] as const) {
      const w = gridToWorld(x, y);
      const g = worldToGrid(w.x, w.z);
      assert.equal(g.x, x);
      assert.equal(g.y, y);
    }
  });

  it("uses a stable tile size", () => {
    assert.ok(ISO_TILE > 0.5 && ISO_TILE < 2);
  });

  it("gridWorldBounds covers all corners of the map", () => {
    const b = gridWorldBounds(40, 32);
    assert.ok(b.maxX > b.minX);
    assert.ok(b.maxZ > b.minZ);
    const c0 = gridToWorld(0, 0);
    const c1 = gridToWorld(39, 31);
    assert.ok(b.minX <= c0.x && b.maxX >= c0.x);
    assert.ok(b.minZ <= c0.z && b.maxZ >= c0.z);
    assert.ok(b.minX <= c1.x && b.maxX >= c1.x);
    assert.ok(b.minZ <= c1.z && b.maxZ >= c1.z);
  });
});
