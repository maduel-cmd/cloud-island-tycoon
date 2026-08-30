/** דמויות אורחים/צוות ב־2.5D איזומטרי עם מחזור הליכה ודיבור */

export type IsoFacing = "ne" | "se" | "sw" | "nw";

export type CharacterPose = "idle" | "walk" | "sit" | "talk" | "angry" | "queue";

export interface CharacterStyle {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  accent?: string;
}

export interface DrawCharacterOpts {
  style: CharacterStyle;
  facing: IsoFacing;
  pose: CharacterPose;
  walkPhase: number;
  time: number;
  scale?: number;
  /** תווית מעל הראש (למשל סימן תסכול) */
  badge?: string;
  moodPip?: string;
}

const SKINS = ["#f5d0b0", "#e8b989", "#c68642", "#8d5524", "#ffdbac"];
const HAIRS = ["#1c1917", "#78350f", "#b45309", "#44403c", "#f59e0b", "#dc2626", "#7c3aed"];

export function pickSkin(seed: number): string {
  return SKINS[Math.abs(seed) % SKINS.length]!;
}

export function pickHair(seed: number): string {
  return HAIRS[Math.abs(seed) % HAIRS.length]!;
}

/** כיוון הליכה מרשת האיזומטרי (x/y של הגריד) */
export function facingFromDelta(dx: number, dy: number): IsoFacing {
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "se" : "nw";
  }
  return dy >= 0 ? "sw" : "ne";
}

function facingFlip(facing: IsoFacing): { sx: number; back: boolean } {
  // sx: שיקוף אופקי; back: האם הגב לצופה (רק חלק מהזוויות)
  switch (facing) {
    case "se":
      return { sx: 1, back: false };
    case "sw":
      return { sx: -1, back: false };
    case "ne":
      return { sx: 1, back: true };
    case "nw":
      return { sx: -1, back: true };
  }
}

