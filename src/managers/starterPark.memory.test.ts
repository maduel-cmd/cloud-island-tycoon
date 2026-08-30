import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "./Simulation.ts";
import { getStall, STALLS } from "../data/stalls.ts";

/** כלל זיכרון: רק מגרש+שער (ורכיבי כניסה) — תוספות בבנק הבנייה */
describe("memory: starter lot is empty bank (no pre-placed content)", () => {
  it("starts with zero staff — hire from bank only", () => {
    const sim = new Simulation();
    assert.equal(sim.state.staff.length, 0);
  });

  it("starts with zero attractions, stalls, trash, bins, benches, decor, parking, warehouse", () => {
    const sim = new Simulation();
    assert.equal(sim.state.attractions.length, 0);
    assert.equal(sim.state.stalls.length, 0);
    assert.equal(sim.state.trash.length, 0);
    assert.equal(sim.binCount(), 0);
    assert.equal(sim.benchCount(), 0);
    assert.equal(sim.decorCount(), 0);
    assert.equal(sim.state.visitors.length, 0);
    assert.equal(sim.state.parking.length, 0);
    assert.equal(sim.state.parkingBays, 0);
    assert.equal(sim.state.warehouseBuilt, false);
    assert.equal(sim.state.warehouseStock, 0);
  });

  it("keeps starter layout to lot + gate path only", () => {
    const sim = new Simulation();
    let pathCount = 0;
    let parkingTiles = 0;
    for (let y = 0; y < sim.grid.height; y++) {
      for (let x = 0; x < sim.grid.width; x++) {
        const t = sim.grid.get(x, y);
        if (t === "path") pathCount += 1;
        if (t === "parking" || t === "road") parkingTiles += 1;
      }
    }
    // Gate twin tiles only
    assert.equal(pathCount, 2);
    assert.equal(parkingTiles, 0);
    assert.equal(sim.grid.get(sim.grid.gatePos.x, sim.grid.gatePos.y), "path");
  });

  it("places parking and warehouse from the build bank", () => {
    const sim = new Simulation();
    assert.equal(sim.placeParking({ x: 10, y: 10 }), true);
    assert.equal(sim.state.parkingBays, 1);
    assert.equal(sim.grid.get(10, 10), "parking");
    assert.equal(sim.placeWarehouse({ x: 8, y: 9 }), true);
    assert.equal(sim.state.warehouseBuilt, true);
    assert.ok(sim.state.warehouseStock > 0);
  });

  it("keeps free starter items in starterKit for build-menu placement", () => {
    const sim = new Simulation();
    const kit = sim.state.starterKit;
    assert.equal(kit.attractionLeft, 1);
    assert.equal(kit.stallLeft, 1);
    assert.equal(kit.binLeft, 1);
    assert.equal(kit.janitorLeft, 2);
    assert.equal(kit.runnerLeft, 2);
    assert.ok(getStall(kit.stallId));
  });

  it("hires starter janitors from bank vouchers without pre-spawn", () => {
    const sim = new Simulation();
    assert.equal(sim.state.staff.length, 0);
    sim.hireStaff("janitor");
    assert.equal(sim.state.staff.length, 1);
    assert.equal(sim.state.starterKit.janitorLeft, 1);
    assert.equal(sim.state.staff[0]!.role, "janitor");
  });

  it("lists balloon_vendor in the stalls build bank", () => {
    assert.ok(STALLS.some((s) => s.id === "balloon_vendor"));
    const def = getStall("balloon_vendor");
    assert.equal(def?.nameHe, "מוכר בלונים");
    assert.equal(def?.icon, "balloon");
    assert.equal(def?.buyMoodBoost, 18);
  });

  it("legacy hat_balloon id resolves via getStall alias", () => {
    assert.equal(getStall("hat_balloon")?.id, "balloon_vendor");
  });
});
