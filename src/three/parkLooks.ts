/**
 * Optional image looks for rides / stalls / props / staff.
 * Stills under public/assets/looks/<kind>/<id>.png become the live look;
 * motion cycles keep running (retargeted onto the look billboard).
 */
import * as THREE from "three";
import { isAssetReady, type GameAsset } from "../config/assets";
import { getLoadedStaticAsset, preloadStaticAsset } from "../assets/AssetLoader";
import { LOOK_CATALOG, shouldSkipLook } from "./lookRegistry";

export type LookKind = "attraction" | "stall" | "prop" | "staff";

const EXT = ["png", "webp", "jpg", "jpeg"] as const;

/** Track which look ids we already probed so missing files do not spam 404s. */
const probed = new Set<string>();

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

/**
 * Attach a look billboard as the primary visual.
 * Hides procedural mesh children so the still is the look; cycles animate the billboard.
 */
export function applyLookBillboard(
  g: THREE.Group,
  kind: LookKind,
  id: string,
  opts?: { y?: number; width?: number; height?: number; preferredSrc?: string },
): boolean {
  if (shouldSkipLook(id)) return false;
  const img = warmLook(kind, id, opts?.preferredSrc);
  if (!img) return false;

  const prev = g.getObjectByName("lookBillboard");
  if (prev) g.remove(prev);

  const tex = new THREE.Texture(img);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  const w = opts?.width ?? 1.35;
  const h = opts?.height ?? 1.35;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  plane.name = "lookBillboard";
  plane.position.set(0, opts?.y ?? h * 0.48, 0);
  // Soft isometric tilt so stills sit in the park plane
  plane.rotation.x = -0.35;
  g.add(plane);

  // Hide procedural body — look is the silhouette; motion runs on the billboard
  g.traverse((c) => {
    if (c === g || c === plane) return;
    if ((c as THREE.Mesh).isMesh) c.visible = false;
  });
  plane.visible = true;

  g.userData.lookKind = kind;
  g.userData.lookId = id;
  g.userData.hasLookImage = true;
  return true;
}

/** Soft-fail apply: call after building procedural mesh. */
export function tryApplyEntityLook(
  g: THREE.Group,
  kind: LookKind,
  id: string,
  footprint?: { w: number; h: number },
  preferredSrc?: string,
): void {
  if (shouldSkipLook(id)) return;
  const span = Math.max(footprint?.w ?? 1, footprint?.h ?? 1);
  const size = 0.95 + span * 0.55;
  applyLookBillboard(g, kind, id, {
    width: size,
    height: size,
    y: size * 0.48,
    preferredSrc,
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
