/**
 * גליון מבקרים — 12×4 = 48 דמויות (משתמשים ב־40 ארכיטיפים ראשונים בסימולציה).
 * תא: 85×139 על גליון 1024×558 (שארית 4×2 בפינה).
 */

export const VISITOR_SHEET = {
  cols: 12,
  rows: 4,
  cellW: 85,
  cellH: 139,
  /** מספר פריימים בגליון */
  frameCount: 48,
  /** ארכיטיפים בשימוש בסימולציה */
  archetypeCount: 40,
} as const;

export type VisitorAgeBand = "child" | "adult" | "senior";

/** אביזר מוחזק — אינטראקציה ויזואלית אחרי קנייה / לפי ארכיטיפ */
export type VisitorHeldProp =
  | "none"
  | "balloons"
  | "cotton_candy"
  | "ice_cream"
  | "camera"
  | "map"
  | "bags"
  | "phone";

export type VisitorSheetRect = { sx: number; sy: number; sw: number; sh: number };

/** מקור בגליון לפי אינדקס ארכיטיפ (0-based, row-major) */
export function visitorSheetRect(archetype: number): VisitorSheetRect {
  const { cols, cellW, cellH, frameCount } = VISITOR_SHEET;
  const idx = ((archetype % frameCount) + frameCount) % frameCount;
  const col = idx % cols;
  const row = Math.floor(idx / cols);
  return { sx: col * cellW, sy: row * cellH, sw: cellW, sh: cellH };
}

/** ילדים / מבוגרים / קשישים לפי פסי ארכיטיפ בגליון */
export function visitorAgeBand(archetype: number): VisitorAgeBand {
  const a = ((archetype % VISITOR_SHEET.archetypeCount) + VISITOR_SHEET.archetypeCount) %
    VISITOR_SHEET.archetypeCount;
  if (a < 12) return "child";
  if (a < 28) return "adult";
  return "senior";
}

/** עמודת הגליון מרמזת על אביזר אופייני */
export function visitorPropFromArchetype(archetype: number): VisitorHeldProp {
  const col = ((archetype % VISITOR_SHEET.cols) + VISITOR_SHEET.cols) % VISITOR_SHEET.cols;
  switch (col) {
    case 0:
      return "balloons";
    case 1:
    case 2:
    case 3:
      return "cotton_candy";
    case 4:
      return "ice_cream";
    case 5:
      return "phone";
    case 6:
      return "camera";
    case 7:
      return "map";
    default:
      return "bags";
  }
}

export function heldPropFromStallIcon(icon: string | undefined): VisitorHeldProp {
  if (icon === "balloon") return "balloons";
  if (icon === "coffee" || icon === "drink") return "phone"; // כוס — שימוש ב־interact + בועת 🥤
  if (icon === "ice" || icon === "candy" || icon === "food" || icon === "burger") return "ice_cream";
  if (icon === "gift" || icon === "shop") return "bags";
  return "cotton_candy";
}

/**
 * מצייר פריים מהגליון ממורכז מעל רגלי המבקר (0,0 = נקודת עמידה על האריח).
 * מחזיר false אם אין תמונה — הקורא יכול ליפול חזרה ל־CharacterArt.
 */
export function drawVisitorSheetFrame(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  archetype: number,
  opts: {
    scale?: number;
    /** שיקוף אופקי לפי כיוון הליכה */
    flipX?: boolean;
    alpha?: number;
    /** פאזת אינטראקציה עם אביזר (0–1 מחזור) */
    interactPhase?: number;
    heldProp?: VisitorHeldProp;
  } = {},
): boolean {
  const { sx, sy, sw, sh } = visitorSheetRect(archetype);
  const scale = opts.scale ?? 0.72;
  const flipX = opts.flipX ?? false;
  const alpha = opts.alpha ?? 1;
  const phase = opts.interactPhase ?? 0;
  const prop = opts.heldProp ?? "none";
  const bob =
    prop === "none"
      ? 0
      : prop === "camera"
        ? Math.sin(phase * Math.PI * 2) * 2.2
        : Math.sin(phase * Math.PI * 2) * 1.6;
  const squash = prop === "ice_cream" || prop === "cotton_candy" ? 1 + Math.sin(phase * Math.PI * 2) * 0.04 : 1;
  const dw = sw * scale * squash;
  const dh = sh * scale;

  ctx.save();
  ctx.globalAlpha = alpha;
  if (flipX) ctx.scale(-1, 1);
  ctx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh + 10 * scale + bob, dw, dh);

  // הבזק מצלמה קצר כשמבוגר מצלם
  if (prop === "camera" && phase > 0.72 && phase < 0.82) {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#fffbeb";
    ctx.beginPath();
    ctx.arc(14, -dh * 0.55, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  return true;
}

/** שיקוף לפי facing איזומטרי */
export function visitorFacingFlipX(facing: "ne" | "se" | "sw" | "nw"): boolean {
  return facing === "nw" || facing === "sw";
}
