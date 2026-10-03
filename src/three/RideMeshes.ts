/**
 * Bright isometric ride meshes — unique silhouette + cycle per attraction id.
 * Stages change the body (1 silhouette → 2 stone base → 3 identity → 4–5 high body).
 * High stage upgrades geometry (taller tracks, second rows, etc.) — not a shared crown.
 * Broken rides force stage 1 and freeze.
 */
import * as THREE from "three";
import type { AttractionDef, StallDef } from "../data/types";
import { ISO_TILE } from "./isoMath";
import {
  type MatFn,
  BRIGHT,
  brighten,
  addShadow,
  stoneBase,
  emissiveAccent,
} from "./parkStyle";
import { tryApplyEntityLook, animateLookBillboard } from "./parkLooks";

export type { MatFn } from "./parkStyle";

type Cycle =
  | { type: "spin"; obj: THREE.Object3D; axis: "x" | "y" | "z"; speed: number }
  | { type: "bob"; obj: THREE.Object3D; baseY: number; amp: number; speed: number }
  | { type: "track"; obj: THREE.Object3D; points: THREE.Vector3[]; speed: number; t: number }
  | {
      type: "wheel";
      rim: THREE.Object3D;
      cabins: THREE.Object3D[];
      speed: number;
      levelCabins: boolean;
    }
  | {
      type: "enterprise";
      arm: THREE.Object3D;
      rim: THREE.Object3D;
      speed: number;
      liftAmp: number;
      baseY: number;
    }
  | {
      type: "carousel";
      spin: THREE.Object3D;
      horses: THREE.Object3D[];
      speed: number;
      bobAmp: number;
    }
  | {
      type: "swinger";
      spin: THREE.Object3D;
      chairs: THREE.Object3D[];
      speed: number;
      flare: number;
    }
  | {
      type: "climbDrop";
      car: THREE.Object3D;
      low: number;
      high: number;
      climb: number;
      fall: number;
      phase: number;
      pause?: number;
    }
  | { type: "ship"; swing: THREE.Object3D; amp: number; speed: number }
  | {
      type: "teacups";
      disc: THREE.Object3D;
      cups: THREE.Object3D[];
      discSpeed: number;
      cupSpeed: number;
    }
  | { type: "flash"; light: THREE.Mesh; period: number }
  | { type: "pendulum"; arm: THREE.Object3D; amp: number; speed: number }
  | { type: "topSpin"; arm: THREE.Object3D; cars: THREE.Object3D[]; speed: number }
  | { type: "bumpers"; cars: THREE.Object3D[]; radius: number; speed: number }
  | { type: "blink"; obj: THREE.Object3D; period: number }
  | { type: "flag"; obj: THREE.Object3D; amp: number; speed: number }
  | { type: "sub"; obj: THREE.Object3D; baseY: number; amp: number; speed: number }
  | { type: "shake"; obj: THREE.Object3D; amp: number; speed: number }
  | { type: "slide"; obj: THREE.Object3D; axis: "x" | "z"; base: number; amp: number; speed: number }
  | { type: "ringDrop"; ring: THREE.Object3D; low: number; high: number; speed: number }
  | { type: "bell"; bell: THREE.Object3D; marker?: THREE.Object3D; low: number; high: number; speed: number }
  | { type: "ballHoop"; ball: THREE.Object3D; low: number; high: number; speed: number }
  | { type: "steam"; puffs: THREE.Object3D[]; speed: number }
  | { type: "strings"; strings: THREE.Object3D[]; speed: number }
  | { type: "hinge"; obj: THREE.Object3D; axis: "x" | "y" | "z"; amp: number; speed: number; base?: number }
  | { type: "pop"; objs: THREE.Object3D[]; baseY: number; amp: number; speed: number }
  | { type: "drip"; obj: THREE.Object3D; baseY: number; amp: number; speed: number }
  | { type: "door"; obj: THREE.Object3D; amp: number; speed: number };

function pushCycle(g: THREE.Group, c: Cycle): void {
  const list = (g.userData.cycles as Cycle[] | undefined) ?? [];
  list.push(c);
  g.userData.cycles = list;
}

function stageOf(tier: number): number {
  return Math.max(1, Math.min(5, Math.floor(tier) || 1));
}

/** Stages 4–5 share the “high body” family; stage 5 must still add more than 4. */
function high(tier: number): boolean {
  return stageOf(tier) >= 4;
}

function peak(tier: number): boolean {
  return stageOf(tier) >= 5;
}

function trackPoints(kind: "hill" | "hill2" | "loop" | "loop2" | "launch" | "launch2" | "mouse" | "mouse2"): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  if (kind === "hill" || kind === "hill2") {
    const w = kind === "hill2" ? 2.2 : 1.8;
    for (let i = 0; i <= 28; i++) {
      const t = i / 28;
      const x = -w / 2 + t * w;
      const y = 0.85 + Math.sin(t * Math.PI) * (kind === "hill2" ? 1.15 : 0.85);
      const z = Math.sin(t * Math.PI * 2) * 0.12;
      pts.push(new THREE.Vector3(x, y, z));
    }
  } else if (kind === "loop" || kind === "loop2") {
    const r = kind === "loop2" ? 0.75 : 0.65;
    for (let i = 0; i <= 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.sin(a) * r, 1.1 + Math.cos(a) * r, 0));
    }
    if (kind === "loop2") {
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.sin(a) * 0.55 + 0.85, 1.0 + Math.cos(a) * 0.55, 0.15));
      }
    }
  } else if (kind === "launch" || kind === "launch2") {
    for (let i = 0; i <= 16; i++) pts.push(new THREE.Vector3(-0.95 + (i / 16) * 1.9, 0.85, 0));
    if (kind === "launch2") {
      for (let i = 0; i <= 16; i++) pts.push(new THREE.Vector3(0.95 - (i / 16) * 1.9, 0.95, 0.28));
    }
  } else {
    // wild mouse zig-zag
    const turns = kind === "mouse2" ? 8 : 5;
    for (let i = 0; i <= turns * 4; i++) {
      const t = i / (turns * 4);
      const x = -0.7 + t * 1.4;
      const z = Math.sin(t * Math.PI * turns) * (kind === "mouse2" ? 0.45 : 0.32);
      const y = 0.75 + (kind === "mouse2" ? Math.abs(Math.sin(t * Math.PI * turns)) * 0.35 : 0);
      pts.push(new THREE.Vector3(x, y, z));
    }
  }
  return pts;
}

function buildTrackRails(g: THREE.Group, mat: MatFn, key: string, color: number, pts: THREE.Vector3[], double = false): void {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const len = a.distanceTo(b);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.06), mat(`${key}_rail${i}`, color, { metalness: 0.35 }));
    rail.position.copy(mid);
    rail.lookAt(b);
    rail.rotateY(Math.PI / 2);
    g.add(rail);
    if (double) {
      const rail2 = rail.clone();
      rail2.position.z += 0.12;
      g.add(rail2);
    }
  }
}

/** Sky coaster — open bench train (not a plain box). */
function skyTrain(mat: MatFn, key: string, accent: number, lit: boolean, fancy: boolean): THREE.Group {
  const g = new THREE.Group();
  const bench = new THREE.Mesh(
    new THREE.BoxGeometry(fancy ? 0.42 : 0.32, 0.08, 0.2),
    lit ? emissiveAccent(mat, `${key}_car`, accent, 0.55) : mat(`${key}_car`, accent),
  );
  const back = new THREE.Mesh(new THREE.BoxGeometry(fancy ? 0.42 : 0.32, 0.14, 0.04), mat(`${key}_back`, BRIGHT.metal));
  back.position.set(0, 0.1, -0.08);
  g.add(bench, back);
  if (fancy) {
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 5), mat(`${key}_nose`, accent));
    nose.rotation.z = -Math.PI / 2;
    nose.position.set(0.28, 0.04, 0);
    g.add(nose);
  }
  return g;
}

/** Inverted — seats hang under a yoke (car under the rail). */
function hangCar(mat: MatFn, key: string, accent: number, lit: boolean, fancy: boolean): THREE.Group {
  const g = new THREE.Group();
  const yoke = new THREE.Mesh(new THREE.BoxGeometry(fancy ? 0.38 : 0.28, 0.05, 0.08), mat(`${key}_yoke`, BRIGHT.metal));
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, fancy ? 0.28 : 0.2, 5), mat(`${key}_stem`, BRIGHT.metal));
  stem.position.y = fancy ? -0.14 : -0.1;
  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(fancy ? 0.34 : 0.24, 0.08, 0.16),
    lit ? emissiveAccent(mat, `${key}_car`, accent, 0.55) : mat(`${key}_car`, accent),
  );
  seat.position.y = fancy ? -0.28 : -0.22;
  g.add(yoke, stem, seat);
  if (fancy) {
    const harness = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.015, 4, 10), mat(`${key}_har`, 0x64748b));
    harness.position.y = -0.22;
    harness.rotation.x = Math.PI / 2;
    g.add(harness);
  }
  return g;
}

/** Launch — pointed bullet sled with side boosters. */
function launchSled(mat: MatFn, key: string, accent: number, lit: boolean, fancy: boolean): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.09, fancy ? 0.32 : 0.22, 4, 8),
    lit ? emissiveAccent(mat, `${key}_car`, accent, 0.55) : mat(`${key}_car`, accent),
  );
  body.rotation.z = Math.PI / 2;
  g.add(body);
  for (const z of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.08), mat(`${key}_fin${z}`, BRIGHT.metal));
    fin.position.set(-0.12, 0, z * 0.1);
    g.add(fin);
  }
  if (fancy) {
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 6), mat(`${key}_tip`, accent));
    tip.rotation.z = -Math.PI / 2;
    tip.position.set(0.28, 0, 0);
    g.add(tip);
  }
  return g;
}

/** Wild mouse — tiny round tub car (not a box). */
function mouseTub(mat: MatFn, key: string, accent: number, lit: boolean, fancy: boolean): THREE.Group {
  const g = new THREE.Group();
  const tub = new THREE.Mesh(
    new THREE.CylinderGeometry(fancy ? 0.12 : 0.1, fancy ? 0.14 : 0.11, 0.12, 8),
    lit ? emissiveAccent(mat, `${key}_car`, accent, 0.5) : mat(`${key}_car`, accent),
  );
  const earL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), mat(`${key}_earL`, accent));
  const earR = earL.clone();
  earL.position.set(-0.08, 0.1, 0.04);
  earR.position.set(0.08, 0.1, 0.04);
  g.add(tub, earL, earR);
  if (fancy) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 4, 8), mat(`${key}_wh`, BRIGHT.metal));
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(0, -0.04, 0.1);
    g.add(wheel);
  }
  return g;
}

// ——— Coasters ———

