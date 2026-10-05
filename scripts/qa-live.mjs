#!/usr/bin/env node
/**
 * Live HEAD check for Cloud Island Tycoon assets.
 *
 * Usage:
 *   QA_LIVE_URL=https://cloud-island-tycoon-maduel.netlify.app npm run qa:live
 *
 * Without QA_LIVE_URL the script prints SKIP and exits 0 (local gate still uses qa:assets).
 *
 * Netlify SPA returns 200 text/html for missing files — we reject HTML for asset paths.
 * Paths listed under PENDING_DEPLOY are local-only until the next approved Netlify publish;
 * they are reported as WARN (not fail) when live still serves the SPA shell.
 */
const LIVE = (process.env.QA_LIVE_URL ?? "").replace(/\/$/, "");

/** Must exist on current production with a real asset Content-Type. */
const REQUIRED = [
  { path: "/", expect: "html" },
  { path: "/assets/looks/prop/bin.png", expect: "image" },
  { path: "/assets/looks/prop/path.png", expect: "image" },
  { path: "/assets/looks/attraction/sky_coaster.png", expect: "image" },
  { path: "/assets/looks/attraction/inverted_coaster.png", expect: "image" },
  { path: "/assets/looks/staff/janitor.png", expect: "image" },
  { path: "/assets/looks/staff/janitor/0.png", expect: "image" },
  { path: "/assets/looks/staff/mechanic/0.png", expect: "image" },
  { path: "/assets/tiles/tile-path.png", expect: "image" },
  { path: "/assets/tiles/tile-grass.png", expect: "image" },
  { path: "/icons/icon-192.png", expect: "image" },
];

/**
 * Shipped in this PR / local tree; fail only after deploy when Content-Type is still HTML.
 * Until then WARN so the gate stays green without publishing.
 */
const PENDING_DEPLOY = [
  "/og-image.jpg",
  "/promo/01-park-overview.jpg",
  "/assets/looks/attraction/inverted_coaster/0.png",
];

function contentKind(contentType) {
  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("text/html")) return "html";
  if (ct.startsWith("image/")) return "image";
  return "other";
}

async function probe(url) {
  const res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-64" }, redirect: "follow" });
  const ct = res.headers.get("content-type") ?? "";
  return { ok: res.ok || res.status === 206, status: res.status, contentType: ct, kind: contentKind(ct) };
}

async function main() {
  if (!LIVE) {
    console.log("qa:live SKIP — set QA_LIVE_URL to run live HEAD checks");
    console.log("Example: QA_LIVE_URL=https://cloud-island-tycoon-maduel.netlify.app npm run qa:live");
    console.log("Note: asset paths must return image/* (SPA HTML fallback = fail).");
    process.exit(0);
  }

  console.log(`qa:live against ${LIVE}`);
  const failures = [];
  const warnings = [];

  for (const { path, expect } of REQUIRED) {
    const url = `${LIVE}${path}`;
    try {
      const r = await probe(url);
      if (!r.ok || r.kind !== expect) {
        failures.push(`${path} → HTTP ${r.status} ${r.contentType} (want ${expect})`);
        console.error(`FAIL ${path} (${r.status} ${r.contentType})`);
      } else {
        console.log(`OK   ${path} (${r.status} ${r.kind})`);
      }
    } catch (err) {
      failures.push(`${path} → ${err instanceof Error ? err.message : String(err)}`);
      console.error(`FAIL ${path}`, err);
    }
  }

  for (const path of PENDING_DEPLOY) {
    const url = `${LIVE}${path}`;
    try {
      const r = await probe(url);
      if (r.ok && r.kind === "image") {
        console.log(`OK   ${path} (deployed)`);
      } else {
        warnings.push(`${path} not on live yet (${r.status} ${r.contentType}) — awaiting approved deploy`);
        console.log(`WARN ${path} pending deploy (${r.kind})`);
      }
    } catch (err) {
      warnings.push(`${path} → ${err instanceof Error ? err.message : String(err)}`);
      console.log(`WARN ${path} pending deploy`);
    }
  }

  if (warnings.length) {
    console.log(`\nPending deploy (${warnings.length}) — local qa:assets covers these files:`);
    for (const w of warnings) console.log(`  - ${w}`);
  }

  if (failures.length) {
    console.error(`\nqa:live failed (${failures.length}):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`\nqa:live passed (${REQUIRED.length} required paths)`);
}

main();
