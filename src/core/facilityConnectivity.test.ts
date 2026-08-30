import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getAttraction } from "../data/attractions.ts";
import { Simulation } from "../managers/Simulation.ts";

describe("path connectivity for facilities", () => {
  it("marks a far attraction as disconnected until a path is laid", () => {
    const sim = new Simulation();
    const ok = sim.placeAttraction("grand_carousel", { x: 10, y: 8 }, true);
    assert.equal(ok, true);
    const a = sim.state.attractions[0]!;
    const def = getAttraction(a.defId)!;
    assert.equal(sim.entryTiles(a.pos, def.footprint.w, def.footprint.h).length, 0);
    assert.equal(sim.isFacilityConnected(a.pos, def.footprint.w, def.footprint.h), false);

    // Full corridor from gate (y=15) north to an entry tile south of the ride (y=10)
    for (const y of [14, 13, 12, 11, 10]) {
      assert.equal(sim.placePath({ x: 11, y }, true), true);
    }

    assert.ok(sim.entryTiles(a.pos, def.footprint.w, def.footprint.h).length > 0);
    assert.equal(sim.isFacilityConnected(a.pos, def.footprint.w, def.footprint.h), true);
  });

  it("pathToFacility returns empty when ride has no adjacent walkable tile", () => {
    const sim = new Simulation();
    sim.placeAttraction("grand_carousel", { x: 14, y: 7 }, true);
    const a = sim.state.attractions[0]!;
    const def = getAttraction(a.defId)!;
    const path = sim.pathToFacility(sim.grid.gatePos, a.pos, def.footprint.w, def.footprint.h);
    assert.equal(path.length, 0);
  });
});