function buildCoasterRide(
  id: string,
  mat: MatFn,
  key: string,
  color: number,
  accent: number,
  fw: number,
  fh: number,
  tier: number,
): THREE.Group {
  const g = new THREE.Group();
  const isHigh = high(tier);
  const isPeak = peak(tier);
  if (tier >= 2) stoneBase(g, mat, key, fw, fh, ISO_TILE);

  if (id === "sky_coaster") {
    const pts = trackPoints(isHigh ? "hill2" : "hill");
    const pillars = isPeak ? [-1.0, -0.5, 0, 0.5, 1.0] : isHigh ? [-0.9, -0.3, 0.3, 0.9] : [-0.7, 0.7];
    for (const x of pillars) {
      const p = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.1, isPeak ? 1.35 : isHigh ? 1.2 : 0.95, 6),
        mat(`${key}_pil`, BRIGHT.metal),
      );
      p.position.set(x, isPeak ? 0.8 : isHigh ? 0.7 : 0.55, 0);
      g.add(p);
    }
    buildTrackRails(g, mat, key, color, pts, isHigh);
    if (tier >= 3) {
      const crest = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 5), mat(`${key}_crest`, accent));
      crest.position.set(0, isHigh ? 2.2 : 1.85, 0);
      g.add(crest);
    }
    if (isPeak) {
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.18), mat(`${key}_ban`, accent));
      banner.position.set(0, 2.45, 0.1);
      g.add(banner);
    }
    const car = skyTrain(mat, key, accent, tier >= 4, isPeak);
    car.position.copy(pts[0]!);
    g.add(car);
    pushCycle(g, { type: "track", obj: car, points: pts, speed: 0.5, t: 0 });
  } else if (id === "inverted_coaster") {
    const pts = trackPoints(isHigh ? "loop2" : "loop");
    // Hang path sits under the rail
    const hangPts = pts.map((p) => new THREE.Vector3(p.x, p.y - (isPeak ? 0.28 : 0.22), p.z));
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(isHigh ? 0.75 : 0.65, 0.055, 6, 24),
      mat(`${key}_loop`, color, { metalness: 0.4 }),
    );
    ring.position.y = 1.15;
    ring.rotation.z = Math.PI / 2;
    g.add(ring);
    if (isHigh) {
      const ring2 = new THREE.Mesh(
        new THREE.TorusGeometry(0.55, 0.05, 6, 20),
        mat(`${key}_loop2`, accent, { metalness: 0.4 }),
      );
      ring2.position.set(0.85, 1.0, 0.15);
      ring2.rotation.z = Math.PI / 2;
      g.add(ring2);
    }
    if (tier >= 3) {
      const hang = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.08), mat(`${key}_hang`, BRIGHT.metal));
      hang.position.set(0, 1.95, 0);
      g.add(hang);
    }
    if (isPeak) {
      const spine = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.4), mat(`${key}_spine`, BRIGHT.metal));
      spine.position.set(0, 1.95, 0);
      g.add(spine);
    }
    const car = hangCar(mat, key, accent, tier >= 4, isPeak);
    car.position.copy(hangPts[0]!);
    g.add(car);
    pushCycle(g, { type: "track", obj: car, points: hangPts, speed: 0.55, t: 0 });
  } else if (id === "launch_coaster") {
    const pts = trackPoints(isHigh ? "launch2" : "launch");
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 0.32), mat(`${key}_ramp`, BRIGHT.metal));
    ramp.position.set(0, 0.75, 0);
    g.add(ramp);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.1, 0.22), mat(`${key}_brake`, color));
    tower.position.set(0.95, 1.15, 0);
    g.add(tower);
    if (isHigh) {
      const ret = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 0.22), mat(`${key}_ret`, BRIGHT.metal));
      ret.position.set(0, 0.9, 0.28);
      g.add(ret);
    }
    if (tier >= 3) {
      const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 6), mat(`${key}_noz`, accent));
      nozzle.rotation.z = -Math.PI / 2;
      nozzle.position.set(-1.05, 0.85, 0);
      g.add(nozzle);
    }
    const car = launchSled(mat, key, accent, tier >= 4, isPeak);
    car.position.copy(pts[0]!);
    g.add(car);
    pushCycle(g, { type: "track", obj: car, points: pts, speed: 0.9, t: 0 });
    if (tier >= 4) {
      const flash = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), emissiveAccent(mat, `${key}_flash`, 0xffe066, 0.95));
      flash.position.set(-1.0, 0.95, 0);
      g.add(flash);
      pushCycle(g, { type: "flash", light: flash, period: 0.5 });
    }
    if (isPeak) {
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.4), mat(`${key}_pad`, BRIGHT.metal));
      pad.position.set(-1.1, 0.72, 0);
      g.add(pad);
    }
  } else {
    // wild_mouse — wooden trestle + mouse tub
    const pts = trackPoints(isHigh ? "mouse2" : "mouse");
    const posts = isPeak ? 8 : isHigh ? 6 : 4;
    for (let i = 0; i < posts; i++) {
      const p = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, isPeak ? 0.85 : isHigh ? 0.7 : 0.5, 0.08),
        mat(`${key}_m${i}`, BRIGHT.wood),
      );
      p.position.set(-0.55 + i * (1.2 / Math.max(1, posts - 1)), isPeak ? 0.55 : isHigh ? 0.5 : 0.4, (i % 2) * 0.28 - 0.12);
      g.add(p);
    }
    buildTrackRails(g, mat, key, color, pts, false);
    if (tier >= 3) {
      const mouse = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), mat(`${key}_mouse`, accent));
      mouse.position.set(0.65, isHigh ? 1.35 : 1.05, 0);
      g.add(mouse);
    }
    if (isPeak) {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.16), mat(`${key}_sign`, accent));
      sign.position.set(-0.55, 1.15, 0.2);
      g.add(sign);
    }
    const car = mouseTub(mat, key, accent, tier >= 4, isPeak);
    car.position.copy(pts[0]!);
    g.add(car);
    pushCycle(g, { type: "track", obj: car, points: pts, speed: 0.75, t: 0 });
  }
  return g;
}

// ——— Wheels ———

function buildFerris(
  enterprise: boolean,
  mat: MatFn,
  key: string,
  color: number,
  accent: number,
  fw: number,
  fh: number,
  tier: number,
): THREE.Group {
  const g = new THREE.Group();
  const isHigh = high(tier);
  const isPeak = peak(tier);
  if (tier >= 2) stoneBase(g, mat, key, fw, fh, ISO_TILE);

  if (!enterprise) {
    // Classic upright ferris — cabins hang on a vertical wheel
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.6, 0.2), mat(`${key}_stand`, BRIGHT.metal));
    stand.position.y = 1.0;
    const standR = stand.clone();
    standR.position.z = 0.35;
    g.add(stand, standR);
    if (tier >= 3) {
      const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), mat(`${key}_ax`, BRIGHT.metal));
      axle.rotation.x = Math.PI / 2;
      axle.position.set(0, 1.55, 0.18);
      g.add(axle);
    }
    if (isHigh) {
      const station = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 0.7), mat(`${key}_st`, BRIGHT.wood));
      station.position.set(0, 0.55, 0.55);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.35, 4), mat(`${key}_roof`, color));
      roof.position.set(0, 0.95, 0.55);
      roof.rotation.y = Math.PI / 4;
      g.add(station, roof);
    }
    if (isPeak) {
      const ticket = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 0.3), mat(`${key}_tix`, accent));
      ticket.position.set(-0.7, 0.4, 0.55);
      g.add(ticket);
    }
    const rim = new THREE.Group();
    rim.position.y = 1.55;
    const hoop = new THREE.Mesh(
      new THREE.TorusGeometry(isPeak ? 1.15 : isHigh ? 1.05 : 0.9, 0.05, 6, 28),
      tier >= 4 ? emissiveAccent(mat, `${key}_rim`, color, 0.45) : mat(`${key}_rim`, color, { metalness: 0.35 }),
    );
    hoop.rotation.y = Math.PI / 2;
    rim.add(hoop);
    if (isHigh) {
      const hoop2 = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.04, 6, 24), mat(`${key}_rim2`, accent, { metalness: 0.3 }));
      hoop2.rotation.y = Math.PI / 2;
      rim.add(hoop2);
    }
    const cabins: THREE.Object3D[] = [];
    const n = isPeak ? 12 : isHigh ? 10 : 8;
    const R = isPeak ? 1.15 : isHigh ? 1.05 : 0.9;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      const cabin = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.18), mat(`${key}_cab${i}`, accent));
      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.16), mat(`${key}_lid${i}`, 0x64748b));
      lid.position.y = 0.12;
      cabin.add(box, lid);
      cabin.position.set(0, Math.sin(ang) * R, Math.cos(ang) * R);
      rim.add(cabin);
      cabins.push(cabin);
    }
    g.add(rim);
    pushCycle(g, { type: "wheel", rim, cabins, speed: 0.35, levelCabins: true });
  } else {
    // Enterprise — tilted spinning arm + gondola ring (not an upright ferris)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.25, 10), mat(`${key}_base`, BRIGHT.metal));
    base.position.y = 0.25;
    g.add(base);
    if (tier >= 3) {
      const counter = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.2), mat(`${key}_cw`, BRIGHT.stoneDark));
      counter.position.set(-0.55, 0.35, 0);
      g.add(counter);
    }
    const pivot = new THREE.Group();
    pivot.position.y = isPeak ? 0.95 : isHigh ? 0.85 : 0.7;
    const armLen = isPeak ? 1.5 : isHigh ? 1.35 : 1.0;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, armLen, 0.14), mat(`${key}_arm`, BRIGHT.metal));
    arm.position.y = armLen / 2;
    pivot.add(arm);
    const rim = new THREE.Group();
    rim.position.y = armLen;
    const hoopR = isPeak ? 0.95 : isHigh ? 0.85 : 0.65;
    const hoop = new THREE.Mesh(
      new THREE.TorusGeometry(hoopR, 0.05, 6, 24),
      tier >= 4 ? emissiveAccent(mat, `${key}_rim`, color, 0.5) : mat(`${key}_rim`, color),
    );
    hoop.rotation.y = Math.PI / 2;
    rim.add(hoop);
    const n = isPeak ? 12 : isHigh ? 10 : 8;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.2), mat(`${key}_seat${i}`, accent));
      seat.position.set(Math.sin(ang) * hoopR, Math.cos(ang) * hoopR * 0.15, Math.cos(ang) * hoopR);
      rim.add(seat);
    }
    if (isPeak) {
      const hub = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), emissiveAccent(mat, `${key}_hub`, accent, 0.7));
      rim.add(hub);
      const fence = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.03, 6, 16), mat(`${key}_fence`, BRIGHT.metal));
      fence.rotation.x = Math.PI / 2;
      fence.position.y = 0.2;
      g.add(fence);
    }
    pivot.add(rim);
    pivot.rotation.z = 0.55;
    g.add(pivot);
    pushCycle(g, {
      type: "enterprise",
      arm: pivot,
      rim,
      speed: 0.7,
      liftAmp: isPeak ? 0.42 : isHigh ? 0.35 : 0.22,
      baseY: pivot.position.y,
    });
  }
  return g;
}

// ——— Carousel / swinger ———

