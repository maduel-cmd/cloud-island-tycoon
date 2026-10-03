import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { ATTRACTIONS } from "../../data/attractions.ts";
import { STALLS } from "../../data/stalls.ts";
import { DECOR } from "../../data/decor.ts";
import { bankLookSrc, resolveBankLook } from "./bankLook.ts";

describe("build bank look thumbs", () => {
  it("maps every attraction and stall card to a shipped still by id", () => {
    for (const a of ATTRACTIONS) {
      const ref = resolveBankLook("attraction", a.id);
      assert.deepEqual(ref, { kind: "attraction", id: a.id });
      assert.ok(existsSync(`public${bankLookSrc(ref!.kind, ref!.id)}`), a.id);
    }
    for (const s of STALLS) {
      const ref = resolveBankLook("stall", s.id);
      assert.deepEqual(ref, { kind: "stall", id: s.id });
      assert.ok(existsSync(`public${bankLookSrc(ref!.kind, ref!.id)}`), s.id);
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

  it("does not invent inverted_coaster motion frames for the bank", () => {
    assert.equal(existsSync("public/assets/looks/attraction/inverted_coaster/0.png"), false);
    assert.ok(existsSync("public/assets/looks/attraction/inverted_coaster.png"));
  });
});
