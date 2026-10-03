import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GAME_ANIMATIONS,
  GAME_STATIC_ASSETS,
  isAssetReady,
} from "./assets.ts";

describe("asset bank config", () => {
  it("registers janitor / mechanic animation slots", () => {
    assert.equal(GAME_ANIMATIONS.JANITOR_CLEANING?.id, "anim_janitor_cleaning");
    assert.equal(GAME_ANIMATIONS.MECHANIC_WALKING?.src, "");
    assert.equal(GAME_ANIMATIONS.MECHANIC_REPAIRING?.type, "video_animation");
  });

  it("points static concept art at local public files", () => {
    assert.ok(GAME_STATIC_ASSETS.PARK_MAP_ISOMETRIC?.src.includes("park-map-isometric"));
    assert.ok(GAME_STATIC_ASSETS.BALLOON_VENDOR_TILE?.src.includes("balloon-vendor-tile"));
    assert.ok(GAME_STATIC_ASSETS.VISITOR_SHEET?.src.includes("visitors/visitor-sheet"));
    assert.ok(GAME_STATIC_ASSETS.TILE_GRASS?.src.includes("tile-grass"));
    assert.ok(GAME_STATIC_ASSETS.TILE_PATH?.src.includes("tile-path"));
    assert.ok(GAME_STATIC_ASSETS.TILE_CLOUD_EDGE?.src.includes("tile-cloud-edge"));
    assert.ok(GAME_STATIC_ASSETS.CARD_CAROUSEL?.src.includes("card-carousel"));
    assert.ok(GAME_STATIC_ASSETS.CARD_COTTON_CANDY?.src.includes("card-cotton-candy"));
    assert.ok(GAME_STATIC_ASSETS.FAB_BUILD?.src.includes("icon-build"));
    assert.ok(GAME_STATIC_ASSETS.FAB_EXPAND?.src.includes("icon-expand"));
    assert.equal(isAssetReady(GAME_STATIC_ASSETS.BALLOON_VENDOR_TILE!), true);
    assert.equal(isAssetReady(GAME_STATIC_ASSETS.VISITOR_SHEET!), true);
    assert.equal(isAssetReady(GAME_STATIC_ASSETS.TILE_GRASS!), true);
    assert.equal(isAssetReady(GAME_STATIC_ASSETS.FAB_QUESTS!), true);
  });

  it("treats empty and generated placeholder URLs as not ready", () => {
    assert.equal(isAssetReady(GAME_ANIMATIONS.MECHANIC_WALKING!), false);
    assert.equal(isAssetReady(GAME_ANIMATIONS.JANITOR_CLEANING!), false);
  });
});