function buildCarouselRide(
  wave: boolean,
  mat: MatFn,
  key: string,
  color: number,
  accent: number,
  fw: number,
  fh: number,
  tier: number,
): THREE.Group {
  const g = new THREE.Group();
  const isHigh = high(tier);
  const isPeak = peak(tier);
  if (tier >= 2) stoneBase(g, mat, key, fw, fh, ISO_TILE);
  const baseY = tier >= 2 ? 0.4 : 0.18;

  if (!wave) {
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(isPeak ? 1.05 : isHigh ? 0.95 : 0.75, isPeak ? 1.1 : isHigh ? 1.0 : 0.8, 0.12, 16),
      mat(`${key}_plat`, BRIGHT.wood),
    );
    platform.position.y = baseY;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, isPeak ? 1.75 : isHigh ? 1.6 : 1.3, 8),
      mat(`${key}_pole`, BRIGHT.metal),
    );
    pole.position.y = baseY + (isPeak ? 1.0 : isHigh ? 0.9 : 0.75);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(isPeak ? 1.25 : isHigh ? 1.15 : 0.9, isPeak ? 0.6 : isHigh ? 0.55 : 0.45, 8),
      mat(`${key}_roof`, color),
    );
    roof.position.y = baseY + (isPeak ? 1.95 : isHigh ? 1.75 : 1.45);
    g.add(platform, pole, roof);
    if (tier >= 3) {
      const trim = new THREE.Mesh(new THREE.TorusGeometry(isHigh ? 0.85 : 0.7, 0.03, 6, 16), mat(`${key}_trim`, accent));
      trim.rotation.x = Math.PI / 2;
      trim.position.y = roof.position.y - 0.15;
      g.add(trim);
    }
    if (isPeak) {
      const finial = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), emissiveAccent(mat, `${key}_fin`, accent, 0.7));
      finial.position.y = roof.position.y + 0.35;
      g.add(finial);
    }
    const spin = new THREE.Group();
    spin.position.y = baseY + 0.15;
    const horses: THREE.Object3D[] = [];
    const rows = isHigh ? 2 : 1;
    for (let row = 0; row < rows; row++) {
      const n = row === 0 ? 6 : 8;
      const r = row === 0 ? 0.45 : 0.72;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2;
        const horse = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.08), mat(`${key}_h${row}${i}`, i % 2 ? accent : color));
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.55, 5), mat(`${key}_s${row}${i}`, BRIGHT.metal));
        stick.position.y = 0.25;
        horse.add(body, stick);
        horse.position.set(Math.cos(ang) * r, 0.2, Math.sin(ang) * r);
        spin.add(horse);
        horses.push(horse);
      }
    }
    g.add(spin);
    pushCycle(g, { type: "carousel", spin, horses, speed: 0.85, bobAmp: 0.12 });
  } else {
    const poleH = isPeak ? 2.2 : isHigh ? 2.0 : 1.55;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, poleH, 8), mat(`${key}_pole`, BRIGHT.metal));
    pole.position.y = baseY + poleH / 2;
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(isPeak ? 0.6 : isHigh ? 0.55 : 0.4, isPeak ? 0.6 : isHigh ? 0.55 : 0.4, 0.1, 12),
      mat(`${key}_top`, color),
    );
    top.position.y = baseY + poleH;
    g.add(pole, top);
    if (tier >= 3) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 6, 14), mat(`${key}_ring`, accent));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = baseY + poleH * 0.55;
      g.add(ring);
    }
    if (isPeak) {
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 6), mat(`${key}_tip`, accent));
      tip.position.y = baseY + poleH + 0.18;
      g.add(tip);
    }
    const spin = new THREE.Group();
    spin.position.y = baseY + poleH - 0.15;
    const chairs: THREE.Object3D[] = [];
    const n = isPeak ? 12 : isHigh ? 10 : 8;
    const chainLen = isPeak ? 0.95 : isHigh ? 0.85 : 0.55;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      const chair = new THREE.Group();
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, chainLen, 4), mat(`${key}_ch${i}`, BRIGHT.metal));
      chain.position.y = -chainLen / 2;
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.14), mat(`${key}_seat${i}`, accent));
      seat.position.y = -chainLen;
      chair.add(chain, seat);
      chair.position.set(Math.cos(ang) * 0.35, 0, Math.sin(ang) * 0.35);
      spin.add(chair);
      chairs.push(chair);
    }
    g.add(spin);
    pushCycle(g, { type: "swinger", spin, chairs, speed: 0.95, flare: isPeak ? 0.4 : isHigh ? 0.35 : 0.18 });
  }
  return g;
}

// ——— Towers ———

function buildTowerRide(
  space: boolean,
  mat: MatFn,
  key: string,
  color: number,
  accent: number,
  fw: number,
  fh: number,
  tier: number,
): THREE.Group {
  const g = new THREE.Group();
  const isHigh = high(tier);
  const isPeak = peak(tier);
  if (tier >= 2) stoneBase(g, mat, key, fw, fh, ISO_TILE);

  if (!space) {
    // Drop tower — square stone shaft + cage car
    const h = isPeak ? 3.0 : isHigh ? 2.6 : 2.0;
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.35, h, 0.35), mat(`${key}_stone`, BRIGHT.stone));
    shaft.position.y = h / 2 + 0.25;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, h, 0.08), mat(`${key}_rail`, BRIGHT.metal));
    rail.position.set(0.22, h / 2 + 0.25, 0);
    g.add(shaft, rail);
    if (tier >= 3) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.04), mat(`${key}_win`, 0x7dd3fc));
      win.position.set(0, h * 0.4, 0.2);
      g.add(win);
    }
    if (isHigh) {
      const balc = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.7), mat(`${key}_balc`, BRIGHT.stoneDark));
      balc.position.y = h * 0.55;
      g.add(balc);
    }
    if (isPeak) {
      const crown = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.5), mat(`${key}_crown`, accent));
      crown.position.y = h + 0.35;
      g.add(crown);
    }
    const car = new THREE.Group();
    const cage = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.28, 0.55),
      tier >= 4 ? emissiveAccent(mat, `${key}_car`, accent, 0.55) : mat(`${key}_car`, accent),
    );
    const bars = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.04), mat(`${key}_bars`, BRIGHT.metal));
    bars.position.set(0, 0.08, 0.28);
    car.add(cage, bars);
    car.position.y = 0.55;
    g.add(car);
    pushCycle(g, { type: "climbDrop", car, low: 0.55, high: h + 0.15, climb: 0.35, fall: 2.2, phase: 0, pause: 0.4 });
  } else {
    // Space shot — round rocket column + cone cabin (not a square shaft)
    const h = isPeak ? 3.2 : isHigh ? 2.8 : 2.2;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, h, 8), mat(`${key}_col`, color));
    col.position.y = h / 2 + 0.2;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.35, 8), mat(`${key}_nose`, accent));
    nose.position.y = h + 0.35;
    g.add(col, nose);
    if (tier >= 3) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 6, 12), mat(`${key}_ring`, BRIGHT.metal));
      ring.position.y = h * 0.45;
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
    }
    if (isHigh) {
      for (const z of [-1, 1]) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.22), mat(`${key}_fin${z}`, accent));
        fin.position.set(0, 0.55, z * 0.18);
        g.add(fin);
      }
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.1, 10), mat(`${key}_pad`, BRIGHT.metal));
      pad.position.y = 0.3;
      g.add(pad);
    }
    if (isPeak) {
      const plume = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 6), emissiveAccent(mat, `${key}_plume`, 0xf97316, 0.9));
      plume.position.y = 0.2;
      plume.rotation.x = Math.PI;
      g.add(plume);
      pushCycle(g, { type: "blink", obj: plume, period: 0.35 });
    }
    const rocket = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.45, 8),
      tier >= 4 ? emissiveAccent(mat, `${key}_rkt`, accent, 0.7) : mat(`${key}_rkt`, accent),
    );
    rocket.position.y = 0.55;
    g.add(rocket);
    pushCycle(g, { type: "climbDrop", car: rocket, low: 0.55, high: h + 0.1, climb: 0.55, fall: 3.2, phase: 0, pause: 0.55 });
  }
  return g;
}

// ——— Pirate / teacups ———

function buildShipRide(
  mat: MatFn,
  key: string,
  color: number,
  accent: number,
  fw: number,
  fh: number,
  tier: number,
): THREE.Group {
  const g = new THREE.Group();
  const isHigh = high(tier);
  if (tier >= 2) stoneBase(g, mat, key, fw, fh, ISO_TILE);

  const frame = new THREE.Group();
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.12), mat(`${key}_leg`, BRIGHT.metal));
  const legR = legL.clone();
  legL.position.set(-0.55, 0.85, 0);
  legR.position.set(0.55, 0.85, 0);
  legL.rotation.z = 0.35;
  legR.rotation.z = -0.35;
  const axle = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.1), mat(`${key}_ax`, BRIGHT.metal));
  axle.position.y = 1.35;
  frame.add(legL, legR, axle);

  const swing = new THREE.Group();
  swing.position.y = 1.35;
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 0.4), mat(`${key}_hull`, BRIGHT.wood));
  hull.position.y = -0.55;
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.55), mat(`${key}_sail`, color));
  sail.position.set(0, -0.15, 0.05);
  swing.add(hull, sail);
  if (tier >= 3) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 5), mat(`${key}_mast`, BRIGHT.wood));
    mast.position.set(0, -0.1, 0);
    swing.add(mast);
    const dock = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.45), mat(`${key}_dock`, BRIGHT.wood));
    dock.position.set(0, 0.25, 0.45);
    g.add(dock);
  }
  if (isHigh) {
    const deck2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.35), mat(`${key}_deck2`, BRIGHT.wood));
    deck2.position.set(0, -0.3, 0);
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.35, 6), mat(`${key}_cannon`, BRIGHT.black));
    cannon.rotation.z = Math.PI / 2;
    cannon.position.set(0.55, -0.5, 0);
    swing.add(deck2, cannon);
  }
  if (tier >= 4) {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), emissiveAccent(mat, `${key}_lite`, accent, 0.8));
    light.position.set(0, 0.15, 0);
    swing.add(light);
  }
  if (peak(tier)) {
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.22), mat(`${key}_flag`, accent));
    flag.position.set(0, 0.45, 0.05);
    swing.add(flag);
    pushCycle(g, { type: "flag", obj: flag, amp: 0.35, speed: 2.2 });
    const gangway = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 0.55), mat(`${key}_gang`, BRIGHT.wood));
    gangway.position.set(0.55, 0.2, 0.2);
    gangway.rotation.z = -0.2;
    g.add(gangway);
  }
  g.add(frame, swing);
  pushCycle(g, { type: "ship", swing, amp: 0.85, speed: 1.1 });
  return g;
}

function buildTeacups(
  mat: MatFn,
  key: string,
  color: number,
  accent: number,
  fw: number,
  fh: number,
  tier: number,
): THREE.Group {
  const g = new THREE.Group();
  const isHigh = high(tier);
  const isPeak = peak(tier);
  if (tier >= 2) stoneBase(g, mat, key, fw, fh, ISO_TILE);
  const discR = isPeak ? 1.05 : isHigh ? 0.95 : 0.7;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(discR, discR, 0.1, 16), mat(`${key}_disc`, color));
  disc.position.y = tier >= 2 ? 0.4 : 0.2;
  g.add(disc);
  if (tier >= 3) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.22, 10), mat(`${key}_pot`, accent));
    pot.position.y = disc.position.y + 0.18;
    g.add(pot);
  }
  if (isPeak) {
    const spout = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 10, Math.PI), mat(`${key}_spout`, BRIGHT.metal));
    spout.position.set(0.16, disc.position.y + 0.22, 0);
    spout.rotation.y = Math.PI / 2;
    g.add(spout);
  }
  const cups: THREE.Object3D[] = [];
  const colors = [0xef4444, 0x3b82f6, 0x22c55e, 0xfacc15, 0xa855f7, 0xf97316, 0x06b6d4, 0xec4899];
  const n = isPeak ? 10 : isHigh ? 8 : 4;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const cup = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.12, 0.16, 10),
      tier >= 4 ? emissiveAccent(mat, `${key}_cup${i}`, colors[i % colors.length]!, 0.4) : mat(`${key}_cup${i}`, colors[i % colors.length]!),
    );
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 6, 10, Math.PI), mat(`${key}_h${i}`, accent));
    handle.position.set(0.14, 0, 0);
    handle.rotation.y = Math.PI / 2;
    cup.add(body, handle);
    cup.position.set(Math.cos(ang) * (discR * 0.55), 0.14, Math.sin(ang) * (discR * 0.55));
    disc.add(cup);
    cups.push(cup);
  }
  pushCycle(g, { type: "teacups", disc, cups, discSpeed: 0.7, cupSpeed: 1.6 });
  return g;
}

