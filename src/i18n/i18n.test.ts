import assert from "node:assert/strict";
import { LOCALES, t, setLocale } from "./catalog";
import {
  attractionDisplayName,
  stallDisplayName,
  utilDisplayName,
} from "./names";

const keys = [
  "brand",
  "welcomeCta",
  "buildBankTitle",
  "buildNow",
  "coasters",
  "unlockLevel",
  "hire",
  "language",
] as const;

for (const loc of LOCALES) {
  setLocale(loc.id);
  for (const key of keys) {
    const value = t(key, loc.id, key === "unlockLevel" ? { n: 3 } : undefined);
    assert.ok(value && value !== key, `missing ${key} for ${loc.id}`);
    if (key === "unlockLevel") {
      assert.ok(value.includes("3"), `unlockLevel should interpolate n for ${loc.id}`);
    }
  }
  assert.ok(
    attractionDisplayName("sky_coaster", "רכבת שמיים", "Sky Coaster", loc.id).length > 0,
  );
  assert.ok(
    stallDisplayName("cotton_candy", "צמר גפן מתוק", "Cotton Candy", loc.id).length > 0,
  );
  assert.ok(utilDisplayName("bin", loc.id).length > 0);
}

assert.equal(LOCALES.length, 4);
assert.deepEqual(
  LOCALES.map((l) => l.id),
  ["he", "en", "ar", "zh"],
);

// Memory rule: welcome must NOT claim parking is pre-placed
for (const loc of LOCALES) {
  const body = t("welcomeBody", loc.id);
  assert.ok(!/וחניה בלבד|and parking only|وموقف فقط|大门和停车场/.test(body), `welcomeBody still implies starter parking (${loc.id})`);
  assert.ok(/מגרש ריק|empty lot|أرض فارغة|空地/.test(body), `welcomeBody should mention empty lot (${loc.id})`);
}

console.log("i18n catalog + names OK for he/en/ar/zh");
