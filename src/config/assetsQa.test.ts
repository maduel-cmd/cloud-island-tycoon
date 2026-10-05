/**
 * Assets QA — Tipsy Dragon spirit: catalog entries must exist on disk with a min size.
 * Fails the suite when looks or static sprites go missing / shrink to stubs.
 * Avoids importing parkLooks (three.js) so this file runs in node without WebGL deps loaded.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  GAME_ANIMATIONS,
  GAME_STATIC_ASSETS,
  isAssetReady,
  type GameAsset,
} from "./assets.ts";
import { LOOK_CATALOG, shouldSkipLook, shouldSkipMotion } from "../three/lookRegistry.ts";

/** Still / motion PNG stubs below this are treated as missing art. */
const MIN_LOOK_BYTES = 1024;
/** Local public sprites (tiles, fab icons, sheets). */
const MIN_STATIC_BYTES = 512;
/** Staff / look motion frames should be real art, not tiny stubs. */
const MIN_MOTION_BYTES = 2048;
/** Still looks are expected ≥ 256px on the short edge (Tipsy-style floor). */
const MIN_LOOK_EDGE_PX = 256;

const STILL_EXT = ["png", "webp", "jpg", "jpeg"] as const;

function publicPathFromSrc(src: string): string {
  const cleaned = src.replace(/^\//, "");
  return join("public", cleaned);
}

function lookStillCandidates(kind: string, id: string): string[] {
  const safe = id.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
  return STILL_EXT.map((ext) => `/assets/looks/${kind}/${safe}.${ext}`);
}

function motionFramePublicSrc(kind: string, id: string, frame: number): string {
  const safe = id.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
  const f = Math.max(0, Math.min(3, Math.floor(frame)));
  return `/assets/looks/${kind}/${safe}/${f}.png`;
}

function assertFileReady(relPublic: string, minBytes: number, label: string): void {
  assert.ok(existsSync(relPublic), `missing ${label}: ${relPublic}`);
  const size = statSync(relPublic).size;
  assert.ok(
    size >= minBytes,
    `${label} too small (${size}B < ${minBytes}B): ${relPublic}`,
  );
}

/** Read PNG IHDR width/height without pulling sharp/canvas. */
function readPngSize(relPublic: string): { width: number; height: number } | null {
  if (!relPublic.endsWith(".png") || !existsSync(relPublic)) return null;
  const buf = readFileSync(relPublic);
  if (buf.length < 24) return null;
  if (buf.toString("ascii", 1, 4) !== "PNG") return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

function assertMinDimensions(relPublic: string, minEdge: number, label: string): void {
  const dims = readPngSize(relPublic);
  if (!dims) return; // non-PNG stills skip dimension gate
  const edge = Math.min(dims.width, dims.height);
  assert.ok(
    edge >= minEdge,
    `${label} too small (${dims.width}x${dims.height}, edge ${edge} < ${minEdge}): ${relPublic}`,
  );
}

describe("assetsQa — looks catalog on disk", () => {
  it("every LOOK_CATALOG still exists with min size (unless skipped)", () => {
    for (const { kind, id } of LOOK_CATALOG) {
      if (shouldSkipLook(id)) continue;
      const candidates = lookStillCandidates(kind, id);
      const hit = candidates
        .map((src) => publicPathFromSrc(src))
        .find((p) => existsSync(p));
      assert.ok(hit, `no still for ${kind}/${id} under public/assets/looks`);
      assertFileReady(hit!, MIN_LOOK_BYTES, `${kind}/${id} still`);
      assertMinDimensions(hit!, MIN_LOOK_EDGE_PX, `${kind}/${id} still`);
    }
  });

  it("every wired look ships 4 motion frames with min size", () => {
    for (const { kind, id } of LOOK_CATALOG) {
      if (shouldSkipLook(id) || shouldSkipMotion(id)) continue;
      for (let f = 0; f < 4; f++) {
        const rel = publicPathFromSrc(motionFramePublicSrc(kind, id, f));
        assertFileReady(rel, MIN_MOTION_BYTES, `${kind}/${id} motion[${f}]`);
      }
    }
  });

  it("catalog stays large enough for a marketable park", () => {
    assert.ok(LOOK_CATALOG.length >= 62);
  });

  it("inverted_coaster ships motion pack (no longer MOTION_SKIP)", () => {
    assert.equal(shouldSkipMotion("inverted_coaster"), false);
    for (let f = 0; f < 4; f++) {
      assertFileReady(
        publicPathFromSrc(motionFramePublicSrc("attraction", "inverted_coaster", f)),
        MIN_MOTION_BYTES,
        `inverted_coaster motion[${f}]`,
      );
    }
  });
});

describe("assetsQa — static public assets", () => {
  it("GAME_STATIC_ASSETS local files exist with min size when marked ready", () => {
    for (const [key, asset] of Object.entries(GAME_STATIC_ASSETS) as [string, GameAsset][]) {
      if (!isAssetReady(asset)) continue;
      if (!asset.src.startsWith("/assets/")) continue;
      assertFileReady(publicPathFromSrc(asset.src), MIN_STATIC_BYTES, `static ${key}`);
    }
  });

  it("promo + og image files exist with min size", () => {
    const promoFiles = [
      "public/og-image.jpg",
      "public/promo/01-park-overview.jpg",
      "public/promo/02-balloon-vendor.jpg",
      "public/promo/03-logo-mark.jpg",
      "docs/promo/01-park-overview.jpg",
      "docs/promo/og-image.jpg",
    ];
    for (const rel of promoFiles) {
      assertFileReady(rel, MIN_STATIC_BYTES, `promo ${rel}`);
    }
  });
});

describe("assetsQa — staff local anims ready (no empty / googleusercontent)", () => {
  it("staff animation slots point at local look motion frames", () => {
    for (const [key, asset] of Object.entries(GAME_ANIMATIONS) as [string, GameAsset][]) {
      assert.equal(isAssetReady(asset), true, `${key} must be ready with local art`);
      assert.equal(asset.src.includes("googleusercontent"), false, `${key} must not point at googleusercontent`);
      assert.ok(asset.src.startsWith("/assets/looks/staff/"), `${key} src must be local staff look`);
      assertFileReady(publicPathFromSrc(asset.src), MIN_MOTION_BYTES, `anim ${key}`);
      assert.ok(asset.frames && asset.frames.length === 4, `${key} needs 4 motion frames`);
      for (const frame of asset.frames!) {
        assertFileReady(publicPathFromSrc(frame), MIN_MOTION_BYTES, `anim ${key} frame`);
      }
    }
  });

  it("rejects googleusercontent and empty srcs via isAssetReady", () => {
    assert.equal(isAssetReady({ id: "x", name: "x", type: "sprite_image", src: "" }), false);
    assert.equal(
      isAssetReady({
        id: "x",
        name: "x",
        type: "video_animation",
        src: "http://googleusercontent.com/generated_video_content/1",
      }),
      false,
    );
    assert.equal(
      isAssetReady({
        id: "x",
        name: "x",
        type: "sprite_image",
        src: "https://lh3.googleusercontent.com/foo",
      }),
      false,
    );
    assert.equal(
      isAssetReady({
        id: "ok",
        name: "ok",
        type: "sprite_image",
        src: "/assets/looks/prop/bin.png",
      }),
      true,
    );
  });
});