// ——— Water ———

function buildWaterRide(
  id: string,
  mat: MatFn,
  key: string,
  color: number,
  accent: number,
  fw: number,
  fh: number,
  tier: number,
): THREE.Group {
  const g = new THREE.Group();
  const isHigh = high(tier);
  const isPeak = peak(tier);
  if (tier >= 2) stoneBase(g, mat, key, fw, fh, ISO_TILE);
  const baseY = tier >= 2 ? 0.35 : 0.15;

  if (id === "swan_lake") {
    const pool = new THREE.Mesh(
      new THREE.CylinderGeometry(isPeak ? 1.05 : isHigh ? 0.95 : 0.7, isPeak ? 1.1 : isHigh ? 1.0 : 0.75, 0.2, 16),
      mat(`${key}_pool`, BRIGHT.water, { transparent: true, opacity: 0.75 }),
    );
    pool.position.y = baseY;
    const fountain = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 6), mat(`${key}_fount`, 0xe0f2fe));
    fountain.position.y = baseY + 0.35;
    g.add(pool, fountain);
    if (tier >= 3) {
      const lily = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 8), mat(`${key}_lily`, 0x86efac));
      lily.position.set(0.35, baseY + 0.12, 0.2);
      g.add(lily);
    }
    if (isHigh) {
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.2), mat(`${key}_br`, BRIGHT.wood));
      bridge.position.set(0, baseY + 0.2, 0.55);
      g.add(bridge);
    }
    if (isPeak) {
      const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), emissiveAccent(mat, `${key}_lan`, accent, 0.75));
      lantern.position.set(0, baseY + 0.55, 0.55);
      g.add(lantern);
      pushCycle(g, { type: "blink", obj: lantern, period: 0.9 });
    }
    for (let i = 0; i < 2; i++) {
      const swan = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), mat(`${key}_swan${i}`, BRIGHT.white));
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.2, 6), mat(`${key}_neck${i}`, BRIGHT.white));
      neck.position.set(0.08, 0.12, 0);
      neck.rotation.z = -0.5;
      swan.add(body, neck);
      swan.position.set(Math.cos(i * Math.PI) * 0.35, baseY + 0.18, Math.sin(i * Math.PI) * 0.35);
      g.add(swan);
      pushCycle(g, { type: "bumpers", cars: [swan], radius: isHigh ? 0.55 : 0.35, speed: 0.55 + i * 0.1 });
    }
  } else if (id === "log_flume") {
    const chute = new THREE.Mesh(new THREE.BoxGeometry(isHigh ? 1.8 : 1.2, 0.12, 0.35), mat(`${key}_chute`, BRIGHT.wood));
    chute.position.set(0, baseY + 0.55, 0);
    chute.rotation.z = isHigh ? -0.25 : -0.35;
    g.add(chute);
    if (tier >= 3) {
      const splash = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.2, 0.2),
        mat(`${key}_splash`, BRIGHT.water, { transparent: true, opacity: 0.65 }),
      );
      splash.position.set(0.55, baseY + 0.35, 0);
      g.add(splash);
    }
    if (isHigh) {
      const up = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.3), mat(`${key}_up`, BRIGHT.wood));
      up.position.set(-0.7, baseY + 0.35, 0.25);
      up.rotation.z = 0.4;
      g.add(up);
    }
    if (isPeak) {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.25), mat(`${key}_tw`, BRIGHT.wood));
      tower.position.set(-0.95, baseY + 0.55, 0.25);
      g.add(tower);
    }
    const logs = isHigh ? 2 : 1;
    for (let i = 0; i < logs; i++) {
      const log = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 0.35, 8),
        tier >= 4 ? emissiveAccent(mat, `${key}_log${i}`, accent, 0.35) : mat(`${key}_log${i}`, accent),
      );
      log.rotation.z = Math.PI / 2;
      const pts = [
        new THREE.Vector3(-0.7, baseY + 0.85, 0),
        new THREE.Vector3(0, baseY + 0.55, 0),
        new THREE.Vector3(0.7, baseY + 0.25, 0),
        new THREE.Vector3(-0.7, baseY + 0.85, 0),
      ];
      if (isHigh) {
        pts.splice(0, 0, new THREE.Vector3(-0.9, baseY + 0.35, 0.25), new THREE.Vector3(-0.7, baseY + 0.85, 0));
      }
      log.position.copy(pts[i]!);
      g.add(log);
      pushCycle(g, { type: "track", obj: log, points: pts, speed: 0.4, t: i * 0.4 });
    }
  } else if (id === "white_water") {
    const channel = new THREE.Mesh(
      new THREE.BoxGeometry(isHigh ? 1.6 : 1.2, 0.25, isHigh ? 0.85 : 0.55),
      mat(`${key}_ch`, 0x94a3b8),
    );
    channel.position.y = baseY + 0.15;
    g.add(channel);
    for (let i = 0; i < 4; i++) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1, 0), mat(`${key}_rk${i}`, 0x78716c));
      rock.position.set(-0.4 + i * 0.25, baseY + 0.28, (i % 2) * 0.2 - 0.1);
      g.add(rock);
    }
    if (tier >= 3) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.06), mat(`${key}_rail`, BRIGHT.metal));
      rail.position.set(0, baseY + 0.35, 0.35);
      g.add(rail);
    }
    if (isHigh) {
      const fall = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 0.2), mat(`${key}_fall`, BRIGHT.water, { transparent: true, opacity: 0.7 }));
      fall.position.set(0.55, baseY + 0.4, 0);
      g.add(fall);
    }
    if (isPeak) {
      const spray = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 6), mat(`${key}_spray`, 0xe0f2fe, { transparent: true, opacity: 0.6 }));
      spray.position.set(0.55, baseY + 0.7, 0);
      g.add(spray);
    }
    const boat = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.12, 0.22),
      tier >= 4 ? emissiveAccent(mat, `${key}_boat`, color, 0.4) : mat(`${key}_boat`, color),
    );
    boat.position.set(-0.3, baseY + 0.35, 0);
    g.add(boat);
    pushCycle(g, { type: "shake", obj: boat, amp: 0.06, speed: 5 });
    pushCycle(g, { type: "slide", obj: boat, axis: "x", base: -0.3, amp: 0.4, speed: 0.8 });
  } else {
    // splash_boats
    const pool = new THREE.Mesh(
      new THREE.CylinderGeometry(isHigh ? 0.85 : 0.65, isHigh ? 0.9 : 0.7, 0.18, 14),
      mat(`${key}_pool`, BRIGHT.water, { transparent: true, opacity: 0.7 }),
    );
    pool.position.y = baseY;
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.3), mat(`${key}_slide`, color));
    slide.position.set(-0.35, baseY + 0.55, 0);
    slide.rotation.z = -0.45;
    g.add(pool, slide);
    if (tier >= 3) {
      const stair = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.35, 0.2), mat(`${key}_stair`, BRIGHT.wood));
      stair.position.set(-0.65, baseY + 0.35, 0.2);
      g.add(stair);
    }
    if (isHigh) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.7), mat(`${key}_wall`, 0xbae6fd, { transparent: true, opacity: 0.65 }));
      wall.position.set(0.55, baseY + 0.55, 0);
      g.add(wall);
    }
    if (isPeak) {
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.25, 6), mat(`${key}_can`, accent));
      canopy.position.set(0.55, baseY + 1.15, 0);
      g.add(canopy);
    }
    const boat = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.08, 0.22),
      tier >= 4 ? emissiveAccent(mat, `${key}_boat`, accent, 0.45) : mat(`${key}_boat`, accent),
    );
    const pts = [
      new THREE.Vector3(-0.55, baseY + 0.85, 0),
      new THREE.Vector3(-0.1, baseY + 0.45, 0),
      new THREE.Vector3(0.25, baseY + 0.22, 0),
      new THREE.Vector3(0.1, baseY + 0.55, 0),
      new THREE.Vector3(-0.55, baseY + 0.85, 0),
    ];
    boat.position.copy(pts[0]!);
    g.add(boat);
    pushCycle(g, { type: "track", obj: boat, points: pts, speed: 0.55, t: 0 });
  }
  return g;
}

// ——— Games ———

function buildGameRide(
  id: string,
  mat: MatFn,
  key: string,
  color: number,
  accent: number,
  fw: number,
  fh: number,
  tier: number,
): THREE.Group {
  const g = new THREE.Group();
  const isHigh = high(tier);
  if (tier >= 2) stoneBase(g, mat, key, fw, fh, ISO_TILE);
  const by = tier >= 2 ? 0.55 : 0.35;

  if (id === "shooting_gallery") {
    const counter = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.45, 0.4), mat(`${key}_ctr`, BRIGHT.wood));
    counter.position.set(0, by, -0.1);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.06, 0.06), mat(`${key}_gun`, BRIGHT.metal));
    gun.position.set(-0.25, by + 0.28, 0.15);
    g.add(counter, gun);
    const rows = isHigh ? 2 : 1;
    for (let r = 0; r < rows; r++) {
      const target = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.04), mat(`${key}_t${r}`, accent));
      target.position.set(0, by + 0.2 + r * 0.25, 0.35 + r * 0.15);
      g.add(target);
      pushCycle(g, { type: "slide", obj: target, axis: "x", base: 0, amp: 0.35, speed: 1.4 + r * 0.3 });
    }
  } else if (id === "ring_toss") {
    const n = isHigh ? 6 : 3;
    for (let i = 0; i < n; i++) {
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.28, 6), mat(`${key}_b${i}`, 0x38bdf8));
      bottle.position.set(-0.25 + (i % 3) * 0.25, by + 0.2, 0.2 + Math.floor(i / 3) * 0.25);
      g.add(bottle);
    }
    if (isHigh) {
      const table2 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.35), mat(`${key}_t2`, BRIGHT.wood));
      table2.position.set(0, by + 0.55, 0.35);
      g.add(table2);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 6, 12), mat(`${key}_ring`, accent));
    ring.position.set(0, by + 0.6, 0.25);
    g.add(ring);
    pushCycle(g, { type: "ringDrop", ring, low: by + 0.35, high: by + 0.7, speed: 1.15 });
  } else if (id === "high_striker") {
    const h = peak(tier) ? 2.25 : isHigh ? 2.0 : 1.45;
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.08, h, 0.08), mat(`${key}_pole`, BRIGHT.metal));
    pole.position.set(0, h / 2 + 0.2, 0.15);
    const bell = new THREE.Mesh(
      new THREE.SphereGeometry(isHigh ? 0.14 : 0.1, 8, 8),
      tier >= 4 ? emissiveAccent(mat, `${key}_bell`, BRIGHT.gold, 0.85) : mat(`${key}_bell`, BRIGHT.gold),
    );
    // Bell stays at the top; marker climbs to strike it
    bell.position.set(0, h + 0.22, 0.15);
    bell.name = "strikerBell";
    const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.08), mat(`${key}_ham`, accent));
    hammer.position.set(0.3, 0.35, 0.15);
    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.06), mat(`${key}_mk`, color));
    marker.position.set(0, 0.5, 0.15);
    marker.name = "strikerMarker";
    g.add(pole, bell, hammer, marker);
    if (tier >= 3) {
      const scale = new THREE.Mesh(new THREE.BoxGeometry(0.04, h * 0.7, 0.02), mat(`${key}_scale`, 0xfef08a));
      scale.position.set(-0.1, h * 0.45, 0.15);
      g.add(scale);
    }
    if (peak(tier)) {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 8), mat(`${key}_base`, BRIGHT.wood));
      base.position.set(0, 0.2, 0.15);
      g.add(base);
    }
    pushCycle(g, { type: "bell", bell, marker, low: 0.5, high: h + 0.05, speed: 0.85 });
    pushCycle(g, { type: "hinge", obj: hammer, axis: "z", amp: 0.9, speed: 1.4, base: -0.2 });
  } else if (id === "basketball_arcade") {
    const lane = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.5), mat(`${key}_lane`, 0xfed7aa));
    lane.position.set(0, by - 0.1, 0.1);
    g.add(lane);
    const heights = isHigh ? [by + 0.45, by + 0.75] : [by + 0.55];
    heights.forEach((hy, i) => {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 6, 12), mat(`${key}_hoop${i}`, 0xf97316));
      hoop.position.set(0.25, hy, 0.15);
      hoop.rotation.x = Math.PI / 2;
      g.add(hoop);
    });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), mat(`${key}_ball`, accent));
    ball.position.set(-0.2, by + 0.15, 0.2);
    g.add(ball);
    pushCycle(g, { type: "ballHoop", ball, low: by + 0.15, high: by + 0.85, speed: 1.25 });
  } else {
    // vr_pods — booths + glowing screen at every stage (not a blank box)
    const n = peak(tier) ? 5 : isHigh ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const booth = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.55, 0.4), mat(`${key}_booth${i}`, color));
      booth.position.set(-0.4 + (i % 2) * 0.45 + (i >= 2 ? 0.05 : 0), by + 0.1, (i >= 2 ? 0.35 : 0) + (i >= 4 ? 0.15 : 0));
      g.add(booth);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.04), mat(`${key}_vis${i}`, 0x0f172a));
      visor.position.copy(booth.position);
      visor.position.z += 0.22;
      visor.position.y += 0.12;
      g.add(visor);
    }
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(isHigh ? 0.7 : 0.45, isHigh ? 0.35 : 0.28),
      emissiveAccent(mat, `${key}_scr`, accent, tier >= 4 ? 0.95 : 0.7),
    );
    screen.position.set(0, by + 0.4, 0.55);
    g.add(screen);
    pushCycle(g, { type: "flash", light: screen, period: 0.55 });
    if (tier >= 3) {
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 4), mat(`${key}_cable`, BRIGHT.metal));
      cable.position.set(0.35, by + 0.55, 0.2);
      g.add(cable);
    }
  }
  return g;
}

