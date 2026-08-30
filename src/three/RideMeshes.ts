/**
 * מודלים תלת־ממדיים איזומטריים למתקנים ודוכנים — low-poly לפי AttractionDef.shape / StallDef.icon.
 * טון פנטזיה / יריד קסום (עץ·אבן·מתכת) — לא פלסטיק מובייל.
 */
import * as THREE from "three";
import type { AttractionDef, StallDef } from "../data/types";
import { ISO_TILE } from "./isoMath";

export type MatFn = (
  key: string,
  color: number,
  opts?: Partial<THREE.MeshStandardMaterialParameters>,
) => THREE.MeshStandardMaterial;

function hexToNum(hex: string): number {
  const n = hex.replace("#", "");
  if (n.length !== 6) return 0x888888;
  return parseInt(n, 16);
}

/** מכהה ומחמם צבעי מותג למראה פנטזיה */
function fantasyColor(hex: string, amount = 0.28): number {
  const c = hexToNum(hex);
  let r = (c >> 16) & 255;
  let g = (c >> 8) & 255;
  let b = c & 255;
  r = Math.round(r * (1 - amount) + 90 * amount);
  g = Math.round(g * (1 - amount) + 70 * amount);
  b = Math.round(b * (1 - amount) + 45 * amount);
  return (r << 16) | (g << 8) | b;
}

const WOOD = 0x5c4030;
const STONE = 0x6a6358;
const IRON = 0x5a6570;
const GOLD = 0xc9a227;
const BANNER = 0x6b1e1e;
const ROOF = 0x5c1a1a;

/** בסיס מבנה פנטזיה: במה + עמודי פינה + דגלים — מתקן נראה כמו מבנה ממלכה */
function dressFantasyPlinth(
  g: THREE.Group,
  mat: MatFn,
  key: string,
  fw: number,
  fh: number,
): void {
  const w = fw * ISO_TILE * 0.95;
  const d = fh * ISO_TILE * 0.95;
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.35, d),
    mat(`${key}_plinth`, STONE, { roughness: 0.92 }),
  );
  plinth.position.y = 0.18;
  g.add(plinth);
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(w * 1.02, 0.06, d * 1.02),
    mat(`${key}_trim`, GOLD, { metalness: 0.55, roughness: 0.4 }),
  );
  trim.position.y = 0.38;
  g.add(trim);
  const corners: [number, number][] = [
    [-w * 0.42, -d * 0.42],
    [w * 0.42, -d * 0.42],
    [-w * 0.42, d * 0.42],
    [w * 0.42, d * 0.42],
  ];
  corners.forEach(([x, z], i) => {
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.85, 0.18),
      mat(`${key}_cp${i}`, STONE),
    );
    pillar.position.set(x, 0.75, z);
    g.add(pillar);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.22, 4), mat(`${key}_cap${i}`, GOLD, { metalness: 0.5 }));
    cap.position.set(x, 1.25, z);
    cap.rotation.y = Math.PI / 4;
    g.add(cap);
  });
  // דגלים
  for (const side of [-1, 1] as const) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.035, 1.6, 5),
      mat(`${key}_pole${side}`, WOOD),
    );
    pole.position.set(side * w * 0.48, 1.1, -d * 0.4);
    g.add(pole);
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.35, 0.45),
      mat(`${key}_flag${side}`, BANNER),
    );
    flag.position.set(side * w * 0.48 + side * 0.18, 1.55, -d * 0.4);
    g.add(flag);
  }
}

function addShadow(m: THREE.Object3D): void {
  m.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
}

/** רכבת הרים — מסילת ברזל על מבצר אבן */
function buildCoaster(mat: MatFn, key: string, color: number, accent: number, fw: number, fh: number): THREE.Group {
  const g = new THREE.Group();
  dressFantasyPlinth(g, mat, key, fw, fh);
  const railMat = mat(`${key}_rail`, color, { metalness: 0.55, roughness: 0.38 });
  for (const [x, z] of [
    [-0.7, -0.35],
    [0.15, -0.5],
    [0.75, 0.1],
    [-0.35, 0.55],
  ] as const) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.35, 6), mat(`${key}_pil`, STONE));
    p.position.set(x * fw * 0.35, 1.05, z * fh * 0.35);
    g.add(p);
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.06, 6, 20, Math.PI * 1.15), railMat);
  arch.rotation.x = Math.PI / 2;
  arch.rotation.z = -0.35;
  arch.position.set(0.1, 1.45, -0.15);
  g.add(arch);
  const dip = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.055, 6, 16, Math.PI * 0.9), railMat);
  dip.rotation.set(Math.PI / 2.2, 0.4, 0.6);
  dip.position.set(0.35, 1.1, 0.35);
  g.add(dip);
  const car = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.28), mat(`${key}_car`, accent));
  car.position.set(-0.55, 1.75, -0.2);
  g.add(car);
  const spin = new THREE.Group();
  spin.name = "spin";
  g.add(spin);
  g.userData.spin = spin;
  g.userData.spinSpeed = 0.9;
  return g;
}

