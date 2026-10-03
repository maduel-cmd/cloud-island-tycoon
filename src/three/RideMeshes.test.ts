import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { ATTRACTIONS } from "../data/attractions.ts";
import { STALLS } from "../data/stalls.ts";
import { animateAttraction, buildAttractionMesh, buildStallMesh } from "./RideMeshes.ts";
import {
  animateStaff,
  buildBenchMesh,
  buildBinMesh,
  buildDecorMesh,
  buildStaffMesh,
} from "./ParkProps.ts";

describe("RideMeshes unique silhouettes + cycles", () => {
  const matCache = new Map<string, THREE.MeshStandardMaterial>();
  const mat = (key: string, color: number, opts?: Partial<THREE.MeshStandardMaterialParameters>) => {
    const k = `${key}_${color}`;
    let m = matCache.get(k);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, ...opts });
      matCache.set(k, m);
    }
    return m;
  };

  it("builds a mesh group for every attraction id", () => {
    assert.ok(ATTRACTIONS.length >= 20);
    for (const def of ATTRACTIONS) {
      const g = buildAttractionMesh(def, mat, false);
      assert.ok(g.children.length >= 1, `${def.id} empty`);
      assert.equal(g.userData.defId, def.id);
      assert.equal(g.userData.tier, 1);
      assert.ok(Array.isArray(g.userData.cycles), `${def.id} missing cycles`);
      assert.ok((g.userData.cycles as unknown[]).length >= 1, `${def.id} has no motion cycle`);
      animateAttraction(g, 0.016, false, 1.2);
    }
  });

  it("each attraction id gets its own cycle type family (not one shared bob/spin)", () => {
    const cycleTypes = new Map<string, string>();
    const childCounts = new Map<string, number>();
    for (const def of ATTRACTIONS) {
      const g = buildAttractionMesh(def, mat, false, 1);
      const cycles = g.userData.cycles as { type: string }[];
      cycleTypes.set(def.id, cycles.map((c) => c.type).sort().join("+"));
      childCounts.set(def.id, g.children.length);
    }
    assert.notEqual(cycleTypes.get("mega_ferris"), cycleTypes.get("pirate_ship"));
    assert.notEqual(cycleTypes.get("drop_tower"), cycleTypes.get("grand_carousel"));
    assert.notEqual(cycleTypes.get("shooting_gallery"), cycleTypes.get("ring_toss"));
    assert.notEqual(cycleTypes.get("swan_lake"), cycleTypes.get("log_flume"));
    // Coasters share track motion but different bodies (open hill vs closed loop hang)
    assert.notEqual(childCounts.get("sky_coaster"), childCounts.get("inverted_coaster"));
    assert.notEqual(cycleTypes.get("mega_ferris"), cycleTypes.get("enterprise_wheel"));
  });

  it("working rides move via cycles; broken rides freeze at stage 1", () => {
    for (const def of ATTRACTIONS) {
      const g = buildAttractionMesh(def, mat, false, 3);
      const cycles = g.userData.cycles as { type: string; obj?: THREE.Object3D; rim?: THREE.Object3D }[];
      assert.ok(cycles.length >= 1, `${def.id} no cycles`);
      const probe = cycles[0]!;
      const target = probe.obj ?? probe.rim;
      const before = target
        ? { x: target.rotation.x, y: target.rotation.y, z: target.rotation.z, py: target.position.y }
        : null;
      animateAttraction(g, 0.05, false, 1.5);
      if (before && target) {
        const moved =
          Math.abs(target.rotation.x - before.x) > 1e-6 ||
          Math.abs(target.rotation.y - before.y) > 1e-6 ||
          Math.abs(target.rotation.z - before.z) > 1e-6 ||
          Math.abs(target.position.y - before.py) > 1e-6 ||
          probe.type === "track" ||
          probe.type === "flash" ||
          probe.type === "blink" ||
          probe.type === "bumpers" ||
          probe.type === "climbDrop" ||
          probe.type === "carousel" ||
          probe.type === "swinger" ||
          probe.type === "teacups" ||
          probe.type === "wheel" ||
          probe.type === "enterprise" ||
          probe.type === "slide" ||
          probe.type === "ringDrop" ||
          probe.type === "bell" ||
          probe.type === "ballHoop" ||
          probe.type === "flag" ||
          probe.type === "sub" ||
          probe.type === "shake" ||
          probe.type === "pendulum" ||
          probe.type === "topSpin" ||
          probe.type === "ship";
        assert.ok(moved, `${def.id} animateAttraction did not move (${probe.type})`);
      }

      const broken = buildAttractionMesh(def, mat, true, 5);
      assert.equal(broken.userData.tier, 1);
      assert.equal(broken.userData.broken, true);
      const bCycles = broken.userData.cycles as { type: string; obj?: THREE.Object3D }[];
      const bProbe = bCycles[0];
      const bTarget = bProbe?.obj;
      const bBefore = bTarget ? bTarget.rotation.y : 0;
      animateAttraction(broken, 0.05, true, 2);
      if (bTarget) assert.equal(bTarget.rotation.y, bBefore);
    }
  });

  it("high stage changes each body — not a shared crown or scale ladder", () => {
    const samples = [
      "sky_coaster",
      "inverted_coaster",
      "launch_coaster",
      "wild_mouse",
      "drop_tower",
      "space_shot",
      "mega_ferris",
      "enterprise_wheel",
      "grand_carousel",
      "wave_swinger",
      "pirate_ship",
      "enchanted_teacups",
      "swan_lake",
      "log_flume",
      "shooting_gallery",
      "vr_pods",
    ];
    for (const id of samples) {
      const def = ATTRACTIONS.find((a) => a.id === id)!;
      const t1 = buildAttractionMesh(def, mat, false, 1);
      const t5 = buildAttractionMesh(def, mat, false, 5);
      assert.ok(Math.abs(t5.scale.x - 1) < 1e-6, `${id} high stage must keep unit scale`);
      assert.equal(t5.userData.signBoard, undefined, `${id} must not get a shared crown/sign`);
      assert.ok(
        t5.children.length > t1.children.length,
        `${id} high stage must add body parts (${t1.children.length} → ${t5.children.length})`,
      );
    }
  });

  it("builds richer stall product bodies; balloon is a cart with swaying strings", () => {
    for (const def of STALLS) {
      const g = buildStallMesh(def, mat, 3);
      assert.ok(g.children.length >= 2, `${def.id} too plain`);
      const hi = buildStallMesh(def, mat, 5);
      assert.ok(Math.abs(hi.scale.x - 1) < 1e-6, `${def.id} high stage unit scale`);
      assert.equal(hi.userData.signBoard, undefined, `${def.id} no shared crown`);
      assert.ok(hi.children.length >= g.children.length, `${def.id} high stage at least as rich`);
    }
    const balloon = STALLS.find((s) => s.icon === "balloon");
    assert.ok(balloon);
    const g = buildStallMesh(balloon!, mat, 1);
    assert.ok(g.children.length >= 6);
    const cycles = g.userData.cycles as { type: string }[];
    assert.ok(cycles.some((c) => c.type === "strings"));
  });
});

