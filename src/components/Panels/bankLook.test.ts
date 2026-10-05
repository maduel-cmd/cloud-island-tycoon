import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { ATTRACTIONS } from "../../data/attractions.ts";
import { STALLS } from "../../data/stalls.ts";
import { DECOR } from "../../data/decor.ts";
import { bankLookSrc, resolveBankLook } from "./bankLook.ts";

/** PNG IHDR color type 6 = RGBA (truecolor+alpha). */
function pngIsRgba(relPublicPath: string): boolean {
  const buf = readFileSync(`public${relPublicPath}`);
  // signature(8) + IHDR length(4) + "IHDR"(4) + width(4) + height(4) + bitDepth(1) + colorType(1)
  assert.equal(buf.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const colorType = buf[25];
  return colorType === 6;
}

describe("build bank look thumbs", () => {
  it("maps every attraction and stall card to a transparent bank-look by id", () => {
    for (const a of ATTRACTIONS) {
      const ref = resolveBankLook("attraction", a.id);
      assert.deepEqual(ref, { kind: "attraction", id: a.id });
      const src = bankLookSrc(ref!.kind, ref!.id);
      assert.ok(src.startsWith("/assets/ui/bank-looks/"));
      assert.ok(existsSync(`public${src}`), a.id);
      assert.ok(pngIsRgba(src), `${a.id} must be RGBA bank thumb`);
    }
    for (const s of STALLS) {
      const ref = resolveBankLook("stall", s.id);
      assert.deepEqual(ref, { kind: "stall", id: s.id });
      const src = bankLookSrc(ref!.kind, ref!.id);
      assert.ok(existsSync(`public${src}`), s.id);
      assert.ok(pngIsRgba(src), `${s.id} must be RGBA bank thumb`);
    }
  });

  it("maps util / decor / hire cards to prop or staff looks; parking stays SVG", () => {
    assert.deepEqual(resolveBankLook("util", "path"), { kind: "prop", id: "path" });
    assert.deepEqual(resolveBankLook("util", "bin"), { kind: "prop", id: "bin" });
    assert.deepEqual(resolveBankLook("util", "bench"), { kind: "prop", id: "bench" });
    assert.deepEqual(resolveBankLook("util", "warehouse"), { kind: "prop", id: "warehouse" });
    assert.equal(resolveBankLook("util", "parking"), null);
    assert.deepEqual(resolveBankLook("util", "hire_janitor"), { kind: "staff", id: "janitor" });
    assert.deepEqual(resolveBankLook("util", "hire_runner"), { kind: "staff", id: "runner" });
    assert.deepEqual(resolveBankLook("util", "hire_mechanic"), { kind: "staff", id: "mechanic" });
    for (const d of DECOR) {
      const ref = resolveBankLook("util", `decor:${d.id}`);
      assert.deepEqual(ref, { kind: "prop", id: d.id });
      assert.ok(existsSync(`public${bankLookSrc(ref!.kind, ref!.id)}`), d.id);
    }
  });

  it("ships inverted_coaster hang-sway motion; bank thumb stays separate RGBA", () => {
    for (let f = 0; f < 4; f++) {
      assert.ok(existsSync(`public/assets/looks/attraction/inverted_coaster/${f}.png`));
    }
    assert.ok(existsSync("public/assets/looks/attraction/inverted_coaster.png"));
    assert.ok(existsSync("public/assets/ui/bank-looks/attraction/inverted_coaster.png"));
    assert.ok(pngIsRgba("/assets/ui/bank-looks/attraction/inverted_coaster.png"));
    // Park still must remain RGB (color type 2), not rewritten as bank RGBA
    const park = readFileSync("public/assets/looks/attraction/inverted_coaster.png");
    assert.equal(park.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(park[25], 2, "park inverted still must stay RGB");
  });
});