function shade(hex: string, amount: number): string {
  const n = hex.replace("#", "");
  if (n.length !== 6) return hex;
  const r = Math.max(0, Math.min(255, parseInt(n.slice(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(n.slice(2, 4), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(n.slice(4, 6), 16) + amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * מצייר דמות מפורטת במרכז (0,0) = כפות רגליים על הקרקע.
 * קומפוזיציה: צל → רגליים → גוף → ידיים → ראש → בועת דיבור.
 */
export function drawIsoCharacter(ctx: CanvasRenderingContext2D, opts: DrawCharacterOpts): void {
  const scale = opts.scale ?? 1;
  const { style, pose, walkPhase, time } = opts;
  const { sx, back } = facingFlip(opts.facing);
  const walking = pose === "walk";
  const sitting = pose === "sit";
  const talking = pose === "talk";
  const angry = pose === "angry";

  const bob = walking ? Math.abs(Math.sin(walkPhase)) * 1.2 : talking ? Math.sin(time * 6) * 0.4 : 0;
  const legSwing = walking ? Math.sin(walkPhase) * 5.5 : 0;
  const armSwing = walking ? Math.sin(walkPhase + Math.PI) * 4.5 : talking ? Math.sin(time * 8) * 2.5 : 0;

  ctx.save();
  ctx.scale(scale * sx, scale);

  // Soft ground shadow (volume cue)
  ctx.fillStyle = "rgba(15, 23, 42, 0.28)";
  ctx.beginPath();
  ctx.ellipse(0, 2, sitting ? 9 : 7.5, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();

  const baseY = sitting ? 2 : 0;
  ctx.translate(0, -bob + (sitting ? 4 : 0));

  const drawLimb = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    width: number,
    color: string,
  ) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };

  // Legs (back then front for depth)
  const pantsDark = shade(style.pants, -25);
  const pantsLight = shade(style.pants, 20);
  if (!sitting) {
    drawLimb(-2.5, baseY - 2, -2.5 - legSwing * 0.15, baseY + 9 + Math.max(0, -legSwing) * 0.15, 3.2, pantsDark);
    drawLimb(2.5, baseY - 2, 2.5 + legSwing * 0.15, baseY + 9 + Math.max(0, legSwing) * 0.15, 3.2, pantsLight);
    // shoes
    ctx.fillStyle = "#1f2937";
    ctx.beginPath();
    ctx.ellipse(-2.5 - legSwing * 0.15, baseY + 10, 2.4, 1.3, 0, 0, Math.PI * 2);
    ctx.ellipse(2.5 + legSwing * 0.15, baseY + 10, 2.4, 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    drawLimb(-3, baseY - 2, -8, baseY + 4, 3, pantsDark);
    drawLimb(3, baseY - 2, 8, baseY + 4, 3, pantsLight);
  }

  // Torso with gradient volume
  const torsoY = sitting ? baseY - 10 : baseY - 12;
  const shirtG = ctx.createLinearGradient(-6, torsoY, 6, torsoY + 12);
  shirtG.addColorStop(0, shade(style.shirt, 35));
  shirtG.addColorStop(0.45, style.shirt);
  shirtG.addColorStop(1, shade(style.shirt, -40));
  ctx.fillStyle = shirtG;
  roundRect(ctx, -5.5, torsoY, 11, sitting ? 10 : 12, 3);
  ctx.fill();
  // belt
  ctx.fillStyle = shade(style.accent ?? "#334155", -10);
  ctx.fillRect(-5.5, torsoY + (sitting ? 8 : 10), 11, 1.6);

  // Arms
  const armY = torsoY + 2;
  const skinDark = shade(style.skin, -18);
  if (back) {
    // arms more to the side when facing away
    drawLimb(-5, armY, -8 - armSwing * 0.2, armY + 7, 2.6, skinDark);
    drawLimb(5, armY, 8 + armSwing * 0.2, armY + 7, 2.6, style.skin);
  } else if (talking) {
    drawLimb(-5, armY, -7, armY + 5, 2.6, skinDark);
    // gesturing arm
    drawLimb(5, armY, 9 + Math.sin(time * 7), armY - 2 + Math.cos(time * 5), 2.6, style.skin);
  } else {
    drawLimb(-5, armY, -6 - armSwing * 0.25, armY + 8, 2.6, skinDark);
    drawLimb(5, armY, 6 + armSwing * 0.25, armY + 8, 2.6, style.skin);
  }

  // Head
  const headY = torsoY - 5;
  const headG = ctx.createRadialGradient(-1.5, headY - 1, 1, 0, headY, 7);
  headG.addColorStop(0, shade(style.skin, 40));
  headG.addColorStop(1, shade(style.skin, -25));
  ctx.fillStyle = headG;
  ctx.beginPath();
  ctx.ellipse(0, headY, 5.2, 5.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  ctx.fillStyle = style.hair;
  ctx.beginPath();
  ctx.ellipse(0, headY - 3.2, 5.4, 3.8, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  if (!back) {
    ctx.beginPath();
    ctx.ellipse(-3.5, headY - 1, 2, 2.5, -0.4, 0, Math.PI * 2);
    ctx.ellipse(3.5, headY - 1, 2, 2.5, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  if (!back) {
    // Eyes
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(-1.8, headY - 0.2, 0.7, 0, Math.PI * 2);
    ctx.arc(1.8, headY - 0.2, 0.7, 0, Math.PI * 2);
    ctx.fill();
    // Mouth
    ctx.strokeStyle = angry ? "#b91c1c" : shade(style.skin, -50);
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (angry) {
      ctx.moveTo(-1.8, headY + 2.2);
      ctx.lineTo(1.8, headY + 2.2);
    } else if (talking) {
      ctx.ellipse(0, headY + 2.4, 1.2, 1.4 + Math.sin(time * 12) * 0.5, 0, 0, Math.PI * 2);
    } else {
      ctx.arc(0, headY + 1.6, 1.6, 0.15, Math.PI - 0.15);
    }
    ctx.stroke();
  }

  // Staff accent badge / visitor balloon string optional
  if (style.accent && pose !== "sit") {
    ctx.fillStyle = style.accent;
    ctx.beginPath();
    ctx.arc(4.5 * (sx > 0 ? 1 : -1), torsoY + 3, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // Speech bubble (screen-space, not flipped)
  if (talking) {
    ctx.save();
    ctx.translate(10, -28);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    roundRect(ctx, -8, -8, 22, 14, 5);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-2, 6);
    ctx.lineTo(2, 6);
    ctx.lineTo(-4, 11);
    ctx.closePath();
    ctx.fill();
    const dots = 1 + Math.floor((time * 3) % 3);
    ctx.fillStyle = "#334155";
    for (let i = 0; i < dots; i++) {
      ctx.beginPath();
      ctx.arc(-2 + i * 5, -1, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (opts.moodPip) {
    ctx.fillStyle = opts.moodPip;
    ctx.beginPath();
    ctx.arc(8, -26, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  if (opts.badge) {
    ctx.fillStyle = "#dc2626";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(opts.badge, 0, -32);
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