/** גלגל ענק — גלגל מצודה על עמודי אבן */
function buildWheel(mat: MatFn, key: string, color: number, accent: number, fw: number, fh: number): THREE.Group {
  const g = new THREE.Group();
  dressFantasyPlinth(g, mat, key, fw, fh);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.6, 0.16), mat(`${key}_leg`, STONE));
  const legR = legL.clone();
  legL.position.set(-0.5, 1.15, 0);
  legR.position.set(0.5, 1.15, 0);
  legL.rotation.z = 0.22;
  legR.rotation.z = -0.22;
  g.add(legL, legR);
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.4, 10),
    mat(`${key}_hub`, GOLD, { metalness: 0.6, roughness: 0.35 }),
  );
  hub.rotation.z = Math.PI / 2;
  hub.position.y = 1.85;
  g.add(hub);

  const wheel = new THREE.Group();
  wheel.name = "spin";
  wheel.position.y = 1.85;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.05, 6, 28), mat(`${key}_rim`, color, { metalness: 0.4 }));
  rim.rotation.y = Math.PI / 2;
  wheel.add(rim);
  for (let i = 0; i < 8; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.85, 0.04), mat(`${key}_spk`, IRON, { metalness: 0.45 }));
    spoke.rotation.z = (i / 8) * Math.PI;
    wheel.add(spoke);
  }
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.18), mat(`${key}_cab${i % 3}`, accent));
    cabin.position.set(0, Math.cos(ang) * 0.95, Math.sin(ang) * 0.95);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.12, 4), mat(`${key}_cr${i}`, ROOF));
    roof.position.set(0, Math.cos(ang) * 0.95 + 0.14, Math.sin(ang) * 0.95);
    wheel.add(cabin, roof);
  }
  g.add(wheel);
  g.userData.spin = wheel;
  g.userData.spinSpeed = 0.45;
  g.userData.spinAxis = "x";
  return g;
}

/** קרוסלה — ביתן עמודים עם גג מחודד */
function buildCarousel(mat: MatFn, key: string, color: number, accent: number, fw: number, fh: number): THREE.Group {
  const g = new THREE.Group();
  dressFantasyPlinth(g, mat, key, fw, fh);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 0.28, 12), mat(`${key}_base`, WOOD));
  base.position.y = 0.55;
  g.add(base);
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.15, 6), mat(`${key}_col${i}`, STONE));
    col.position.set(Math.cos(ang) * 0.7, 1.15, Math.sin(ang) * 0.7);
    g.add(col);
  }
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.65, 8), mat(`${key}_can`, ROOF));
  canopy.position.y = 2.05;
  g.add(canopy);
  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 4), mat(`${key}_fin`, GOLD, { metalness: 0.55 }));
  finial.position.y = 2.5;
  g.add(finial);

  const spin = new THREE.Group();
  spin.name = "spin";
  spin.position.y = 0.75;
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const horse = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.12), mat(`${key}_h${i}`, i % 2 ? accent : color));
    horse.position.set(Math.cos(ang) * 0.5, 0.25, Math.sin(ang) * 0.5);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 5), mat(`${key}_st`, GOLD, { metalness: 0.4 }));
    stick.position.set(Math.cos(ang) * 0.5, 0.55, Math.sin(ang) * 0.5);
    spin.add(horse, stick);
  }
  g.add(spin);
  g.userData.spin = spin;
  g.userData.spinSpeed = 1.1;
  return g;
}

