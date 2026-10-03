/**
 * Procedural high-altitude cirrus (ענני נוצה) — rippled soft wisps for sky only.
 * Transparent canvas: white streaks over clear alpha so scene blue shows through.
 */

export function createCirrusSkyTexture(
  width = 1024,
  height = 512,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.clearRect(0, 0, width, height);

  // Soft rippled bands (mackerel / cirrocumulus feel) — many tiny tufts
  const rows = 28;
  for (let row = 0; row < rows; row++) {
    const yBase = (row / rows) * height + 8;
    const phase = row * 1.7;
    const tufts = 40 + (row % 5) * 4;
    for (let i = 0; i < tufts; i++) {
      const t = i / tufts;
      const wave =
        Math.sin(t * Math.PI * 6 + phase) * 10 + Math.sin(t * Math.PI * 2.3 + row) * 6;
      const x = t * width + ((row * 17 + i * 13) % 11) - 5;
      const y = yBase + wave + ((i * 7) % 5) - 2;
      const rx = 7 + ((i + row) % 5) * 2.2;
      const ry = 1.6 + ((i * 3) % 4) * 0.45;
      const a = 0.08 + ((i * 11 + row * 3) % 7) * 0.025;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, (i % 9) * 0.04 - 0.15, 0, Math.PI * 2);
      ctx.fill();
      if (i % 3 === 0) {
        ctx.fillStyle = `rgba(248,250,252,${a * 0.55})`;
        ctx.beginPath();
        ctx.ellipse(x + rx * 0.6, y - 1.5, rx * 0.55, ry * 0.7, 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Longer streak fibers across the sheet
  for (let s = 0; s < 18; s++) {
    const y = ((s * 47) % height) + 20;
    const x0 = ((s * 91) % width) - 40;
    ctx.strokeStyle = `rgba(255,255,255,${0.06 + (s % 4) * 0.02})`;
    ctx.lineWidth = 1.2 + (s % 3) * 0.8;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    for (let k = 1; k <= 8; k++) {
      ctx.lineTo(x0 + k * 55, y + Math.sin(k * 0.9 + s) * 4);
    }
    ctx.stroke();
  }

  return canvas;
}
