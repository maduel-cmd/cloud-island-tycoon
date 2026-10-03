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
      const g = buildAttractionMesh(def, mat, false, 1);
      assert.ok(g.children.length >= 2, `${def.id} too plain`);
      assert.equal(g.userData.shape, def.shape);
      assert.equal(g.userData.tier, 1);
      const hasMotion = Boolean(g.userData.spin) || Boolean(g.userData.bob);
      assert.ok(hasMotion, `${def.id} (${def.shape}) needs moving parts`);
      animateAttraction(g, 0.016, false, 1.2);
    }
  });

  it("makes each of 5 tiers visibly more grandiose", () => {
    const def = ATTRACTIONS.find((a) => a.shape === "carousel") ?? ATTRACTIONS[0]!;
    const counts: number[] = [];
    for (let tier = 1; tier <= 5; tier++) {
      const g = buildAttractionMesh(def, mat, false, tier);
      assert.equal(g.userData.tier, tier);
      counts.push(g.children.length);
      assert.ok(g.scale.x >= 1 + (tier - 1) * 0.09 - 0.001);
    }
    for (let i = 1; i < counts.length; i++) {
      assert.ok(
        counts[i]! > counts[i - 1]!,
        `tier ${i + 1} should add ornaments (${counts[i]} vs ${counts[i - 1]})`,
      );
    }
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
