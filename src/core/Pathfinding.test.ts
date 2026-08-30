import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GridSystem } from "./GridSystem.ts";
import { astar } from "./Pathfinding.ts";

describe("astar pathfinding", () => {
  it("finds a path after player paves from the gate", () => {
    const grid = new GridSystem();
    // Empty lot: only gate tiles are walkable until the player builds paths
    assert.equal(astar(grid, { x: 11, y: 15 }, { x: 11, y: 10 }).length, 0);
    for (const y of [14, 13, 12, 11, 10]) grid.set(11, y, "path");
    const path = astar(grid, { x: 11, y: 15 }, { x: 11, y: 10 });
    assert.ok(path.length > 1);
    assert.equal(path[0]!.x, 11);
    assert.equal(path[0]!.y, 15);
  });

  it("returns empty when blocked", () => {
    const grid = new GridSystem();
    const path = astar(grid, { x: 0, y: 0 }, { x: 10, y: 11 });
    assert.equal(path.length, 0);
  });
});
