import { GAME_STATIC_ASSETS, isAssetReady, type GameAsset } from "../config/assets";

/** מטמון תמונות לנכסים סטטיים מהבנק */
const cache = new Map<string, HTMLImageElement | "loading" | "error">();

export function preloadStaticAsset(asset: GameAsset): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  if (!isAssetReady(asset) || asset.type !== "sprite_image") return null;

  const hit = cache.get(asset.id);
  if (hit instanceof HTMLImageElement) return hit;
  if (hit === "loading" || hit === "error") return null;

  cache.set(asset.id, "loading");
  const img = new Image();
  img.decoding = "async";
  img.onload = () => cache.set(asset.id, img);
  img.onerror = () => cache.set(asset.id, "error");
  img.src = asset.src;
  return null;
}

export function getLoadedStaticAsset(asset: GameAsset): HTMLImageElement | null {
  const hit = cache.get(asset.id);
  return hit instanceof HTMLImageElement ? hit : null;
}

/** דוחף טעינה של נכסי קונספט ידועים (בנק) */
export function warmAssetBank(): void {
  for (const asset of Object.values(GAME_STATIC_ASSETS)) {
    preloadStaticAsset(asset);
  }
}

export function balloonVendorTileImage(): HTMLImageElement | null {
  const asset = GAME_STATIC_ASSETS.BALLOON_VENDOR_TILE!;
  const loaded = getLoadedStaticAsset(asset);
  if (loaded) return loaded;
  preloadStaticAsset(asset);
  return null;
}

export function visitorSheetImage(): HTMLImageElement | null {
  const asset = GAME_STATIC_ASSETS.VISITOR_SHEET!;
  const loaded = getLoadedStaticAsset(asset);
  if (loaded) return loaded;
  preloadStaticAsset(asset);
  return null;
}
