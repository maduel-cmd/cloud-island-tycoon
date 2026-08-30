import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  visitorSheetRect,
  visitorFacingFlipX,
  visitorAgeBand,
  visitorPropFromArchetype,
  heldPropFromStallIcon,
  VISITOR_SHEET,
} from "./VisitorSheet.ts";

describe("VisitorSheet slicing", () => {
  it("uses a 12×4 grid of 85×139 cells covering 40 gameplay archetypes", () => {
    assert.equal(VISITOR_SHEET.cols, 12);
    assert.equal(VISITOR_SHEET.rows, 4);
    assert.equal(VISITOR_SHEET.cellW, 85);
    assert.equal(VISITOR_SHEET.cellH, 139);
    assert.equal(VISITOR_SHEET.frameCount, 48);
    assert.equal(VISITOR_SHEET.archetypeCount, 40);
    assert.equal(VISITOR_SHEET.cols * VISITOR_SHEET.cellW, 1020);
    assert.equal(VISITOR_SHEET.rows * VISITOR_SHEET.cellH, 556);
  });

  it("maps archetype indices row-major without overlap", () => {
    const a = visitorSheetRect(0);
    assert.deepEqual(a, { sx: 0, sy: 0, sw: 85, sh: 139 });
    const b = visitorSheetRect(11);
    assert.equal(b.sx, 11 * 85);
    assert.equal(b.sy, 0);
    const c = visitorSheetRect(12);
    assert.equal(c.sx, 0);
    assert.equal(c.sy, 139);
    const d = visitorSheetRect(39);
    assert.equal(d.sx, (39 % 12) * 85);
    assert.equal(d.sy, Math.floor(39 / 12) * 139);
  });

  it("wraps indices into the sheet", () => {
    assert.deepEqual(visitorSheetRect(48), visitorSheetRect(0));
    assert.deepEqual(visitorSheetRect(-1), visitorSheetRect(47));
  });

  it("flips west-facing visitors", () => {
    assert.equal(visitorFacingFlipX("ne"), false);
    assert.equal(visitorFacingFlipX("se"), false);
    assert.equal(visitorFacingFlipX("nw"), true);
    assert.equal(visitorFacingFlipX("sw"), true);
  });

  it("classifies age bands and props from the sheet layout", () => {
    assert.equal(visitorAgeBand(0), "child");
    assert.equal(visitorAgeBand(20), "adult");
    assert.equal(visitorAgeBand(35), "senior");
    assert.equal(visitorPropFromArchetype(0), "balloons");
    assert.equal(visitorPropFromArchetype(4), "ice_cream");
    assert.equal(visitorPropFromArchetype(6), "camera");
    assert.equal(heldPropFromStallIcon("balloon"), "balloons");
    assert.equal(heldPropFromStallIcon("food"), "ice_cream");
  });
});
