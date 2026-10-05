import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { gridToWorld, worldToGrid, gridWorldBounds, ISO_TILE, TILE_MESH_SCALE } from "./isoMath.ts";

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

  it("tile mesh scale overlaps enough to close path/hex seams", () => {
    // Historical 0.98 left visible meadow gaps between raised path tiles
    assert.ok(TILE_MESH_SCALE >= 1.0, "TILE_MESH_SCALE must be >= 1 to avoid seam gaps");
    assert.ok(TILE_MESH_SCALE <= 1.08, "TILE_MESH_SCALE should stay modest to avoid z-fight");
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
