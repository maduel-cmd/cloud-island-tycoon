/**
 * Bright isometric park look — saturated, readable silhouettes (not dark fantasy cubes).
 */
import * as THREE from "three";

export type MatFn = (
  key: string,
  color: number,
  opts?: Partial<THREE.MeshStandardMaterialParameters>,
) => THREE.MeshStandardMaterial;

export const BRIGHT = {
  stone: 0xb8c0c8,
  stoneDark: 0x8a949e,
  wood: 0xc4a574,
  canopy: 0xff6b6b,
  metal: 0xd0d7e0,
  gold: 0xffd166,
  water: 0x4fc3f7,
  grass: 0x7cb342,
  white: 0xffffff,
  black: 0x2d3436,
} as const;

export function hexToNum(hex: string): number {
  const n = hex.replace("#", "");
  if (n.length !== 6) return 0x888888;
  return parseInt(n, 16);
}

/** Keep brand colors bright for isometric readability */
export function brighten(hex: string, amount = 0.12): number {
  const c = hexToNum(hex);
  let r = (c >> 16) & 255;
  let g = (c >> 8) & 255;
  let b = c & 255;
  r = Math.min(255, Math.round(r + (255 - r) * amount));
  g = Math.min(255, Math.round(g + (255 - g) * amount));
  b = Math.min(255, Math.round(b + (255 - b) * amount));
  return (r << 16) | (g << 8) | b;
}

export function addShadow(m: THREE.Object3D): void {
  m.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
}

export function stoneBase(
  g: THREE.Group,
  mat: MatFn,
  key: string,
  fw: number,
  fh: number,
  tile = 1,
): void {
  const w = fw * tile * 0.92;
  const d = fh * tile * 0.92;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.22, d),
    mat(`${key}_base`, BRIGHT.stone, { roughness: 0.85 }),
  );
  base.position.y = 0.11;
  g.add(base);
  const edge = new THREE.Mesh(
    new THREE.BoxGeometry(w * 1.04, 0.05, d * 1.04),
    mat(`${key}_edge`, BRIGHT.stoneDark, { roughness: 0.9 }),
  );
  edge.position.y = 0.24;
  g.add(edge);
}

export function emissiveAccent(
  mat: MatFn,
  key: string,
  color: number,
  intensity = 0.65,
): THREE.MeshStandardMaterial {
  return mat(key, color, {
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.35,
    metalness: 0.2,
  });
}
