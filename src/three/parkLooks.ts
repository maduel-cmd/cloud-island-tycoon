/**
 * Optional image looks for rides / stalls / props / staff.
 * Stills under public/assets/looks/<kind>/<id>.png become the live look;
 * motion cycles keep running (retargeted onto the look billboard).
 * Tier accents stay visible so every upgrade stage still changes the body.
 */
import * as THREE from "three";
import { isAssetReady, type GameAsset } from "../config/assets";
import { getLoadedStaticAsset, preloadStaticAsset } from "../assets/AssetLoader";
import { LOOK_CATALOG, shouldSkipLook } from "./lookRegistry";

export type LookKind = "attraction" | "stall" | "prop" | "staff";

const EXT = ["png", "webp", "jpg", "jpeg"] as const;

/** Track which look ids we already probed so missing files do not spam 404s. */
const probed = new Set<string>();

const TIER_ACCENT: Record<number, number> = {
  1: 0x94a3b8,
  2: 0x38bdf8,
  3: 0xa78bfa,
  4: 0xfbbf24,
  5: 0xf472b6,
};

function clampTier(tier: number): number {
  return Math.max(1, Math.min(5, Math.floor(tier) || 1));
}

/** Canonical path candidates for a look id (first ready wins when files arrive). */
export function lookSrcCandidates(kind: LookKind, id: string): string[] {
  const safe = id.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
  return EXT.map((ext) => `/assets/looks/${kind}/${safe}.${ext}`);
}

export function lookAsset(kind: LookKind, id: string, preferredSrc?: string): GameAsset {
  const src = preferredSrc?.trim() || lookSrcCandidates(kind, id)[0]!;
  return {
    id: `look_${kind}_${id}`,
    name: `${kind} look ${id}`,
    type: "sprite_image",
    src,
  };
}

/** Preload every catalogued look (skips bad stills that were never copied). */
export function warmAllLooks(): void {
  if (typeof Image === "undefined") return;
  for (const { kind, id } of LOOK_CATALOG) {
    if (shouldSkipLook(id)) continue;
    warmLook(kind, id);
  }
}

/**
 * Register + warm a look; returns loaded image if already available.
 * Only kicks off one network probe per kind/id (plus optional preferredSrc).
 */
export function warmLook(kind: LookKind, id: string, preferredSrc?: string): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  if (shouldSkipLook(id)) return null;

  if (preferredSrc?.trim()) {
    const preferred = lookAsset(kind, `${id}__pref`, preferredSrc.trim());
    if (isAssetReady(preferred)) {
      const loaded = getLoadedStaticAsset(preferred);
      if (loaded) return loaded;
      preloadStaticAsset(preferred);
    }
  }

  const probeKey = `${kind}:${id}`;
  const primary = lookAsset(kind, id);
  const loadedPrimary = getLoadedStaticAsset(primary);
  if (loadedPrimary) return loadedPrimary;

  if (!probed.has(probeKey) && isAssetReady(primary)) {
    probed.add(probeKey);
    preloadStaticAsset(primary);
  }
  return null;
}

function clearLookTierAccents(g: THREE.Group): void {
  const doomed: THREE.Object3D[] = [];
  for (const c of g.children) {
    if (c.name.startsWith("lookTier")) doomed.push(c);
  }
  for (const c of doomed) g.remove(c);
}

/**
 * Visible body accents per tier so upgrades stay readable when the still hides the procedural mesh.
 * Each stage adds geometry — not only a scale ladder.
 */
function addLookTierAccents(g: THREE.Group, tier: number, w: number, billboardY: number): void {
  clearLookTierAccents(g);
  const col = TIER_ACCENT[tier] ?? TIER_ACCENT[1]!;
  const mat = (color: number, emissive = 0, intensity = 0) =>
    new THREE.MeshStandardMaterial({
      color,
      metalness: 0.25,
      roughness: 0.55,
      emissive,
      emissiveIntensity: intensity,
    });

  const baseR = w * (0.22 + tier * 0.035);
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(baseR, baseR + 0.04, 0.1 + tier * 0.018, 10),
    mat(0x64748b),
  );
  base.name = "lookTierBase";
  base.position.y = 0.06;
  g.add(base);

  if (tier >= 2) {
    const rail = new THREE.Mesh(new THREE.TorusGeometry(baseR + 0.06, 0.025, 6, 16), mat(col));
    rail.name = "lookTierRail";
    rail.rotation.x = Math.PI / 2;
    rail.position.y = 0.14;
    g.add(rail);
  }
  if (tier >= 3) {
    for (const x of [-baseR * 0.85, baseR * 0.85]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.55, 6), mat(col));
      post.name = `lookTierPost${x > 0 ? "R" : "L"}`;
      post.position.set(x, 0.4, 0.12);
      g.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(baseR * 1.7, 0.05, 0.05), mat(col));
    beam.name = "lookTierBeam";
    beam.position.set(0, 0.68, 0.12);
    g.add(beam);
  }
  if (tier >= 4) {
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(w * 0.42, 0.03, 6, 18),
      mat(col, col, 0.55),
    );
    rim.name = "lookTierRim";
    rim.position.y = billboardY;
    rim.rotation.x = -0.35;
    g.add(rim);
  }
  if (tier >= 5) {
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 5), mat(col, col, 0.75));
    crown.name = "lookTierCrown";
    crown.position.y = billboardY + w * 0.42;
    g.add(crown);
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), mat(0xfff7ed, 0xfff7ed, 0.9));
    spark.name = "lookTierSpark";
    spark.position.y = billboardY + w * 0.55;
    g.add(spark);
  }
}

