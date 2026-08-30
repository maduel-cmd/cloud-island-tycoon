import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ATTRACTIONS } from "./attractions.ts";
import { STALLS } from "./stalls.ts";

describe("catalog completeness", () => {
  it("has 30 attractions", () => {
    assert.equal(ATTRACTIONS.length, 30);
    const ids = new Set(ATTRACTIONS.map((a) => a.id));
    assert.equal(ids.size, 30);
  });

  it("has 20 stalls", () => {
    assert.equal(STALLS.length, 20);
    const ids = new Set(STALLS.map((s) => s.id));
    assert.equal(ids.size, 20);
  });
});