/** מגדל נפילה — מגדל שמירה / מצודה */
function buildTower(mat: MatFn, key: string, color: number, accent: number, fw: number, fh: number): THREE.Group {
  const g = new THREE.Group();
  dressFantasyPlinth(g, mat, key, fw, fh);
  const keep = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.7), mat(`${key}_keep`, STONE));
  keep.position.y = 1.3;
  g.add(keep);
  // שינות חומה
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.22), mat(`${key}_mer${i}`, STONE));
    merlon.position.set(Math.cos(ang) * 0.38, 2.3, Math.sin(ang) * 0.38);
    g.add(merlon);
  }
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.55, 4), mat(`${key}_tip`, ROOF));
  tip.position.y = 2.65;
  tip.rotation.y = Math.PI / 4;
  g.add(tip);
  const car = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.55), mat(`${key}_car`, accent));
  car.position.y = 1.35;
  car.name = "bob";
  g.add(car);
  g.userData.bob = car;
  g.userData.bobAmp = 0.55;
  g.userData.bobSpeed = 1.6;
  g.userData.bobBaseY = 1.35;
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.08), mat(`${key}_arm`, IRON, { metalness: 0.4 }));
    arm.position.set(Math.cos(ang) * 0.35, 0, Math.sin(ang) * 0.35);
    arm.rotation.y = ang;
    car.add(arm);
  }
  // accent band unused intentionally kept for color identity on car
  void color;
  return g;
}

/** ספינת פיראטים — נדנדה על מבצר */
function buildShip(mat: MatFn, key: string, color: number, accent: number, fw: number, fh: number): THREE.Group {
  const g = new THREE.Group();
  dressFantasyPlinth(g, mat, key, fw, fh);
  const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.7, 0.14), mat(`${key}_fl`, STONE));
  const frameR = frameL.clone();
  frameL.position.set(-0.75, 1.2, 0);
  frameR.position.set(0.75, 1.2, 0);
  g.add(frameL, frameR);
  const axle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 1.6, 8),
    mat(`${key}_ax`, GOLD, { metalness: 0.5, roughness: 0.4 }),
  );
  axle.rotation.z = Math.PI / 2;
  axle.position.y = 1.85;
  g.add(axle);

  const swing = new THREE.Group();
  swing.name = "spin";
  swing.position.y = 1.85;
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.4, 0.48), mat(`${key}_hull`, WOOD));
  hull.position.y = -0.9;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.08, 0.5), mat(`${key}_str`, color));
  stripe.position.y = -0.75;
  const bow = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.45, 6), mat(`${key}_bow`, accent));
  bow.rotation.z = Math.PI / 2;
  bow.position.set(0.7, -0.9, 0);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.75, 6), mat(`${key}_mast`, WOOD));
  mast.position.set(0, -0.4, 0);
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.35), mat(`${key}_sail`, BANNER));
  sail.position.set(0.12, -0.35, 0);
  swing.add(hull, stripe, bow, mast, sail);
  g.add(swing);
  g.userData.spin = swing;
  g.userData.spinSpeed = 1.2;
  g.userData.spinAxis = "z";
  g.userData.spinOscillate = true;
  return g;
}

/** ספלי תה — ביתן מעגל עם גג */
function buildCups(mat: MatFn, key: string, color: number, accent: number, fw: number, fh: number): THREE.Group {
  const g = new THREE.Group();
  dressFantasyPlinth(g, mat, key, fw, fh);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, 0.15, 12), mat(`${key}_disc`, WOOD));
  disc.position.y = 0.5;
  g.add(disc);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.5, 8), mat(`${key}_roof`, ROOF));
  roof.position.y = 1.55;
  g.add(roof);
  const spin = new THREE.Group();
  spin.name = "spin";
  spin.position.y = 0.55;
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2;
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.28, 10), mat(`${key}_cup${i}`, i % 2 ? accent : color));
    cup.position.set(Math.cos(ang) * 0.5, 0.2, Math.sin(ang) * 0.5);
    spin.add(cup);
  }
  g.add(spin);
  g.userData.spin = spin;
  g.userData.spinSpeed = 1.4;
  return g;
}

/** מתקן מים — מזרקת אבן + מגלשה */
function buildWater(mat: MatFn, key: string, color: number, accent: number, fw: number, fh: number): THREE.Group {
  const g = new THREE.Group();
  dressFantasyPlinth(g, mat, key, fw, fh);
  const pool = new THREE.Mesh(
    new THREE.CylinderGeometry(0.75, 0.8, 0.28, 12),
    mat(`${key}_pool`, 0x3a6a88, { transparent: true, opacity: 0.8 }),
  );
  pool.position.y = 0.5;
  g.add(pool);
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.9, 8), mat(`${key}_fnt`, STONE));
  fountain.position.y = 1.0;
  g.add(fountain);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.4), mat(`${key}_tw`, STONE));
  tower.position.set(-0.5, 1.0, -0.25);
  g.add(tower);
  const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.35, 4), mat(`${key}_tr`, ROOF));
  towerRoof.position.set(-0.5, 1.75, -0.25);
  towerRoof.rotation.y = Math.PI / 4;
  g.add(towerRoof);
  const slide = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.1, 6, 14, Math.PI * 0.85), mat(`${key}_sl`, accent, { metalness: 0.3 }));
  slide.rotation.set(0.9, 0.4, -0.5);
  slide.position.set(0.15, 1.1, 0.1);
  g.add(slide);
  void color;
  return g;
}