/**
 * Attach a look billboard as the primary visual.
 * Hides procedural mesh children so the still is the look; cycles animate the billboard.
 * Tier accents remain visible so every upgrade stage still changes the body.
 */
export function applyLookBillboard(
  g: THREE.Group,
  kind: LookKind,
  id: string,
  opts?: { y?: number; width?: number; height?: number; preferredSrc?: string; tier?: number },
): boolean {
  if (shouldSkipLook(id)) return false;
  const img = warmLook(kind, id, opts?.preferredSrc);
  if (!img) return false;

  const tier = clampTier(opts?.tier ?? (g.userData.tier as number) ?? (g.userData.propTier as number) ?? 1);
  const tierScale = 0.82 + tier * 0.08;

  const prev = g.getObjectByName("lookBillboard");
  if (prev) g.remove(prev);
  clearLookTierAccents(g);

  const tex = new THREE.Texture(img);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  const w = (opts?.width ?? 1.35) * tierScale;
  const h = (opts?.height ?? 1.35) * tierScale;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  plane.name = "lookBillboard";
  const billboardY = opts?.y != null ? opts.y * tierScale : h * 0.48;
  plane.position.set(0, billboardY, 0);
  // Soft isometric tilt so stills sit in the park plane
  plane.rotation.x = -0.35;
  g.add(plane);

  addLookTierAccents(g, tier, w, billboardY);

  // Hide procedural body — look is the silhouette; motion runs on the billboard.
  // Keep lookTier* accents visible so upgrades still show a body change.
  g.traverse((c) => {
    if (c === g || c === plane) return;
    if (c.name.startsWith("lookTier")) {
      c.visible = true;
      return;
    }
    if ((c as THREE.Mesh).isMesh) c.visible = false;
  });
  plane.visible = true;

  g.userData.lookKind = kind;
  g.userData.lookId = id;
  g.userData.lookTier = tier;
  g.userData.hasLookImage = true;
  g.userData.lookBaseY = billboardY;
  return true;
}

/** Soft-fail apply: call after building procedural mesh. */
export function tryApplyEntityLook(
  g: THREE.Group,
  kind: LookKind,
  id: string,
  footprint?: { w: number; h: number },
  preferredSrc?: string,
  tier?: number,
): void {
  if (shouldSkipLook(id)) return;
  const span = Math.max(footprint?.w ?? 1, footprint?.h ?? 1);
  const size = 0.95 + span * 0.55;
  const t = clampTier(tier ?? (g.userData.tier as number) ?? (g.userData.propTier as number) ?? 1);
  applyLookBillboard(g, kind, id, {
    width: size,
    height: size,
    y: size * 0.48,
    preferredSrc,
    tier: t,
  });
}

/**
 * Drive look-billboard motion from the entity's primary cycle type.
 * Called when hasLookImage so stills stay animated.
 */
export function animateLookBillboard(obj: THREE.Object3D, dt: number, time: number): void {
  if (!obj.userData.hasLookImage) return;
  const look = obj.getObjectByName("lookBillboard");
  if (!look) return;

  const cycles = obj.userData.cycles as Array<{ type: string; speed?: number; amp?: number; period?: number }> | undefined;
  const primary = cycles?.[0]?.type ?? "bob";
  const speed = cycles?.[0]?.speed ?? 1.2;
  const amp = cycles?.[0]?.amp ?? 0.15;

  switch (primary) {
    case "spin":
    case "wheel":
    case "carousel":
    case "swinger":
    case "enterprise":
    case "teacups":
    case "topSpin":
      look.rotation.z += dt * speed * 0.55;
      break;
    case "bob":
    case "climbDrop":
    case "sub":
    case "pop":
    case "drip":
    case "steam":
      look.position.y = (obj.userData.lookBaseY as number | undefined) ?? look.position.y;
      if (obj.userData.lookBaseY == null) obj.userData.lookBaseY = look.position.y;
      look.position.y = (obj.userData.lookBaseY as number) + Math.sin(time * speed) * Math.max(0.06, amp * 0.35);
      break;
    case "ship":
    case "pendulum":
    case "hinge":
      look.rotation.z = Math.sin(time * speed) * Math.max(0.12, amp * 0.4);
      break;
    case "track":
    case "slide":
    case "bumpers":
      look.position.x = Math.sin(time * speed) * 0.12;
      look.position.z = Math.cos(time * speed * 0.7) * 0.08;
      break;
    case "flag":
    case "strings":
      look.rotation.y = Math.sin(time * (speed || 2)) * 0.18;
      break;
    case "flash":
    case "blink": {
      const period = cycles?.[0]?.period ?? 0.8;
      const mat = (look as THREE.Mesh).material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = 0.55 + 0.45 * (Math.sin(time / period) > 0 ? 1 : 0.35);
      break;
    }
    default:
      look.rotation.y = Math.sin(time * 0.7) * 0.08;
      break;
  }
}
