/**
 * Optional image looks for rides / stalls / props / staff.
 * When files appear under public/assets/looks/<kind>/<id>.(png|webp|jpg),
 * the live 3D mesh uses them as a textured face while keeping motion cycles.
 * No placeholder images are invented here — missing files keep procedural meshes.
 */
import * as THREE from "three";
import { isAssetReady, type GameAsset } from "../config/assets";
import { getLoadedStaticAsset, preloadStaticAsset } from "../assets/AssetLoader";

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

/**
 * Register + warm a look; returns loaded image if already available.
 * Only kicks off one network probe per kind/id (plus optional preferredSrc).
 */
export function warmLook(kind: LookKind, id: string, preferredSrc?: string): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;

  // Prefer an explicit known file (e.g. existing balloon tile) when provided.
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

  // One soft probe of the canonical png path; later messages can drop files there.
  if (!probed.has(probeKey) && isAssetReady(primary)) {
    probed.add(probeKey);
    preloadStaticAsset(primary);
  }
  return null;
}

/**
 * Attach a look billboard to a mesh group when an image is loaded.
 * Keeps the procedural body underneath so cycles still animate.
 */
export function applyLookBillboard(
  g: THREE.Group,
  kind: LookKind,
  id: string,
  opts?: { y?: number; width?: number; height?: number; preferredSrc?: string },
): boolean {
  const img = warmLook(kind, id, opts?.preferredSrc);
  if (!img) return false;
  const prev = g.getObjectByName("lookBillboard");
  if (prev) g.remove(prev);

  const tex = new THREE.Texture(img);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  const w = opts?.width ?? 0.9;
  const h = opts?.height ?? 0.9;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  plane.name = "lookBillboard";
  plane.position.set(0, opts?.y ?? 0.85, 0.42);
  g.add(plane);
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
  const span = Math.max(footprint?.w ?? 1, footprint?.h ?? 1);
  applyLookBillboard(g, kind, id, {
    width: 0.55 + span * 0.35,
    height: 0.55 + span * 0.35,
    y: 0.55 + span * 0.25,
    preferredSrc,
  });
}
