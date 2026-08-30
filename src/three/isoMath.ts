/** המרות רשת ↔ עולם תלת־ממד (איזומטרי) */

export const ISO_TILE = 1.05;

/** מרכז אריח (gx, gy) בעולם Three.js */
export function gridToWorld(gx: number, gy: number, y = 0): { x: number; y: number; z: number } {
  const a = ISO_TILE * 0.5;
  return {
    x: (gx - gy) * a,
    y,
    z: (gx + gy) * a,
  };
}

/** היפוך: נקודה על מישור הקרקע → תא רשת */
export function worldToGrid(wx: number, wz: number): { x: number; y: number } {
  const a = ISO_TILE * 0.5;
  const gx = (wx / a + wz / a) / 2;
  const gy = (wz / a - wx / a) / 2;
  return { x: Math.round(gx), y: Math.round(gy) };
}

/** מרכז רציף (pixel.x/y של מבקרים) */
export function pixelToWorld(px: number, py: number, y = 0.35): { x: number; y: number; z: number } {
  return gridToWorld(px - 0.5, py - 0.5, y);
}

/** גבולות העולם של כל רשת המפה (כולל אזורים נעולים) */
export function gridWorldBounds(width: number, height: number): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
} {
  const samples = [
    gridToWorld(0, 0),
    gridToWorld(width - 1, 0),
    gridToWorld(0, height - 1),
    gridToWorld(width - 1, height - 1),
    gridToWorld(0, (height - 1) / 2),
    gridToWorld(width - 1, (height - 1) / 2),
    gridToWorld((width - 1) / 2, 0),
    gridToWorld((width - 1) / 2, height - 1),
  ];
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const s of samples) {
    minX = Math.min(minX, s.x);
    maxX = Math.max(maxX, s.x);
    minZ = Math.min(minZ, s.z);
    maxZ = Math.max(maxZ, s.z);
  }
  // שוליים קלים כדי שהעננים בקצה ימלאו את המסך
  const pad = ISO_TILE * 0.6;
  minX -= pad;
  maxX += pad;
  minZ -= pad;
  maxZ += pad;
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
  };
}