// ——— Generics ———

function buildGenericRide(
  id: string,
  mat: MatFn,
  key: string,
  color: number,
  accent: number,
  fw: number,
  fh: number,
  tier: number,
): THREE.Group {
  const g = new THREE.Group();
  const isHigh = high(tier);
  if (tier >= 2) stoneBase(g, mat, key, fw, fh, ISO_TILE);

  if (id === "giant_frisbee") {
    const arm = new THREE.Group();
    arm.position.y = 1.15;
    const len = isHigh ? 1.7 : 1.3;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.12, len, 0.12), mat(`${key}_beam`, BRIGHT.metal));
    beam.position.y = -len * 0.15;
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(isHigh ? 0.9 : 0.55, 0.14, 0.28),
      tier >= 4 ? emissiveAccent(mat, `${key}_seat`, accent, 0.5) : mat(`${key}_seat`, accent),
    );
    seat.position.y = -len * 0.7;
    arm.add(beam, seat);
    g.add(arm);
    pushCycle(g, { type: "pendulum", arm, amp: isHigh ? 0.9 : 0.7, speed: 1.0 });
  } else if (id === "top_spin") {
    const arm = new THREE.Group();
    arm.position.y = 1.1;
    const upper = new THREE.Mesh(new THREE.BoxGeometry(isHigh ? 1.5 : 1.15, 0.12, 0.12), mat(`${key}_arm`, BRIGHT.metal));
    arm.add(upper);
    const cars: THREE.Object3D[] = [];
    for (const x of [-0.55, 0.55]) {
      const car = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.2, 0.28),
        tier >= 4 ? emissiveAccent(mat, `${key}_c${x}`, accent, 0.5) : mat(`${key}_c${x}`, accent),
      );
      car.position.set(x * (isHigh ? 1.15 : 1), 0, 0);
      arm.add(car);
      cars.push(car);
    }
    if (isHigh) {
      const lower = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.1), mat(`${key}_arm2`, BRIGHT.metal));
      lower.position.y = -0.55;
      arm.add(lower);
      for (const x of [-0.45, 0.45]) {
        const car = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.22), mat(`${key}_lc${x}`, color));
        car.position.set(x, -0.55, 0);
        arm.add(car);
        cars.push(car);
      }
    }
    g.add(arm);
    pushCycle(g, { type: "topSpin", arm, cars, speed: 1.25 });
  } else if (id === "bumper_cars") {
    const r = isHigh ? 0.95 : 0.7;
    const arena = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.05, 0.1, 14), mat(`${key}_arena`, 0xcbd5e1));
    arena.position.y = tier >= 2 ? 0.35 : 0.15;
    g.add(arena);
    const cars: THREE.Object3D[] = [];
    const n = isHigh ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const car = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.16), mat(`${key}_car${i}`, i % 2 ? color : accent));
      car.position.set(Math.cos((i / n) * Math.PI * 2) * (r * 0.45), arena.position.y + 0.14, Math.sin((i / n) * Math.PI * 2) * (r * 0.45));
      g.add(car);
      cars.push(car);
    }
    pushCycle(g, { type: "bumpers", cars, radius: r * 0.45, speed: 1.35 });
  } else if (id === "monorail") {
    const len = isHigh ? 2.6 : 2.0;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.18), mat(`${key}_beam`, BRIGHT.metal));
    beam.position.y = 1.0;
    g.add(beam);
    for (const x of [-len * 0.35, len * 0.35]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 6), mat(`${key}_p${x}`, BRIGHT.stone));
      p.position.set(x, 0.55, 0);
      g.add(p);
    }
    if (isHigh) {
      const turn = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.06, 6, 16, Math.PI), mat(`${key}_turn`, BRIGHT.metal));
      turn.position.set(len * 0.4, 1.0, 0.35);
      turn.rotation.x = Math.PI / 2;
      g.add(turn);
    }
    const car = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.22, 0.22),
      tier >= 4 ? emissiveAccent(mat, `${key}_car`, color, 0.55) : mat(`${key}_car`, color),
    );
    const pts = isHigh
      ? [-1.1, -0.4, 0.3, 0.9, 1.1, 0.9, 0.3, -0.4, -1.1].map((x, i) => new THREE.Vector3(x, 1.2, i > 4 ? 0.35 : 0))
      : [-0.9, -0.3, 0.3, 0.9, 0.3, -0.3, -0.9].map((x) => new THREE.Vector3(x, 1.2, 0));
    car.position.copy(pts[0]!);
    g.add(car);
    pushCycle(g, { type: "track", obj: car, points: pts, speed: 0.4, t: 0 });
  } else if (id === "haunted_manor") {
    const house = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.75), mat(`${key}_house`, color));
    house.position.y = tier >= 2 ? 0.85 : 0.55;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.8, 0.45, 4), mat(`${key}_roof`, 0x1e1b4b));
    roof.position.y = house.position.y + 0.65;
    roof.rotation.y = Math.PI / 4;
    roof.rotation.z = 0.08;
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.28),
      tier >= 4 ? emissiveAccent(mat, `${key}_win`, accent, 0.9) : mat(`${key}_win`, accent),
    );
    win.position.set(0.2, house.position.y + 0.15, 0.39);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.38, 0.04), mat(`${key}_door`, 0x312e81));
    door.position.set(-0.15, house.position.y - 0.25, 0.39);
    g.add(house, roof, win, door);
    if (isHigh) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.55), mat(`${key}_wing`, color));
      wing.position.set(0.7, house.position.y - 0.1, 0);
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.9, 6), mat(`${key}_tw`, 0x312e81));
      tower.position.set(-0.55, house.position.y + 0.35, -0.2);
      g.add(wing, tower);
    }
    pushCycle(g, { type: "blink", obj: win, period: 0.7 });
    pushCycle(g, { type: "door", obj: door, amp: 0.35, speed: 0.6 });
  } else if (id === "maze_labyrinth") {
    const h = peak(tier) ? 0.9 : isHigh ? 0.75 : 0.5;
    const walls = peak(tier) ? 8 : isHigh ? 6 : 4;
    const wallObjs: THREE.Object3D[] = [];
    for (let i = 0; i < walls; i++) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.65, h, 0.1), mat(`${key}_w${i}`, color));
      const ang = (i / walls) * Math.PI * 2;
      wall.position.set(Math.cos(ang) * 0.4, h / 2 + 0.2, Math.sin(ang) * 0.4);
      wall.rotation.y = ang;
      g.add(wall);
      wallObjs.push(wall);
    }
    // Inner rotating gate — maze motion is walls/gates, not only a flag
    const gate = new THREE.Mesh(new THREE.BoxGeometry(0.55, h * 0.85, 0.08), mat(`${key}_gate`, accent));
    gate.position.set(0, h / 2 + 0.2, 0);
    g.add(gate);
    pushCycle(g, { type: "spin", obj: gate, axis: "y", speed: 0.55 });
    if (tier >= 3) {
      const arch = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.12), mat(`${key}_arch`, BRIGHT.wood));
      arch.position.set(0.45, h + 0.35, 0.4);
      g.add(arch);
    }
    if (isHigh) {
      const dead = new THREE.Mesh(new THREE.BoxGeometry(0.5, h, 0.1), mat(`${key}_dead`, accent));
      dead.position.set(0.15, h / 2 + 0.2, 0);
      g.add(dead);
      pushCycle(g, { type: "hinge", obj: dead, axis: "y", amp: 0.35, speed: 0.7, base: 0.2 });
    }
    if (peak(tier)) {
      const hedge = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), mat(`${key}_hedge`, 0x22c55e));
      hedge.position.set(-0.35, 0.35, -0.35);
      g.add(hedge);
    }
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.25), mat(`${key}_flag`, accent));
    flag.position.set(0.45, isHigh ? 1.2 : 0.95, 0.4);
    g.add(flag);
    pushCycle(g, { type: "flag", obj: flag, amp: 0.4, speed: 2.4 });
  } else if (id === "mini_railway") {
    const track = new THREE.Mesh(
      new THREE.TorusGeometry(isHigh ? 0.7 : 0.5, 0.04, 6, 24),
      mat(`${key}_track`, BRIGHT.metal),
    );
    track.rotation.x = Math.PI / 2;
    track.position.y = tier >= 2 ? 0.32 : 0.12;
    g.add(track);
    const loco = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.18), mat(`${key}_loco`, color));
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.16, 6), mat(`${key}_stack`, BRIGHT.black));
    stack.position.set(0.08, 0.14, 0);
    const car = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.16), mat(`${key}_car`, accent));
    car.position.set(-0.28, 0, 0);
    loco.add(body, stack, car);
    loco.position.set(isHigh ? 0.7 : 0.5, track.position.y + 0.12, 0);
    g.add(loco);
    pushCycle(g, { type: "bumpers", cars: [loco], radius: isHigh ? 0.7 : 0.5, speed: 0.75 });
  } else if (id === "submarine") {
    const pool = new THREE.Mesh(
      new THREE.CylinderGeometry(isHigh ? 0.85 : 0.6, isHigh ? 0.9 : 0.65, 0.22, 14),
      mat(`${key}_pool`, BRIGHT.water, { transparent: true, opacity: 0.7 }),
    );
    pool.position.y = tier >= 2 ? 0.38 : 0.18;
    const sub = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.16, isHigh ? 0.5 : 0.3, 4, 8),
      mat(`${key}_sub`, color),
    );
    body.rotation.z = Math.PI / 2;
    for (const x of [-0.12, 0.12]) {
      const win = new THREE.Mesh(new THREE.CircleGeometry(0.05, 8), mat(`${key}_win${x}`, 0x7dd3fc));
      win.position.set(x, 0.05, 0.16);
      sub.add(win);
    }
    if (isHigh) {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.12), mat(`${key}_ct`, accent));
      tower.position.set(0, 0.2, 0);
      sub.add(tower);
    }
    sub.add(body);
    sub.position.y = pool.position.y + 0.28;
    g.add(pool, sub);
    pushCycle(g, { type: "sub", obj: sub, baseY: sub.position.y, amp: 0.28, speed: 1.0 });
  } else {
    // motion_cinema — open hall with a screen that changes at every stage
    const hall = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.85, 0.7), mat(`${key}_hall`, color));
    hall.position.set(0, tier >= 2 ? 0.75 : 0.5, -0.1);
    g.add(hall);
    const seats = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.35), mat(`${key}_seats`, accent));
    seats.position.set(0, hall.position.y - 0.15, 0.2);
    g.add(seats);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(tier >= 4 ? 0.75 : 0.55, tier >= 4 ? 0.42 : 0.32),
      emissiveAccent(mat, `${key}_scr`, 0x22d3ee, tier >= 4 ? 0.85 : 0.65),
    );
    screen.position.set(0, hall.position.y + 0.12, 0.42);
    g.add(screen);
    // Flash first so look billboards pick screen motion
    pushCycle(g, { type: "flash", light: screen, period: 0.7 });
    pushCycle(g, { type: "shake", obj: seats, amp: 0.045, speed: 6 });
    if (tier >= 3) {
      const projector = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.16), mat(`${key}_proj`, BRIGHT.metal));
      projector.position.set(0, hall.position.y + 0.35, -0.35);
      g.add(projector);
    }
    if (isHigh) {
      const row2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.3), mat(`${key}_row2`, accent));
      row2.position.set(0, hall.position.y - 0.05, -0.05);
      g.add(row2);
      pushCycle(g, { type: "shake", obj: row2, amp: 0.035, speed: 5.5 });
    }
    if (peak(tier)) {
      const marquee = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.08), emissiveAccent(mat, `${key}_marq`, accent, 0.8));
      marquee.position.set(0, hall.position.y + 0.55, 0.3);
      g.add(marquee);
      pushCycle(g, { type: "flash", light: marquee, period: 1.1 });
    }
  }
  return g;
}

