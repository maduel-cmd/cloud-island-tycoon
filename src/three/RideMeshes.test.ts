import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { ATTRACTIONS } from "../data/attractions.ts";
import { STALLS } from "../data/stalls.ts";
import { animateAttraction, buildAttractionMesh, buildStallMesh } from "./RideMeshes.ts";

describe("RideMeshes shape builders", () => {
  const matCache = new Map<string, THREE.MeshStandardMaterial>();
  const mat = (key: string, color: number) => {
    const k = `${key}_${color}`;
    let m = matCache.get(k);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color });
      matCache.set(k, m);
    }
    return m;
  };

  it("builds a mesh group for every attraction shape", () => {
    const shapes = new Set(ATTRACTIONS.map((a) => a.shape));
    assert.ok(shapes.size >= 7);
    for (const def of ATTRACTIONS) {
      const g = buildAttractionMesh(def, mat, false);
      assert.ok(g.children.length >= 2, `${def.id} too plain`);
      assert.equal(g.userData.shape, def.shape);
      assert.equal(g.userData.tier, 1);
      animateAttraction(g, 0.016, false, 1.2);
    }
  });

  it("every working ride has spin or bob motion", () => {
    for (const def of ATTRACTIONS) {
      const g = buildAttractionMesh(def, mat, false, 1);
      assert.ok(g.userData.spin || g.userData.bob, `${def.id} (${def.shape}) is static`);
      const spin = g.userData.spin as THREE.Object3D | undefined;
      const bob = g.userData.bob as THREE.Object3D | undefined;
      const before = {
        x: spin?.rotation.x ?? 0,
        y: spin?.rotation.y ?? 0,
        z: spin?.rotation.z ?? 0,
        bobY: bob?.position.y ?? 0,
      };
      animateAttraction(g, 0.05, false, 1.5);
      const after = {
        x: spin?.rotation.x ?? 0,
        y: spin?.rotation.y ?? 0,
        z: spin?.rotation.z ?? 0,
        bobY: bob?.position.y ?? 0,
      };
      const moved =
        Math.abs(after.x - before.x) > 1e-6 ||
        Math.abs(after.y - before.y) > 1e-6 ||
        Math.abs(after.z - before.z) > 1e-6 ||
        Math.abs(after.bobY - before.bobY) > 1e-6;
      assert.ok(moved, `${def.id} animateAttraction did not move`);
    }
  });

  it("five visual tiers grow more grandiose (appearance only)", () => {
    const def = ATTRACTIONS[0]!;
    const counts: number[] = [];
    const scales: number[] = [];
    for (let tier = 1; tier <= 5; tier++) {
      const g = buildAttractionMesh(def, mat, false, tier);
      assert.equal(g.userData.tier, tier);
      counts.push(g.children.length);
      scales.push(g.scale.x);
    }
    for (let i = 1; i < 5; i++) {
      assert.ok(
        scales[i]! > scales[i - 1]!,
        `tier ${i + 1} should be larger than tier ${i}`,
      );
      assert.ok(
        counts[i]! >= counts[i - 1]!,
        `tier ${i + 1} should have at least as many visual parts as tier ${i}`,
      );
    }
    assert.ok(counts[4]! > counts[0]!, "tier 5 must look richer than tier 1");
    assert.ok(Math.abs(scales[4]! - 1.4) < 1e-6, "tier 5 scale is 1.4");
  });

  it("builds richer stall meshes including balloon cart", () => {
    for (const def of STALLS) {
      const g = buildStallMesh(def, mat);
      assert.ok(g.children.length >= 2, `${def.id} too plain`);
    }
    const balloon = STALLS.find((s) => s.icon === "balloon");
    assert.ok(balloon);
    const g = buildStallMesh(balloon!, mat);
    assert.ok(g.children.length >= 6);
  });
});
