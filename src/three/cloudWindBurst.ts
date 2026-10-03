/**
 * Pure wind-burst math for scatterable park mist clouds.
 * Cliff-edge tiles are never part of this set — callers must not pass them.
 */

export type CloudPoint = { id: string; x: number; z: number };

export type WindImpulse = {
  id: string;
  vx: number;
  vz: number;
  vy: number;
};

/** Horizontal distance within which a finger tap can blow a cloud away */
export const WIND_BURST_RADIUS = 3.6;

/**
 * For each cloud near the origin, compute an outward velocity as if a strong
 * wind came from the finger. Clouds outside the radius are left alone.
 */
export function computeWindBurst(
  originX: number,
  originZ: number,
  clouds: readonly CloudPoint[],
  radius: number = WIND_BURST_RADIUS,
): WindImpulse[] {
  const out: WindImpulse[] = [];
  const r2 = radius * radius;
  for (const c of clouds) {
    const dx = c.x - originX;
    const dz = c.z - originZ;
    const d2 = dx * dx + dz * dz;
    if (d2 > r2) continue;
    const dist = Math.sqrt(d2);
    let nx: number;
    let nz: number;
    if (dist < 1e-4) {
      // Finger dead-center on a puff — push in a stable outward angle
      const ang = (hashStr(c.id) % 360) * (Math.PI / 180);
      nx = Math.cos(ang);
      nz = Math.sin(ang);
    } else {
      nx = dx / dist;
      nz = dz / dist;
    }
    const falloff = 1 - dist / radius;
    const speed = 4.5 + falloff * 7.5;
    out.push({
      id: c.id,
      vx: nx * speed,
      vz: nz * speed,
      vy: 2.2 + falloff * 3.5,
    });
  }
  return out;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