export function buildAttractionMesh(
  def: AttractionDef,
  mat: MatFn,
  broken: boolean,
  tier = 1,
): THREE.Group {
  const visualTier = broken ? 1 : Math.max(1, Math.min(5, Math.floor(tier) || 1));
  const color = broken ? 0x9ca3af : brighten(def.color, 0.15);
  const accent = broken ? 0x78716c : brighten(def.accent, 0.1);
  const fw = def.footprint.w;
  const fh = def.footprint.h;
  const key = `ride_${def.id}`;
  let g: THREE.Group;

  switch (def.id) {
    case "sky_coaster":
    case "inverted_coaster":
    case "launch_coaster":
    case "wild_mouse":
      g = buildCoasterRide(def.id, mat, key, color, accent, fw, fh, visualTier);
      break;
    case "mega_ferris":
      g = buildFerris(false, mat, key, color, accent, fw, fh, visualTier);
      break;
    case "enterprise_wheel":
      g = buildFerris(true, mat, key, color, accent, fw, fh, visualTier);
      break;
    case "grand_carousel":
      g = buildCarouselRide(false, mat, key, color, accent, fw, fh, visualTier);
      break;
    case "wave_swinger":
      g = buildCarouselRide(true, mat, key, color, accent, fw, fh, visualTier);
      break;
    case "drop_tower":
      g = buildTowerRide(false, mat, key, color, accent, fw, fh, visualTier);
      break;
    case "space_shot":
      g = buildTowerRide(true, mat, key, color, accent, fw, fh, visualTier);
      break;
    case "pirate_ship":
      g = buildShipRide(mat, key, color, accent, fw, fh, visualTier);
      break;
    case "enchanted_teacups":
      g = buildTeacups(mat, key, color, accent, fw, fh, visualTier);
      break;
    case "swan_lake":
    case "log_flume":
    case "white_water":
    case "splash_boats":
      g = buildWaterRide(def.id, mat, key, color, accent, fw, fh, visualTier);
      break;
    case "shooting_gallery":
    case "ring_toss":
    case "high_striker":
    case "basketball_arcade":
    case "vr_pods":
      g = buildGameRide(def.id, mat, key, color, accent, fw, fh, visualTier);
      break;
    default:
      g = buildGenericRide(def.id, mat, key, color, accent, fw, fh, visualTier);
  }

  g.userData.defId = def.id;
  g.userData.shape = def.shape;
  g.userData.broken = broken;
  g.userData.tier = visualTier;
  addShadow(g);
  if (!broken) tryApplyEntityLook(g, "attraction", def.id, def.footprint);
  return g;
}

export function animateAttraction(obj: THREE.Object3D, dt: number, broken: boolean, time: number): void {
  if (broken) return;
  if (obj.userData.hasLookImage) {
    animateLookBillboard(obj, dt, time);
    return;
  }
  const cycles = obj.userData.cycles as Cycle[] | undefined;
  if (!cycles) return;
  for (const c of cycles) {
    switch (c.type) {
      case "spin": {
        if (c.axis === "x") c.obj.rotation.x += dt * c.speed;
        else if (c.axis === "z") c.obj.rotation.z += dt * c.speed;
        else c.obj.rotation.y += dt * c.speed;
        break;
      }
      case "bob":
        c.obj.position.y = c.baseY + Math.abs(Math.sin(time * c.speed)) * c.amp;
        break;
      case "track": {
        c.t = (c.t + dt * c.speed) % 1;
        const n = c.points.length;
        if (n < 2) break;
        const f = c.t * (n - 1);
        const i = Math.floor(f);
        const j = Math.min(n - 1, i + 1);
        const u = f - i;
        c.obj.position.lerpVectors(c.points[i]!, c.points[j]!, u);
        break;
      }
      case "wheel": {
        c.rim.rotation.x += dt * c.speed;
        if (c.levelCabins) {
          for (const cabin of c.cabins) cabin.rotation.x = -c.rim.rotation.x;
        }
        break;
      }
      case "enterprise": {
        c.rim.rotation.x += dt * c.speed;
        c.arm.position.y = c.baseY + Math.sin(time * c.speed * 0.55) * c.liftAmp;
        break;
      }
      case "carousel": {
        c.spin.rotation.y += dt * c.speed;
        c.horses.forEach((h, i) => {
          h.position.y = 0.2 + Math.sin(time * c.speed * 2 + i) * c.bobAmp;
        });
        break;
      }
      case "swinger": {
        c.spin.rotation.y += dt * c.speed;
        const flare = 0.55 + Math.sin(time * c.speed) * c.flare;
        c.chairs.forEach((ch, i) => {
          const ang = (i / c.chairs.length) * Math.PI * 2;
          ch.position.x = Math.cos(ang) * flare;
          ch.position.z = Math.sin(ang) * flare;
          ch.rotation.z = (flare - 0.55) * 0.8 * Math.cos(ang);
        });
        break;
      }
      case "climbDrop": {
        c.phase += dt;
        const pause = c.pause ?? 0.35;
        const cycle = 1 / c.climb + pause + 1 / c.fall;
        const t = c.phase % cycle;
        const climbDur = 1 / c.climb;
        if (t < climbDur) {
          c.car.position.y = c.low + (c.high - c.low) * (t / climbDur);
        } else if (t < climbDur + pause) {
          c.car.position.y = c.high;
        } else {
          const u = (t - climbDur - pause) * c.fall;
          c.car.position.y = c.high - (c.high - c.low) * Math.min(1, u);
        }
        break;
      }
      case "ship":
        c.swing.rotation.z = Math.sin(time * c.speed) * c.amp;
        break;
      case "teacups":
        c.disc.rotation.y += dt * c.discSpeed;
        for (const cup of c.cups) cup.rotation.y += dt * c.cupSpeed;
        break;
      case "flash": {
        c.light.visible = Math.sin(time * ((Math.PI * 2) / c.period)) > 0.2;
        break;
      }
      case "pendulum":
        c.arm.rotation.z = Math.sin(time * c.speed) * c.amp;
        break;
      case "topSpin":
        c.arm.rotation.y += dt * c.speed;
        c.cars.forEach((car, i) => {
          car.rotation.z += dt * c.speed * (i % 2 === 0 ? 1.2 : -1.2);
        });
        break;
      case "bumpers":
        c.cars.forEach((car, i) => {
          const ang = time * c.speed + (i / c.cars.length) * Math.PI * 2;
          // reverse direction periodically
          const dir = Math.floor(time * 0.4 + i) % 2 === 0 ? 1 : -1;
          car.position.x = Math.cos(ang * dir) * c.radius;
          car.position.z = Math.sin(ang * dir) * c.radius;
          car.rotation.y = -ang * dir + Math.PI / 2;
        });
        break;
      case "blink":
        c.obj.visible = Math.sin(time * ((Math.PI * 2) / c.period)) > 0;
        break;
      case "flag":
        c.obj.rotation.y = Math.sin(time * c.speed) * c.amp;
        break;
      case "sub":
        c.obj.position.y = c.baseY + Math.sin(time * c.speed) * c.amp;
        break;
      case "shake":
        c.obj.rotation.x = Math.sin(time * c.speed) * c.amp;
        c.obj.rotation.z = Math.cos(time * c.speed * 1.3) * c.amp;
        break;
      case "slide":
        if (c.axis === "x") c.obj.position.x = c.base + Math.sin(time * c.speed) * c.amp;
        else c.obj.position.z = c.base + Math.sin(time * c.speed) * c.amp;
        break;
      case "ringDrop": {
        const u = (Math.sin(time * c.speed) + 1) / 2;
        c.ring.position.y = c.high + (c.low - c.high) * u;
        break;
      }
      case "bell": {
        const u = (Math.sin(time * c.speed) + 1) / 2;
        if (c.marker) c.marker.position.y = c.low + (c.high - c.low) * u;
        // Gold bell itself rings when the marker reaches the top
        const nearTop = u > 0.82;
        c.bell.scale.setScalar(nearTop ? 1.12 + Math.sin(time * 22) * 0.1 : 1);
        c.bell.rotation.z = nearTop ? Math.sin(time * 18) * 0.28 : 0;
        c.bell.rotation.x = nearTop ? Math.cos(time * 16) * 0.12 : 0;
        break;
      }
      case "ballHoop": {
        const u = (Math.sin(time * c.speed) + 1) / 2;
        c.ball.position.y = c.low + (c.high - c.low) * u;
        c.ball.position.x = -0.15 + u * 0.4;
        break;
      }
      case "steam":
        c.puffs.forEach((p, i) => {
          const t = (time * c.speed + i * 0.4) % 1;
          p.position.y = 0.9 + t * 0.55;
          p.scale.setScalar(0.5 + t);
          (p as THREE.Mesh).visible = t < 0.95;
        });
        break;
      case "strings":
        c.strings.forEach((s, i) => {
          s.rotation.z = Math.sin(time * c.speed + i) * 0.15;
        });
        break;
      case "hinge": {
        const base = c.base ?? 0;
        const v = base + Math.sin(time * c.speed) * c.amp;
        if (c.axis === "x") c.obj.rotation.x = v;
        else if (c.axis === "z") c.obj.rotation.z = v;
        else c.obj.rotation.y = v;
        break;
      }
      case "pop":
        c.objs.forEach((o, i) => {
          o.position.y = c.baseY + Math.abs(Math.sin(time * c.speed + i)) * c.amp;
        });
        break;
      case "drip":
        c.obj.position.y = c.baseY + ((Math.sin(time * c.speed) + 1) / 2) * c.amp;
        c.obj.scale.setScalar(0.6 + ((Math.sin(time * c.speed) + 1) / 2) * 0.5);
        break;
      case "door":
        c.obj.rotation.y = Math.max(0, Math.sin(time * c.speed)) * c.amp;
        break;
      default: {
        const _exhaustive: never = c;
        void _exhaustive;
      }
    }
  }
}

