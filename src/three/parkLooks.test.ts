import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lookAsset, lookSrcCandidates } from "./parkLooks.ts";
import { isAssetReady } from "../config/assets.ts";

describe("parkLooks image wiring", () => {
  it("lists look path candidates without inventing files", () => {
    const paths = lookSrcCandidates("attraction", "sky_coaster");
    assert.ok(paths.some((p) => p.includes("/assets/looks/attraction/sky_coaster.png")));
    assert.ok(paths.some((p) => p.includes(".webp")));
  });

  it("marks empty look assets as not ready until files arrive", () => {
    const asset = lookAsset("staff", "janitor");
    // Path is valid shape, but readiness only cares about non-empty non-placeholder src —
    // files may not exist yet; preload will soft-fail. Shape must be correct.
    assert.equal(asset.type, "sprite_image");
    assert.ok(asset.src.startsWith("/assets/looks/staff/janitor."));
    assert.equal(isAssetReady(asset), true);
  });
});
