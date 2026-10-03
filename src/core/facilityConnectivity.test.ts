import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getAttraction } from "../data/attractions.ts";
import { Simulation } from "../managers/Simulation.ts";

describe("path connectivity for facilities", () => {
  it("marks a far attraction as disconnected until a path is laid", () => {
    const sim = new Simulation();
    const gate = sim.grid.gatePos;
    const ridePos = { x: gate.x - 1, y: gate.y - 8 };
    const ok = sim.placeAttraction("grand_carousel", ridePos, true);
    assert.equal(ok, true);
    const a = sim.state.attractions[0]!;
    const def = getAttraction(a.defId)!;
    assert.equal(sim.entryTiles(a.pos, def.footprint.w, def.footprint.h).length, 0);
    assert.equal(sim.isFacilityConnected(a.pos, def.footprint.w, def.footprint.h), false);

    // Corridor from gate north to an entry tile south of the ride
    for (let y = gate.y - 1; y >= ridePos.y + (def.footprint.h ?? 1); y--) {
      assert.equal(sim.placePath({ x: gate.x, y }, true), true);
    }

    assert.ok(sim.entryTiles(a.pos, def.footprint.w, def.footprint.h).length > 0);
    assert.equal(sim.isFacilityConnected(a.pos, def.footprint.w, def.footprint.h), true);
  });

  it("pathToFacility returns empty when ride has no adjacent walkable tile", () => {
    const sim = new Simulation();
    const gate = sim.grid.gatePos;
    sim.placeAttraction("grand_carousel", { x: gate.x + 3, y: gate.y - 10 }, true);
    const a = sim.state.attractions[0]!;
    const def = getAttraction(a.defId)!;
    const path = sim.pathToFacility(sim.grid.gatePos, a.pos, def.footprint.w, def.footprint.h);
    assert.equal(path.length, 0);
  });
});