export function setAttractionBrokenFlag(obj: THREE.Object3D, broken: boolean): void {
  obj.userData.broken = broken;
}

// ——— Stalls ———

function buildBalloonCart(mat: MatFn, key: string, tier: number): THREE.Group {
  const g = new THREE.Group();
  const isHigh = high(tier);
  const cart = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.45), mat(`${key}_cart`, BRIGHT.wood));
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
  const strings: THREE.Object3D[] = [];
  const balloons = isHigh
    ? [
        [-0.2, 1.35, 0xef4444],
        [0, 1.55, 0x3b82f6],
        [0.2, 1.3, 0xfacc15],
        [-0.05, 1.75, 0xec4899],
        [0.28, 1.6, 0xa855f7],
        [-0.28, 1.5, 0x22c55e],
        [0.1, 1.9, 0xf97316],
      ]
    : [
        [-0.15, 1.15, 0xef4444],
        [0.05, 1.35, 0x3b82f6],
        [0.2, 1.1, 0xfacc15],
        [-0.05, 1.5, 0xec4899],
        [0.25, 1.4, 0xa855f7],
      ];
  const poleH = isHigh ? 0.35 : 0;
  for (const [dx, dy, c] of balloons as [number, number, number][]) {
    const string = new THREE.Group();
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, dy - 0.5 + poleH, 4), mat(`${key}_line${c}`, 0xe5e7eb));
    line.position.y = (dy - 0.5 + poleH) / 2 + 0.5;
    const b = new THREE.Mesh(new THREE.SphereGeometry(isHigh ? 0.16 : 0.14, 10, 10), mat(`${key}_b${c}`, c));
    b.position.y = dy + poleH;
    string.add(line, b);
    string.position.set(dx, 0, 0.15);
    g.add(string);
    strings.push(string);
  }
  if (isHigh) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 5), mat(`${key}_pole`, BRIGHT.metal));
    pole.position.set(0, 0.85, 0.1);
    g.add(pole);
  }
  pushCycle(g, { type: "strings", strings, speed: 2.2 });
  const wheel1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 10), mat(`${key}_w`, 0x292524));
  wheel1.rotation.z = Math.PI / 2;
  wheel1.position.set(-0.25, 0.12, 0.28);
  const wheel2 = wheel1.clone();
  wheel2.position.x = 0.25;
  g.add(wheel1, wheel2);
  return g;
}

export function buildStallMesh(def: StallDef, mat: MatFn, tier = 1): THREE.Group {
  const t = Math.max(1, Math.min(5, Math.floor(tier) || 1));
  const key = `stall_${def.id}`;
  const col = brighten(def.color, 0.1);
  const isHigh = high(t);

  if (def.icon === "balloon" || def.id === "balloon_vendor") {
    const g = buildBalloonCart(mat, key, t);
    g.userData.defId = def.id;
    g.userData.tier = t;
    addShadow(g);
    tryApplyEntityLook(g, "stall", def.id);
    return g;
  }

  if (def.id === "photo_booth") {
    const g = new THREE.Group();
    const booth = new THREE.Mesh(
      new THREE.BoxGeometry(isHigh ? 1.05 : 0.55, 1.1, isHigh ? 0.65 : 0.55),
      mat(`${key}_booth`, colorSafe(col)),
    );
    booth.position.y = 0.65;
    const curtain = new THREE.Mesh(new THREE.PlaneGeometry(isHigh ? 0.55 : 0.35, 0.7), mat(`${key}_curt`, 0xdc2626));
    curtain.position.set(isHigh ? -0.2 : 0, 0.7, isHigh ? 0.34 : 0.29);
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), emissiveAccent(mat, `${key}_flash`, 0xfef08a, 0.95));
    flash.position.set(0.15, 1.15, 0.2);
    g.add(booth, curtain, flash);
    if (isHigh) {
      const curtain2 = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.7), mat(`${key}_curt2`, 0xb91c1c));
      curtain2.position.set(0.28, 0.7, 0.34);
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.2, 8), mat(`${key}_stool`, BRIGHT.wood));
      stool.position.set(-0.15, 0.25, 0.05);
      g.add(curtain2, stool);
    }
    pushCycle(g, { type: "flash", light: flash, period: 0.9 });
    g.userData.defId = def.id;
    g.userData.tier = t;
    addShadow(g);
    tryApplyEntityLook(g, "stall", def.id);
    return g;
  }

  const g = new THREE.Group();
  // thin counter shared only as platform — product body is the silhouette
  const counter = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.35, 0.5), mat(`${key}_ctr`, BRIGHT.wood));
  counter.position.y = 0.3;
  g.add(counter);

  buildStallProduct(g, def.id, mat, key, col, t, isHigh);

  g.userData.defId = def.id;
  g.userData.tier = t;
  addShadow(g);
  tryApplyEntityLook(g, "stall", def.id);
  return g;
}

