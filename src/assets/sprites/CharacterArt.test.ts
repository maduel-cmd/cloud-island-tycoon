import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { facingFromDelta, pickHair, pickSkin } from "./CharacterArt.ts";

describe("CharacterArt helpers", () => {
  it("maps grid deltas to isometric facing", () => {
    assert.equal(facingFromDelta(1, 0), "se");
    assert.equal(facingFromDelta(-1, 0), "nw");
    assert.equal(facingFromDelta(0, 1), "sw");
    assert.equal(facingFromDelta(0, -1), "ne");
  });

  it("picks stable skin/hair from seed", () => {
    assert.equal(pickSkin(0), pickSkin(0));
    assert.notEqual(pickSkin(0), pickSkin(1));
    assert.ok(pickHair(3).startsWith("#"));
  });
});
