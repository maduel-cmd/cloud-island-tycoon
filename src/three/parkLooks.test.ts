import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { existsSync } from "node:fs";
import { lookAsset, lookSrcCandidates, motionFrameSrc, applyLookBillboard, tryApplyEntityLook } from "./parkLooks.ts";
import { LOOK_CATALOG, LOOK_SKIP_IDS, MOTION_SKIP_IDS, shouldSkipLook, shouldSkipMotion } from "./lookRegistry.ts";
import { isAssetReady } from "../config/assets.ts";

describe("parkLooks image wiring", () => {
  it("lists look path candidates without inventing files", () => {
    const paths = lookSrcCandidates("attraction", "sky_coaster");
    assert.ok(paths.some((p) => p.includes("/assets/looks/attraction/sky_coaster.png")));
    assert.ok(paths.some((p) => p.includes(".webp")));
  });

  it("marks empty look assets as not ready until files arrive", () => {
    const asset = lookAsset("staff", "janitor");
    assert.equal(asset.type, "sprite_image");
    assert.ok(asset.src.startsWith("/assets/looks/staff/janitor."));
    assert.equal(isAssetReady(asset), true);
  });

  it("applies gate and inverted coaster looks — no longer skipped", () => {
    assert.equal(LOOK_SKIP_IDS.size, 0);
    assert.equal(shouldSkipLook("gate"), false);
    assert.equal(shouldSkipLook("gate_arch"), false);
    assert.equal(shouldSkipLook("inverted_coaster"), false);
    assert.equal(shouldSkipLook("sky_coaster"), false);
    assert.ok(LOOK_CATALOG.some((e) => e.kind === "attraction" && e.id === "inverted_coaster"));
    assert.ok(LOOK_CATALOG.some((e) => e.kind === "prop" && e.id === "gate"));
    assert.equal(isAssetReady(lookAsset("prop", "gate")), true);
    assert.equal(isAssetReady(lookAsset("attraction", "inverted_coaster")), true);
  });

  it("catalogs every shipped look id", () => {
    assert.ok(LOOK_CATALOG.length >= 62);
    assert.ok(LOOK_CATALOG.some((e) => e.kind === "prop" && e.id === "path"));
    assert.ok(LOOK_CATALOG.some((e) => e.kind === "attraction" && e.id === "giant_frisbee"));
    assert.ok(LOOK_CATALOG.some((e) => e.kind === "stall" && e.id === "balloon_vendor"));
  });

  it("wires motion for inverted coaster and mini railway; MOTION_SKIP stays empty", () => {
    assert.equal(shouldSkipMotion("inverted_coaster"), false);
    assert.equal(shouldSkipMotion("mini_railway"), false);
    assert.equal(shouldSkipMotion("gate"), false);
    assert.equal(shouldSkipMotion("sky_coaster"), false);
    assert.equal(MOTION_SKIP_IDS.size, 0);
    for (let f = 0; f < 4; f++) {
      assert.ok(existsSync(`public/assets/looks/attraction/mini_railway/${f}.png`));
      assert.ok(existsSync(`public/assets/looks/attraction/inverted_coaster/${f}.png`));
    }
  });

  it("ships four motion frames for every wired look (skip set empty or no pack)", () => {
    for (const { kind, id } of LOOK_CATALOG) {
      if (shouldSkipMotion(id)) {
        assert.equal(
          existsSync(`public/assets/looks/${kind}/${id}/0.png`),
          false,
          `${id} must not have a motion pack while skipped`,
        );
        continue;
      }
      for (let f = 0; f < 4; f++) {
        const rel = `public/assets/looks/${kind}/${id}/${f}.png`;
        assert.ok(existsSync(rel), `missing ${rel}`);
        assert.equal(motionFrameSrc(kind, id, f), `/assets/looks/${kind}/${id}/${f}.png`);
      }
    }
  });

  it("look tier accents grow at every stage so upgrades stay visible with stills", () => {
    // Accent counts match addLookTierAccents: base; +rail; +2 posts +beam; +rim; +crown +spark
    const expected = [1, 2, 5, 6, 8];
    for (let i = 1; i < 5; i++) {
      assert.ok(
        expected[i]! > expected[i - 1]!,
        `look tier ${i + 1} accents must exceed tier ${i}`,
      );
    }
    // Soft-fail without a loaded still must not throw
    const soft = new THREE.Group();
    soft.userData.tier = 3;
    tryApplyEntityLook(soft, "prop", "bin", undefined, undefined, 3);
    assert.equal(soft.userData.hasLookImage ?? false, false);
    // applyLookBillboard without Image returns false (node test env)
    const g = new THREE.Group();
    const applied = applyLookBillboard(g, "prop", "bin", { tier: 4, width: 1.2, height: 1.2 });
    assert.equal(applied, false);
  });
});
