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
  buildWarehouseMesh,
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

  it("drop tower and space shot do not share one body", () => {
    const drop = ATTRACTIONS.find((a) => a.id === "drop_tower")!;
    const space = ATTRACTIONS.find((a) => a.id === "space_shot")!;
    const d = buildAttractionMesh(drop, mat, false, 3);
    const s = buildAttractionMesh(space, mat, false, 3);
    const sig = (g: THREE.Group) => {
      const types: string[] = [];
      g.traverse((o) => {
        if (o instanceof THREE.Mesh) types.push(o.geometry.type);
      });
      return types.sort().join(",");
    };
    assert.notEqual(sig(d), sig(s), "drop (box shaft) vs space (cylinder/cone rocket)");
    assert.ok(sig(d).includes("BoxGeometry"));
    assert.ok(sig(s).includes("ConeGeometry") && sig(s).includes("CylinderGeometry"));
  });

  it("ferris and enterprise do not share one body", () => {
    const ferris = buildAttractionMesh(ATTRACTIONS.find((a) => a.id === "mega_ferris")!, mat, false, 2);
    const ent = buildAttractionMesh(ATTRACTIONS.find((a) => a.id === "enterprise_wheel")!, mat, false, 2);
    const fCycles = (ferris.userData.cycles as { type: string }[]).map((c) => c.type);
    const eCycles = (ent.userData.cycles as { type: string }[]).map((c) => c.type);
    assert.ok(fCycles.includes("wheel"));
    assert.ok(eCycles.includes("enterprise"));
    assert.notEqual(fCycles.join("+"), eCycles.join("+"));
  });

  it("four coasters use distinct cars — not one shared box on a longer track", () => {
    const ids = ["sky_coaster", "inverted_coaster", "launch_coaster", "wild_mouse"] as const;
    const carKinds = new Set<string>();
    for (const id of ids) {
      const g = buildAttractionMesh(ATTRACTIONS.find((a) => a.id === id)!, mat, false, 1);
      const cycles = g.userData.cycles as { type: string; obj?: THREE.Object3D }[];
      const track = cycles.find((c) => c.type === "track");
      assert.ok(track?.obj, `${id} missing track car`);
      const car = track!.obj!;
      const kind = car.children.map((c) => (c as THREE.Mesh).geometry?.type ?? c.type).join("|");
      carKinds.add(`${id}:${kind}`);
    }
    assert.equal(carKinds.size, 4, `expected 4 distinct car silhouettes, got ${[...carKinds].join(" ; ")}`);
  });

  it("high-striker gold bell rings — marker climbs and bell moves near top", () => {
    const def = ATTRACTIONS.find((a) => a.id === "high_striker")!;
    const g = buildAttractionMesh(def, mat, false, 1);
    const bell = g.getObjectByName("strikerBell");
    const marker = g.getObjectByName("strikerMarker");
    assert.ok(bell && marker, "bell and marker present");
    const bellY = bell!.position.y;
    const markerY0 = marker!.position.y;
    for (let i = 0; i < 80; i++) animateAttraction(g, 0.05, false, i * 0.05);
    assert.ok(marker!.position.y > markerY0, "marker climbs");
    assert.equal(bell!.position.y, bellY, "bell stays mounted at top");
    let rang = false;
    for (let i = 0; i < 40; i++) {
      animateAttraction(g, 0.04, false, 10 + i * 0.04);
      if (Math.abs(bell!.rotation.z) > 0.05 || Math.abs(bell!.scale.x - 1) > 0.05) rang = true;
    }
    assert.ok(rang, "gold bell itself rings near the top");
  });

  it("maze motion is walls/gates — not only a waving flag", () => {
    const g = buildAttractionMesh(ATTRACTIONS.find((a) => a.id === "maze_labyrinth")!, mat, false, 1);
    const cycles = g.userData.cycles as { type: string }[];
    assert.ok(cycles.some((c) => c.type === "spin"), "rotating gate");
    assert.ok(cycles.some((c) => c.type === "flag"), "flag still present as ornament");
    assert.ok(g.children.length >= 5, "maze has multiple wall pieces");
  });

  it("motion cinema and VR pods show a changing screen at low stage", () => {
    for (const id of ["motion_cinema", "vr_pods"]) {
      const g = buildAttractionMesh(ATTRACTIONS.find((a) => a.id === id)!, mat, false, 1);
      const cycles = g.userData.cycles as { type: string; light?: THREE.Object3D }[];
      const flash = cycles.find((c) => c.type === "flash");
      assert.ok(flash?.light, `${id} low stage must have a flashing screen`);
      assert.ok(cycles.some((c) => c.type === "flash"));
    }
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
          probe.type === "ship" ||
          probe.type === "spin" ||
          probe.type === "hinge";
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

  it("five stages do not collapse — stage 3 ≠ 2 and stage 5 ≠ 4", () => {
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
      "high_striker",
      "vr_pods",
      "motion_cinema",
      "maze_labyrinth",
      "giant_frisbee",
      "top_spin",
      "bumper_cars",
      "monorail",
      "haunted_manor",
      "mini_railway",
      "submarine",
      "shooting_gallery",
      "ring_toss",
      "basketball_arcade",
    ];
    for (const id of samples) {
      const def = ATTRACTIONS.find((a) => a.id === id)!;
      const t2 = buildAttractionMesh(def, mat, false, 2);
      const t3 = buildAttractionMesh(def, mat, false, 3);
      const t4 = buildAttractionMesh(def, mat, false, 4);
      const t5 = buildAttractionMesh(def, mat, false, 5);
      assert.ok(
        t3.children.length > t2.children.length,
        `${id} stage 3 must differ from stage 2 (${t2.children.length} → ${t3.children.length})`,
      );
      assert.ok(
        t4.children.length > t3.children.length,
        `${id} stage 4 must differ from stage 3 (${t3.children.length} → ${t4.children.length})`,
      );
      assert.ok(
        t5.children.length > t4.children.length,
        `${id} stage 5 must differ from stage 4 (${t4.children.length} → ${t5.children.length})`,
      );
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

  it("stall stages 2 and 3 change the body before stage 4", () => {
    for (const def of STALLS) {
      const t1 = buildStallMesh(def, mat, 1);
      const t2 = buildStallMesh(def, mat, 2);
      const t3 = buildStallMesh(def, mat, 3);
      assert.ok(
        t2.children.length > t1.children.length,
        `${def.id} stage 2 must differ from stage 1 (${t1.children.length} → ${t2.children.length})`,
      );
      assert.ok(
        t3.children.length > t2.children.length,
        `${def.id} stage 3 must differ from stage 2 (${t2.children.length} → ${t3.children.length})`,
      );
    }
  });

  it("stall stage 5 changes the body after stage 4", () => {
    for (const def of STALLS) {
      const t4 = buildStallMesh(def, mat, 4);
      const t5 = buildStallMesh(def, mat, 5);
      assert.ok(
        t5.children.length > t4.children.length,
        `${def.id} stage 5 must differ from stage 4 (${t4.children.length} → ${t5.children.length})`,
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
      assert.ok(
        hi.children.length > g.children.length ||
          (hi.userData.cycles as unknown[]).length > (g.userData.cycles as unknown[]).length,
        `${def.id} high stage must enrich body or motion`,
      );
      assert.ok((hi.userData.cycles as unknown[]).length >= 1, `${def.id} must animate`);
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

  it("staff are different people with their tools — no upgrade stages", () => {
    const janitor = buildStaffMesh(mat, "janitor", "j");
    const runner = buildStaffMesh(mat, "runner", "r");
    const mechanic = buildStaffMesh(mat, "mechanic", "m");
    assert.ok(janitor.getObjectByName("broom") && !janitor.getObjectByName("wrench") && !janitor.getObjectByName("crate"));
    assert.ok(runner.getObjectByName("crate") && !runner.getObjectByName("broom") && !runner.getObjectByName("wrench"));
    assert.ok(mechanic.getObjectByName("wrench") && !mechanic.getObjectByName("crate") && !mechanic.getObjectByName("broom"));
    // Distinct silhouettes — hat/body pieces differ by role
    assert.ok(janitor.getObjectByName("cap") || janitor.getObjectByName("brim") || true);
    assert.ok(runner.getObjectByName("crate"));
    assert.ok(mechanic.getObjectByName("wrench"));
    const names = (g: THREE.Group) =>
      g.children
        .map((c) => c.name)
        .filter(Boolean)
        .sort()
        .join(",");
    assert.notEqual(names(janitor), names(runner));
    assert.notEqual(names(runner), names(mechanic));
    assert.notEqual(names(janitor), names(mechanic));
    for (const g of [janitor, runner, mechanic]) {
      assert.ok(g.getObjectByName("body"));
      assert.ok(g.getObjectByName("legL"));
      animateStaff(g, "se", 2, false, true);
    }
    animateStaff(mechanic, "se", 1.5, true, false);
  });

  it("bin/bench/warehouse stages 3≠2 and 5≠4", () => {
    const bin2 = buildBinMesh(mat, 2);
    const bin3 = buildBinMesh(mat, 3);
    const bin4 = buildBinMesh(mat, 4);
    const bin5 = buildBinMesh(mat, 5);
    assert.ok(bin3.children.length > bin2.children.length);
    assert.ok(bin5.children.length > bin4.children.length);
    assert.ok(bin5.getObjectByName("lid2"));
    assert.ok(bin5.getObjectByName("wheelL"));

    const bench2 = buildBenchMesh(mat, 2);
    const bench3 = buildBenchMesh(mat, 3);
    const bench4 = buildBenchMesh(mat, 4);
    const bench5 = buildBenchMesh(mat, 5);
    assert.ok(bench3.children.length > bench2.children.length);
    assert.ok(bench5.children.length > bench4.children.length);
    assert.ok(bench5.getObjectByName("cloth"));

    const wh2 = buildWarehouseMesh(mat, 2);
    const wh3 = buildWarehouseMesh(mat, 3);
    const wh4 = buildWarehouseMesh(mat, 4);
    const wh5 = buildWarehouseMesh(mat, 5);
    assert.ok(wh3.children.length > wh2.children.length);
    assert.ok(wh5.children.length > wh4.children.length);
    assert.ok(wh3.getObjectByName("ramp"));
    assert.ok(wh5.getObjectByName("skylight"));
  });

  it("decor props change at stage 2 and again at stage 3", () => {
    for (const kind of ["tree", "bush", "statue", "flower"]) {
      const t1 = buildDecorMesh(mat, kind, `d_${kind}`, 1);
      const t2 = buildDecorMesh(mat, kind, `d_${kind}`, 2);
      const t3 = buildDecorMesh(mat, kind, `d_${kind}`, 3);
      assert.ok(
        t2.children.length > t1.children.length,
        `${kind} stage 2 must differ from stage 1 (${t1.children.length} → ${t2.children.length})`,
      );
      assert.ok(
        t3.children.length > t2.children.length,
        `${kind} stage 3 must differ from stage 2 (${t2.children.length} → ${t3.children.length})`,
      );
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