function buildStallProduct(
  g: THREE.Group,
  id: string,
  mat: MatFn,
  key: string,
  col: number,
  _tier: number,
  isHigh: boolean,
): void {
  if (id === "espresso_bar") {
    const machine = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 0.25), mat(`${key}_mach`, BRIGHT.metal));
    machine.position.set(-0.15, 0.7, 0);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.1, 8), mat(`${key}_cup`, col));
    cup.position.set(0.2, 0.6, 0.1);
    g.add(machine, cup);
    const puffs: THREE.Object3D[] = [];
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), mat(`${key}_st${i}`, 0xf8fafc, { transparent: true, opacity: 0.55 }));
      p.position.set(0.2, 0.75, 0.1);
      g.add(p);
      puffs.push(p);
    }
    pushCycle(g, { type: "steam", puffs, speed: 0.75 });
    if (isHigh) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.2), mat(`${key}_shelf`, BRIGHT.wood));
      shelf.position.set(0.25, 0.95, -0.05);
      const mach2 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.22), mat(`${key}_mach2`, BRIGHT.metal));
      mach2.position.set(0.3, 0.7, -0.05);
      g.add(shelf, mach2);
    }
  } else if (id === "cotton_candy") {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 5), mat(`${key}_stk`, 0xfef3c7));
    stick.position.set(0, 0.85, 0);
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), mat(`${key}_cloud`, 0xf9a8d4));
    cloud.position.set(0, 1.15, 0);
    g.add(stick, cloud);
    pushCycle(g, { type: "spin", obj: stick, axis: "y", speed: 1.5 });
    pushCycle(g, { type: "spin", obj: cloud, axis: "y", speed: 1.5 });
    if (isHigh) {
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.15, 10), mat(`${key}_bowl`, col));
      bowl.position.set(0.25, 0.6, 0);
      g.add(bowl);
    }
  } else if (id === "popcorn_cart") {
    const kettle = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), mat(`${key}_ket`, 0xbae6fd, { transparent: true, opacity: 0.7 }));
    kettle.position.set(0, 0.8, 0);
    g.add(kettle);
    const kernels: THREE.Object3D[] = [];
    for (let i = 0; i < 5; i++) {
      const k = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 5), mat(`${key}_k${i}`, 0xfef3c7));
      k.position.set(-0.08 + i * 0.04, 0.8, 0);
      g.add(k);
      kernels.push(k);
    }
    pushCycle(g, { type: "pop", objs: kernels, baseY: 0.8, amp: 0.2, speed: 3 });
    if (isHigh) {
      const big = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), mat(`${key}_ket2`, 0xbae6fd, { transparent: true, opacity: 0.65 }));
      big.position.set(0.3, 0.85, 0);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.18), mat(`${key}_box`, col));
      box.position.set(-0.3, 0.7, 0.1);
      g.add(big, box);
    }
  } else if (id === "burger_shack") {
    const grill = new THREE.Mesh(new THREE.BoxGeometry(isHigh ? 0.75 : 0.45, 0.08, 0.35), mat(`${key}_grill`, BRIGHT.black));
    grill.position.set(0, 0.6, 0);
    const burger = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 10), mat(`${key}_burg`, col));
    burger.position.set(0.2, 0.75, 0.1);
    g.add(grill, burger);
    const puffs: THREE.Object3D[] = [];
    for (let i = 0; i < (isHigh ? 4 : 2); i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 5), mat(`${key}_sm${i}`, 0xe5e7eb, { transparent: true, opacity: 0.45 }));
      p.position.set(-0.1 + i * 0.08, 0.75, 0);
      g.add(p);
      puffs.push(p);
    }
    pushCycle(g, { type: "steam", puffs, speed: 0.5 });
    if (isHigh) {
      const patty = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 10), mat(`${key}_patty`, 0x78350f));
      patty.position.set(-0.2, 0.72, 0.1);
      g.add(patty);
    }
  } else if (id === "pizza_slice") {
    const oven = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(`${key}_oven`, 0x78716c));
    oven.position.y = 0.55;
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(isHigh ? 0.5 : 0.3, 0.22, 0.08), mat(`${key}_mouth`, BRIGHT.black));
    mouth.position.set(0, 0.55, 0.32);
    const slice = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.05, 3), mat(`${key}_slice`, col));
    slice.position.set(0.3, 0.6, 0.15);
    const fire = new THREE.Mesh(
      new THREE.SphereGeometry(isHigh ? 0.1 : 0.08, 6, 6),
      emissiveAccent(mat, `${key}_fire`, 0xf97316, 0.9),
    );
    fire.position.set(0, 0.55, 0.28);
    g.add(oven, mouth, slice, fire);
    pushCycle(g, { type: "blink", obj: fire, period: 0.35 });
    if (isHigh) {
      const lip = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 6, 16, Math.PI), mat(`${key}_lip`, 0x57534e));
      lip.position.set(0, 0.55, 0.3);
      lip.rotation.x = Math.PI / 2;
      g.add(lip);
    }
  } else if (id === "gelato") {
    const freezer = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.4), mat(`${key}_fr`, 0xe2e8f0));
    freezer.position.y = 0.55;
    g.add(freezer);
    const flavors = [0xf9a8d4, 0xfde68a, 0xa7f3d0, 0xfda4af, 0xbfdbfe, 0xfed7aa];
    const n = isHigh ? 6 : 3;
    for (let i = 0; i < n; i++) {
      const scoop = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), mat(`${key}_sc${i}`, flavors[i]!));
      scoop.position.set(-0.2 + (i % 3) * 0.2, 0.75 + Math.floor(i / 3) * 0.15, 0);
      g.add(scoop);
    }
    const scoopArm = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), mat(`${key}_arm`, col));
    scoopArm.position.set(0.3, 0.9, 0.15);
    g.add(scoopArm);
    pushCycle(g, { type: "bob", obj: scoopArm, baseY: 0.9, amp: 0.12, speed: 1.5 });
  } else if (id === "churros") {
    const vat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.25, 10), mat(`${key}_vat`, BRIGHT.metal));
    vat.position.set(-0.15, 0.6, 0);
    const churro = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 6), mat(`${key}_ch`, col));
    churro.position.set(0.2, 0.85, 0);
    g.add(vat, churro);
    pushCycle(g, { type: "spin", obj: churro, axis: "y", speed: 1.8 });
    if (isHigh) {
      const rack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.15), mat(`${key}_rack`, BRIGHT.metal));
      rack.position.set(0.25, 0.95, 0);
      g.add(rack);
    }
  } else if (id === "hotdog_pretzel") {
    const grill = new THREE.Mesh(new THREE.BoxGeometry(isHigh ? 0.7 : 0.45, 0.08, 0.3), mat(`${key}_grill`, BRIGHT.metal));
    grill.position.set(0, 0.6, 0);
    g.add(grill);
    for (let i = 0; i < (isHigh ? 4 : 2); i++) {
      const dog = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.22, 4, 6), mat(`${key}_dog${i}`, col));
      dog.position.set(-0.15 + i * 0.12, 0.7, 0);
      g.add(dog);
      pushCycle(g, { type: "spin", obj: dog, axis: "z", speed: 1.2 + i * 0.2 });
    }
    const bun = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.18, 4, 6), mat(`${key}_bun`, 0xfbbf24));
    bun.position.set(0.3, 0.7, 0.1);
    const pretzel = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 12), mat(`${key}_pret`, 0xd97706));
    pretzel.position.set(0.3, 0.75, -0.1);
    g.add(bun, pretzel);
  } else if (id === "lemonade") {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.4, 10), mat(`${key}_tank`, 0xfde047, { transparent: true, opacity: 0.75 }));
    tank.position.set(-0.1, 0.75, 0);
    const lemon = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), mat(`${key}_lem`, 0xfacc15));
    lemon.position.set(0.2, 0.65, 0.1);
    const tap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.06), mat(`${key}_tap`, BRIGHT.metal));
    tap.position.set(-0.1, 0.55, 0.18);
    const drip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 5), mat(`${key}_drip`, 0xfde047));
    drip.position.set(-0.1, 0.45, 0.22);
    g.add(tank, lemon, tap, drip);
    pushCycle(g, { type: "drip", obj: drip, baseY: 0.4, amp: 0.12, speed: 2 });
    if (isHigh) {
      const red = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.4, 10), mat(`${key}_red`, 0xf87171, { transparent: true, opacity: 0.75 }));
      red.position.set(0.25, 0.75, 0);
      g.add(red);
    }
  } else if (id === "bubble_tea") {
    const cup = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.28, 10), mat(`${key}_glass`, col, { transparent: true, opacity: 0.7 }));
    for (let i = 0; i < 4; i++) {
      const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 5), mat(`${key}_p${i}`, 0x1e1b4b));
      pearl.position.set(-0.04 + (i % 2) * 0.05, -0.08 + Math.floor(i / 2) * 0.05, 0.04);
      cup.add(pearl);
    }
    const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.35, 5), mat(`${key}_straw`, 0xfca5a5));
    straw.position.y = 0.2;
    cup.add(glass, straw);
    cup.position.set(0, 0.75, 0);
    g.add(cup);
    pushCycle(g, { type: "hinge", obj: cup, axis: "z", amp: 0.12, speed: 1.8 });
    if (isHigh) {
      const shaker = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.35, 10), mat(`${key}_shake`, BRIGHT.metal));
      shaker.position.set(0.3, 0.8, 0);
      g.add(shaker);
    }
  } else if (id === "waffles") {
    const iron = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 0.35), mat(`${key}_iron`, BRIGHT.metal));
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 0.35), mat(`${key}_lid`, BRIGHT.metal));
    lid.position.y = 0.08;
    lid.name = "waffleLid";
    iron.add(base, lid);
    iron.position.set(-0.1, 0.65, 0);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.25, 6), mat(`${key}_cone`, col));
    cone.position.set(0.3, 0.75, 0.1);
    g.add(iron, cone);
    pushCycle(g, { type: "hinge", obj: lid, axis: "x", amp: 0.7, speed: 1.0, base: -0.1 });
    if (isHigh) {
      const iron2 = iron.clone();
      iron2.position.set(0.25, 0.65, -0.1);
      g.add(iron2);
    }
  } else if (id === "taco_corner") {
    const plancha = new THREE.Mesh(new THREE.BoxGeometry(isHigh ? 0.75 : 0.45, 0.06, 0.35), mat(`${key}_pl`, BRIGHT.metal));
    plancha.position.set(0, 0.6, 0);
    const taco = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 3, 1, false, 0, Math.PI), mat(`${key}_taco`, col));
    taco.position.set(0.2, 0.72, 0.1);
    g.add(plancha, taco);
    const puffs: THREE.Object3D[] = [];
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 5, 5), mat(`${key}_sm`, 0xe5e7eb, { transparent: true, opacity: 0.4 }));
    p.position.set(0, 0.75, 0);
    g.add(p);
    puffs.push(p);
    pushCycle(g, { type: "steam", puffs, speed: 0.9 });
    if (isHigh) {
      const taco2 = taco.clone();
      taco2.position.set(-0.15, 0.72, 0.1);
      const puff2 = p.clone();
      puff2.position.set(0.2, 0.8, 0);
      g.add(taco2, puff2);
      puffs.push(puff2);
    }
  } else if (id === "fried_chicken") {
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.25, 10), mat(`${key}_bucket`, col));
    bucket.position.set(0.25, 0.65, 0);
    const basket = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.25), mat(`${key}_bask`, BRIGHT.metal));
    basket.position.set(-0.15, 0.75, 0);
    g.add(bucket, basket);
    pushCycle(g, { type: "bob", obj: basket, baseY: 0.75, amp: isHigh ? 0.2 : 0.1, speed: 1.2 });
    if (isHigh) {
      const deep = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.3), mat(`${key}_deep`, BRIGHT.metal));
      deep.position.set(-0.15, 0.6, 0);
      g.add(deep);
    }
  } else if (id === "donut_bar") {
    const rack = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const d = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.03, 6, 12), mat(`${key}_d${i}`, [col, 0xf9a8d4, 0xfde68a, 0xa7f3d0][i % 4]!));
      d.position.set(-0.2 + i * 0.14, 0.75, 0);
      rack.add(d);
    }
    g.add(rack);
    pushCycle(g, { type: "spin", obj: rack, axis: "y", speed: 0.6 });
    if (isHigh) {
      const rack2 = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const d = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.025, 6, 12), mat(`${key}_d2${i}`, [0xf9a8d4, col, 0xa7f3d0, 0xfde68a][i % 4]!));
        d.position.set(-0.18 + i * 0.12, 0, 0);
        rack2.add(d);
      }
      rack2.position.set(0, 1.0, 0);
      g.add(rack2);
      pushCycle(g, { type: "spin", obj: rack2, axis: "y", speed: -0.75 });
    }
  } else if (id === "smoothie") {
    const blender = new THREE.Group();
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.3, 8), mat(`${key}_jar`, col, { transparent: true, opacity: 0.75 }));
    const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), mat(`${key}_fruit`, 0xf97316));
    fruit.position.y = 0.2;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), mat(`${key}_blade`, BRIGHT.metal));
    blade.position.y = -0.05;
    blender.add(jar, fruit, blade);
    blender.position.set(0, 0.8, 0);
    g.add(blender);
    pushCycle(g, { type: "spin", obj: blade, axis: "y", speed: 8 });
    if (isHigh) {
      const b2 = blender.clone();
      b2.position.set(0.3, 0.8, 0);
      g.add(b2);
    }
  } else if (id === "souvenir_shop") {
    // shelves — not food
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.2), mat(`${key}_shelf`, BRIGHT.wood));
    shelf.position.set(0, 0.8, -0.05);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.08, 10), mat(`${key}_hat`, col));
    hat.position.set(-0.15, 0.85, 0.1);
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.1, 8), mat(`${key}_mug`, accentOr(col)));
    mug.position.set(0.15, 0.8, 0.1);
    g.add(shelf, hat, mug);
    pushCycle(g, { type: "bob", obj: hat, baseY: 0.85, amp: 0.04, speed: 1.2 });
    if (isHigh) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.95, 0.15), mat(`${key}_wall`, BRIGHT.wood));
      wall.position.set(0, 0.95, -0.15);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.15), mat(`${key}_flag`, col));
      flag.position.set(0.4, 1.45, 0);
      g.add(wall, flag);
      pushCycle(g, { type: "flag", obj: flag, amp: 0.35, speed: 2.5 });
    }
  } else if (id === "candy_factory") {
    const bowls: THREE.Object3D[] = [];
    const n = isHigh ? 6 : 3;
    for (let i = 0; i < n; i++) {
      const bowl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.08, 0.1, 8),
        mat(`${key}_bowl${i}`, [0xf472b6, 0x22d3ee, 0xfacc15, 0xa3e635, 0xc084fc, 0xfb923c][i]!, { transparent: true, opacity: 0.8 }),
      );
      if (isHigh) bowl.position.set(0, 0.6 + i * 0.12, 0);
      else bowl.position.set(-0.2 + i * 0.2, 0.65, 0);
      g.add(bowl);
      bowls.push(bowl);
    }
    const sweet = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), mat(`${key}_sweet`, 0xf472b6));
    sweet.position.set(0.3, 0.75, 0.1);
    g.add(sweet);
    pushCycle(g, { type: "bob", obj: sweet, baseY: 0.75, amp: 0.2, speed: 2.5 });
  } else if (id === "soda_fountain") {
    const n = isHigh ? 6 : 3;
    for (let i = 0; i < n; i++) {
      const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6), mat(`${key}_tap${i}`, [0xef4444, 0x3b82f6, 0xfacc15, 0x22c55e, 0xa855f7, 0xf97316][i]!));
      tap.position.set(-0.25 + (i % 3) * 0.25, 0.8 + Math.floor(i / 3) * 0.2, 0.1);
      g.add(tap);
    }
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.16, 8), mat(`${key}_cup`, 0xe0f2fe, { transparent: true, opacity: 0.7 }));
    cup.position.set(0, 0.6, 0.2);
    g.add(cup);
    const bubbles: THREE.Object3D[] = [];
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 5), mat(`${key}_bub${i}`, 0xffffff, { transparent: true, opacity: 0.7 }));
      b.position.set(0, 0.6, 0.2);
      g.add(b);
      bubbles.push(b);
    }
    pushCycle(g, { type: "steam", puffs: bubbles, speed: 1.1 });
  } else {
    // fallback product
    const prod = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), mat(`${key}_prod`, col));
    prod.position.set(0, 0.75, 0);
    g.add(prod);
  }
}

function accentOr(c: number): number {
  return ((c >> 1) & 0x7f7f7f) | 0x404040;
}

function colorSafe(c: number): number {
  return c || 0x64748b;
}

export function animateStall(obj: THREE.Object3D, dt: number, time: number): void {
  animateAttraction(obj, dt, false, time);
}