/** משחק ירי — דוכן עץ עם גג רעפים */
function buildGame(mat: MatFn, key: string, color: number, accent: number, fw: number, fh: number): THREE.Group {
  const g = new THREE.Group();
  dressFantasyPlinth(g, mat, key, fw, fh);
  const booth = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.85, 0.6), mat(`${key}_booth`, WOOD));
  booth.position.set(0, 0.85, -0.1);
  g.add(booth);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.1, 0.12), mat(`${key}_beam`, STONE));
  beam.position.set(0, 1.35, 0.05);
  g.add(beam);
  const awning = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.75), mat(`${key}_awn`, ROOF));
  awning.position.set(0, 1.45, 0.05);
  awning.rotation.x = -0.2;
  g.add(awning);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.12, 0.28), mat(`${key}_ctr`, accent));
  counter.position.set(0, 0.75, 0.32);
  g.add(counter);
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), mat(`${key}_pr${i}`, [BANNER, GOLD, color][i]!));
    b.position.set(-0.3 + i * 0.3, 1.65, -0.15);
    g.add(b);
  }
  return g;
}

/** מתקן גנרי — ביתן פנטזיה */
function buildGeneric(mat: MatFn, key: string, color: number, accent: number, fw: number, fh: number): THREE.Group {
  const g = new THREE.Group();
  dressFantasyPlinth(g, mat, key, fw, fh);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), mat(`${key}_body`, STONE));
  body.position.y = 0.85;
  g.add(body);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.95), mat(`${key}_band`, color));
  trim.position.y = 1.1;
  g.add(trim);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.55, 4), mat(`${key}_roof`, ROOF));
  roof.position.y = 1.55;
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.25, 4), mat(`${key}_fin`, GOLD, { metalness: 0.5 }));
  finial.position.y = 1.95;
  g.add(finial);
  const spin = new THREE.Group();
  spin.name = "spin";
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.1), mat(`${key}_arm`, accent));
    arm.position.set(Math.cos(ang) * 0.4, 0.85, Math.sin(ang) * 0.4);
    arm.rotation.y = ang;
    spin.add(arm);
  }
  g.add(spin);
  g.userData.spin = spin;
  g.userData.spinSpeed = 0.8;
  return g;
}

export function buildAttractionMesh(
  def: AttractionDef,
  mat: MatFn,
  broken: boolean,
): THREE.Group {
  const color = broken ? 0x7f1d1d : fantasyColor(def.color);
  const accent = broken ? 0xb91c1c : fantasyColor(def.accent, 0.15);
  const fw = def.footprint.w;
  const fh = def.footprint.h;
  const key = `ride_${def.id}`;
  let g: THREE.Group;
  switch (def.shape) {
    case "coaster":
      g = buildCoaster(mat, key, color, accent, fw, fh);
      break;
    case "wheel":
      g = buildWheel(mat, key, color, accent, fw, fh);
      break;
    case "carousel":
      g = buildCarousel(mat, key, color, accent, fw, fh);
      break;
    case "tower":
      g = buildTower(mat, key, color, accent, fw, fh);
      break;
    case "ship":
      g = buildShip(mat, key, color, accent, fw, fh);
      break;
    case "cups":
      g = buildCups(mat, key, color, accent, fw, fh);
      break;
    case "water":
      g = buildWater(mat, key, color, accent, fw, fh);
      break;
    case "game":
      g = buildGame(mat, key, color, accent, fw, fh);
      break;
    default:
      g = buildGeneric(mat, key, color, accent, fw, fh);
  }
  g.userData.defId = def.id;
  g.userData.shape = def.shape;
  g.userData.broken = broken;
  addShadow(g);
  return g;
}

