import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lookAsset, lookSrcCandidates } from "./parkLooks.ts";
import { LOOK_CATALOG, shouldSkipLook } from "./lookRegistry.ts";
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

  it("keeps wrong gate and inverted coaster stills on procedural look", () => {
    assert.equal(shouldSkipLook("gate"), true);
    assert.equal(shouldSkipLook("gate_arch"), true);
    assert.equal(shouldSkipLook("inverted_coaster"), true);
    assert.equal(shouldSkipLook("sky_coaster"), false);
    assert.ok(!LOOK_CATALOG.some((e) => e.id === "inverted_coaster" || e.id === "gate"));
  });

  it("catalogs every shipped look id", () => {
    assert.ok(LOOK_CATALOG.length >= 60);
    assert.ok(LOOK_CATALOG.some((e) => e.kind === "prop" && e.id === "path"));
    assert.ok(LOOK_CATALOG.some((e) => e.kind === "attraction" && e.id === "giant_frisbee"));
    assert.ok(LOOK_CATALOG.some((e) => e.kind === "stall" && e.id === "balloon_vendor"));
  });
});