describe("ParkProps staff and tiered props", () => {
  const matCache = new Map<string, THREE.MeshStandardMaterial>();
  const mat = (key: string, color: number, opts?: Partial<THREE.MeshStandardMaterialParameters>) => {
    const k = `${key}_${color}`;
    let m = matCache.get(k);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, ...opts });
      matCache.set(k, m);
    }
    return m;
  };

  it("staff are people with tools — no upgrade stages", () => {
    for (const role of ["janitor", "runner", "mechanic"] as const) {
      const g = buildStaffMesh(mat, role, role);
      assert.ok(g.getObjectByName("body"));
      assert.ok(g.getObjectByName("legL"));
      if (role === "janitor") assert.ok(g.getObjectByName("broom"));
      if (role === "runner") assert.ok(g.getObjectByName("crate"));
      if (role === "mechanic") assert.ok(g.getObjectByName("wrench"));
      animateStaff(g, "se", 2, false, true);
      animateStaff(g, "se", 1.5, role === "mechanic", false);
    }
  });

  it("bin/bench/decor high tier change body, not a shared crown", () => {
    const bin1 = buildBinMesh(mat, 1);
    const bin5 = buildBinMesh(mat, 5);
    assert.ok(bin5.children.length > bin1.children.length);
    assert.ok(bin5.getObjectByName("lid2"));

    const bench1 = buildBenchMesh(mat, 1);
    const bench5 = buildBenchMesh(mat, 5);
    assert.ok(bench5.getObjectByName("cloth"));
    assert.ok(bench5.children.length > bench1.children.length);

    for (const kind of ["tree", "bush", "statue", "flower"]) {
      const lo = buildDecorMesh(mat, kind, `d_${kind}`, 1);
      const hi = buildDecorMesh(mat, kind, `d_${kind}_hi`, 5);
      assert.ok(hi.children.length >= lo.children.length, `${kind} high richer`);
    }
  });
});