/** עדכון אנימציה למתקן (סיבוב / נדנוד / נפילה) */
export function animateAttraction(obj: THREE.Object3D, dt: number, broken: boolean, time: number): void {
  if (broken) return;
  const spin = obj.userData.spin as THREE.Object3D | undefined;
  const speed = (obj.userData.spinSpeed as number) ?? 1;
  if (spin) {
    if (obj.userData.spinOscillate) {
      const axis = (obj.userData.spinAxis as string) ?? "z";
      const ang = Math.sin(time * speed) * 0.55;
      if (axis === "z") spin.rotation.z = ang;
      else if (axis === "x") spin.rotation.x = ang;
      else spin.rotation.y = ang;
    } else {
      const axis = (obj.userData.spinAxis as string) ?? "y";
      if (axis === "x") spin.rotation.x += dt * speed;
      else if (axis === "z") spin.rotation.z += dt * speed;
      else spin.rotation.y += dt * speed;
    }
  }
  const bob = obj.userData.bob as THREE.Object3D | undefined;
  if (bob) {
    const base = (obj.userData.bobBaseY as number) ?? 1.1;
    const amp = (obj.userData.bobAmp as number) ?? 0.4;
    const spd = (obj.userData.bobSpeed as number) ?? 1.5;
    bob.position.y = base + Math.abs(Math.sin(time * spd)) * amp;
  }
}

/** צביעה מחדש כשמתקן נשבר/מתוקן — בונים מחדש בחוץ; כאן סימון בלבד */
export function setAttractionBrokenFlag(obj: THREE.Object3D, broken: boolean): void {
  obj.userData.broken = broken;
}

// ——— דוכנים ———

export function buildStallMesh(def: StallDef, mat: MatFn): THREE.Group {
  const g = new THREE.Group();
  const col = fantasyColor(def.color, 0.2);
  const key = `stall_${def.id}`;

  if (def.icon === "balloon") {
    // עגלת בלונים
    const cart = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.45), mat(`${key}_cart`, WOOD));
    cart.position.y = 0.35;
    g.add(cart);
    for (let i = 0; i < 5; i++) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.32, 0.46),
        mat(`${key}_str${i}`, [0x8b2e2e, 0xa67c1a, 0x2a5cad][i % 3]!),
      );
      stripe.position.set(-0.24 + i * 0.12, 0.35, 0);
      g.add(stripe);
    }
    for (const [dx, dy, c] of [
      [-0.15, 1.15, 0xef4444],
      [0.05, 1.35, 0x3b82f6],
      [0.2, 1.1, 0xfacc15],
      [-0.05, 1.5, 0xec4899],
      [0.25, 1.4, 0xa855f7],
    ] as const) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), mat(`${key}_b${c}`, c));
      b.position.set(dx, dy, 0.15);
      g.add(b);
    }
    const wheel1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 10), mat(`${key}_w`, 0x292524));
    wheel1.rotation.z = Math.PI / 2;
    wheel1.position.set(-0.25, 0.12, 0.28);
    const wheel2 = wheel1.clone();
    wheel2.position.x = 0.25;
    g.add(wheel1, wheel2);
  } else {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.7), mat(`${key}_base`, col));
    base.position.y = 0.4;
    g.add(base);
    // גג משולש (שני מישורים)
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.5, 4), mat(`${key}_roof`, ROOF));
    roof.position.y = 1.05;
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.08), mat(`${key}_beam`, WOOD));
    beam.position.set(0, 0.72, 0.3);
    g.add(beam);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.1, 0.22), mat(`${key}_ctr`, WOOD));
    counter.position.set(0, 0.55, 0.4);
    g.add(counter);
    // אביזר לפי סוג
    const prop = makeStallProp(def.icon, mat, key);
    if (prop) {
      prop.position.set(0.25, 0.95, 0.15);
      g.add(prop);
    }
  }
  addShadow(g);
  return g;
}

function makeStallProp(icon: StallDef["icon"], mat: MatFn, key: string): THREE.Object3D | null {
  switch (icon) {
    case "burger":
      return new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.12, 10), mat(`${key}_prop`, 0xb45309));
    case "pizza":
      return new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.08, 3), mat(`${key}_prop`, 0xfbbf24));
    case "ice":
    case "candy": {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), mat(`${key}_prop`, 0xf9a8d4)));
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 5), mat(`${key}_stk`, 0xfef3c7));
      stick.position.y = -0.15;
      g.add(stick);
      return g;
    }
    case "coffee":
    case "drink":
      return new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.22, 8), mat(`${key}_prop`, 0x78350f));
    case "popcorn":
      return new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.16), mat(`${key}_prop`, 0xef4444));
    case "shop":
      return new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.2), mat(`${key}_prop`, 0xa855f7));
    default:
      return new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), mat(`${key}_prop`, 0xfbbf24));
  }
}
