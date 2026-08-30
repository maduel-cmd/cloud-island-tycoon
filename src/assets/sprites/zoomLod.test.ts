import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ZOOM_MAX, ZOOM_MIN } from "./ParkRenderer.ts";

describe("zoom LOD range", () => {
  it("allows wide zoom so close-up reveals ride detail", () => {
    assert.ok(ZOOM_MIN <= 0.4);
    assert.ok(ZOOM_MAX >= 3.0);
    assert.ok(ZOOM_MAX / ZOOM_MIN >= 8);
  });
});
