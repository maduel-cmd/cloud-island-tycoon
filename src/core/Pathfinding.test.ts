import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GridSystem } from "./GridSystem.ts";
import { astar } from "./Pathfinding.ts";

describe("astar pathfinding", () => {
  it("finds a path after player paves from the gate", () => {
    const grid = new GridSystem();
    const gate = grid.gatePos;
    const dest = { x: gate.x, y: gate.y - 5 };
    // Empty lot: only gate tiles are walkable until the player builds paths
    assert.equal(astar(grid, gate, dest).length, 0);
    for (let y = gate.y - 1; y >= dest.y; y--) grid.set(gate.x, y, "path");
    const path = astar(grid, gate, dest);
    assert.ok(path.length > 1);
    assert.equal(path[0]!.x, gate.x);
    assert.equal(path[0]!.y, gate.y);
  });

  it("returns empty when blocked", () => {
    const grid = new GridSystem();
    const path = astar(grid, { x: 0, y: 0 }, { x: 10, y: 11 });
    assert.equal(path.length, 0);
  });
});
