/**
 * Bright isometric park props: staff, bin, bench, warehouse, car, trash, decor.
 * Props use a visual tier (from park level). Staff have no upgrade stages.
 */
import * as THREE from "three";
import type { StaffRole } from "../data/types";
import { type MatFn, BRIGHT, addShadow, hexToNum } from "./parkStyle";
import { tryApplyEntityLook, animateLookBillboard } from "./parkLooks";

const ROLE_COLOR: Record<StaffRole, number> = {
  janitor: 0x2563eb,
  runner: 0xea580c,
  mechanic: 0x7c3aed,
};

const FACE_YAW: Record<string, number> = {
  se: 0,
  sw: Math.PI / 2,
  nw: Math.PI,
  ne: -Math.PI / 2,
};

function isHigh(tier: number): boolean {
  return tier >= 4;
}

export function buildStaffMesh(mat: MatFn, role: StaffRole, id: string): THREE.Group {
  const g = new THREE.Group();
  const key = `staff_${id}`;
  const col = ROLE_COLOR[role];
  // Person with a tool — not a bigger capsule
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.22, 4, 8), mat(`${key}_body`, col));
  torso.position.y = 0.42;
  torso.name = "body";
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), mat(`${key}_head`, 0xf1c27d));
  head.position.y = 0.7;
  const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.14, 3, 6), mat(`${key}_ll`, col));
  const legR = legL.clone();
  legL.position.set(-0.055, 0.14, 0);
  legR.position.set(0.055, 0.14, 0);
  legL.name = "legL";
  legR.name = "legR";
  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.12, 3, 6), mat(`${key}_al`, col));
  const armR = armL.clone();
  armL.position.set(-0.16, 0.45, 0);
  armR.position.set(0.16, 0.45, 0);
  armL.name = "armL";
  armR.name = "armR";
  g.add(torso, head, legL, legR, armL, armR);

  if (role === "janitor") {
    const broom = new THREE.Group();
    broom.name = "broom";
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.55, 5), mat(`${key}_stick`, BRIGHT.wood));
    stick.position.y = 0.2;
    const brush = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.06), mat(`${key}_brush`, 0x92400e));
    brush.position.y = -0.1;
    broom.add(stick, brush);
    broom.position.set(0.2, 0.2, 0.05);
    broom.rotation.z = -0.35;
    g.add(broom);
  } else if (role === "runner") {
    // crate in both hands
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.2), mat(`${key}_crate`, BRIGHT.wood));
    crate.position.set(0, 0.48, 0.18);
    crate.name = "crate";
    g.add(crate);
  } else {
    // pipe wrench
    const wrench = new THREE.Group();
    wrench.name = "wrench";
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 5), mat(`${key}_wh`, 0x94a3b8));
    handle.rotation.z = Math.PI / 2;
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.05), mat(`${key}_jaw`, 0xcbd5e1));
    jaw.position.set(0.16, 0, 0);
    wrench.add(handle, jaw);
    wrench.position.set(0.22, 0.42, 0);
    g.add(wrench);
  }
  g.userData.role = role;
  addShadow(g);
  tryApplyEntityLook(g, "staff", role, { w: 1, h: 1 });
  return g;
}

export function animateStaff(
  obj: THREE.Object3D,
  facing: string,
  walkPhase: number,
  repairing: boolean,
  moving: boolean,
): void {
  obj.rotation.y = FACE_YAW[facing] ?? 0;
  if (obj.userData.hasLookImage) {
    const look = obj.getObjectByName("lookBillboard");
    if (look) {
      if (obj.userData.lookBaseY == null) obj.userData.lookBaseY = look.position.y;
      const base = obj.userData.lookBaseY as number;
      if (moving) {
        look.position.y = base + Math.abs(Math.sin(walkPhase * 2)) * 0.07;
        look.rotation.z = Math.sin(walkPhase) * 0.08;
      } else if (repairing) {
        look.position.y = base - 0.12 + Math.sin(walkPhase) * 0.04;
        look.rotation.z = Math.sin(walkPhase * 3) * 0.2;
      } else {
        look.position.y = base;
        look.rotation.y = Math.sin(walkPhase * 1.5) * 0.25; // idle sweep / sway
        look.rotation.z = 0;
      }
    }
    return;
  }
  const legL = obj.getObjectByName("legL");
  const legR = obj.getObjectByName("legR");
  const body = obj.getObjectByName("body");
  const wrench = obj.getObjectByName("wrench");
  const broom = obj.getObjectByName("broom");
  const armL = obj.getObjectByName("armL");
  const armR = obj.getObjectByName("armR");

  if (moving) {
    const frame = Math.floor(walkPhase) % 4;
    const swing = frame === 0 ? 0.4 : frame === 1 ? 0.12 : frame === 2 ? -0.4 : -0.12;
    if (legL) legL.rotation.x = swing;
    if (legR) legR.rotation.x = -swing;
    if (armL) armL.rotation.x = -swing * 0.6;
    if (armR) armR.rotation.x = swing * 0.6;
  } else {
    if (legL) legL.rotation.x = 0;
    if (legR) legR.rotation.x = 0;
    if (armL) armL.rotation.x = 0;
    if (armR) armR.rotation.x = 0;
    // janitor sweeps side to side when standing
    if (broom) broom.rotation.y = Math.sin(walkPhase * 1.5) * 0.55;
  }

  if (repairing && body && wrench) {
    const t = (walkPhase % 6) / 6;
    if (t < 0.35) {
      body.position.y = 0.42 - t * 0.4;
      wrench.rotation.z = -0.2;
    } else if (t < 0.7) {
      body.position.y = 0.28;
      wrench.rotation.z = -0.2 - (t - 0.35) * 2.2;
      wrench.position.y = 0.42 + (t - 0.35) * 0.9;
    } else {
      body.position.y = 0.28 + (t - 0.7) * 0.45;
      wrench.rotation.z = -0.95 + (t - 0.7) * 2.2;
      wrench.position.y = 0.42;
    }
  } else if (body) {
    body.position.y = 0.42;
    if (wrench) {
      wrench.rotation.z = 0;
      wrench.position.y = 0.42;
    }
  }
}

export function buildBinMesh(mat: MatFn, tier = 1): THREE.Group {
  const g = new THREE.Group();
  const hi = isHigh(tier);
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(hi ? 0.24 : 0.18, hi ? 0.26 : 0.2, hi ? 0.5 : 0.4, 10),
    mat("bin_body", 0x16a34a),
  );
  body.position.y = hi ? 0.3 : 0.25;
  const opening = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.04), mat("bin_open", 0x052e16));
  opening.position.set(0, hi ? 0.42 : 0.35, hi ? 0.24 : 0.18);
  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(hi ? 0.26 : 0.2, hi ? 0.26 : 0.2, 0.05, 10),
    mat("bin_lid", 0x15803d),
  );
  lid.position.y = hi ? 0.58 : 0.48;
  lid.name = "lid";
  g.add(body, opening, lid);
  if (hi) {
    const lid2 = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 10), mat("bin_lid2", 0x166534));
    lid2.position.y = 0.64;
    lid2.name = "lid2";
    g.add(lid2);
  }
  const bag = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mat("bin_bag", 0x78716c));
  bag.position.y = 0.22;
  bag.name = "bag";
  bag.visible = false;
  g.add(bag);
  addShadow(g);
  tryApplyEntityLook(g, "prop", "bin");
  return g;
}

export function animateBin(obj: THREE.Object3D, time: number, hasTrash: boolean): void {
  if (obj.userData.hasLookImage) {
    animateLookBillboard(obj, 0.016, time);
    return;
  }
  const lid = obj.getObjectByName("lid");
  const bag = obj.getObjectByName("bag");
  if (lid) lid.rotation.x = Math.sin(time * 1.2) * 0.12;
  if (bag) {
    bag.visible = hasTrash;
    if (hasTrash) bag.position.y = 0.22 + Math.sin(time * 2.5) * 0.03;
  }
}

export function buildBenchMesh(mat: MatFn, tier = 1): THREE.Group {
  const g = new THREE.Group();
  const hi = isHigh(tier);
  const w = hi ? 1.05 : 0.75;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, 0.28), mat("bench_seat", BRIGHT.wood));
  seat.position.y = 0.28;
  const back = new THREE.Mesh(new THREE.BoxGeometry(w, hi ? 0.4 : 0.28, 0.06), mat("bench_back", BRIGHT.wood));
  back.position.set(0, hi ? 0.5 : 0.44, -0.12);
  for (const x of [-w * 0.38, w * 0.38]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.06), mat("bench_leg", BRIGHT.metal));
    leg.position.set(x, 0.13, 0.08);
    g.add(leg);
    const legB = leg.clone();
    legB.position.z = -0.08;
    g.add(legB);
  }
  g.add(seat, back);
  if (hi) {
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, 0.2), mat("bench_cloth", 0xfca5a5));
    cloth.position.set(0, 0.55, -0.1);
    cloth.name = "cloth";
    g.add(cloth);
  }
  addShadow(g);
  tryApplyEntityLook(g, "prop", "bench");
  return g;
}

export function animateBench(obj: THREE.Object3D, time: number): void {
  if (obj.userData.hasLookImage) {
    animateLookBillboard(obj, 0.016, time);
    return;
  }
  const cloth = obj.getObjectByName("cloth");
  if (cloth) cloth.rotation.z = Math.sin(time * 2) * 0.08;
}

export function buildCarMesh(mat: MatFn, id: string, colorHex: string): THREE.Group {
  const g = new THREE.Group();
  const col = hexToNum(colorHex || "#ef4444");
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.32), mat(`car_${id}`, col));
  body.position.y = 0.22;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.16, 0.28),
    mat(`car_cab_${id}`, 0x93c5fd, { transparent: true, opacity: 0.75 }),
  );
  cabin.position.set(-0.05, 0.38, 0);
  for (const [x, z] of [
    [-0.18, 0.16],
    [0.18, 0.16],
    [-0.18, -0.16],
    [0.18, -0.16],
  ] as const) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 8), mat(`car_w_${id}`, 0x1f2937));
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.08, z);
    g.add(w);
  }
  g.add(body, cabin);
  addShadow(g);
  return g;
}

export function buildTrashMesh(mat: MatFn, id: string): THREE.Group {
  const g = new THREE.Group();
  const bag = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat(`trash_${id}`, 0x78716c));
  bag.position.y = 0.16;
  bag.name = "bag";
  g.add(bag);
  addShadow(g);
  return g;
}

export function setTrashAmount(obj: THREE.Object3D, amount: number): void {
  const bag = obj.getObjectByName("bag");
  if (bag) bag.scale.setScalar(0.75 + amount * 0.2);
}

export function buildDecorMesh(mat: MatFn, kind: string, key: string, tier = 1): THREE.Group {
  const g = new THREE.Group();
  const hi = isHigh(tier);
  if (kind === "tree") {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(hi ? 0.1 : 0.07, hi ? 0.12 : 0.09, hi ? 0.55 : 0.4, 6),
      mat(`${key}_trunk`, 0x78350f),
    );
    trunk.position.y = hi ? 0.35 : 0.3;
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(hi ? 0.45 : 0.35, 8, 8),
      mat(`${key}_leaf`, 0x22c55e),
    );
    leaf.position.y = hi ? 0.85 : 0.7;
    leaf.name = "leaf";
    g.add(trunk, leaf);
    if (hi) {
      const leaf2 = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), mat(`${key}_leaf2`, 0x4ade80));
      leaf2.position.set(0.2, 1.05, 0.1);
      leaf2.name = "leaf2";
      g.add(leaf2);
    }
    g.userData.sway = leaf;
  } else if (kind === "bush") {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.2, 5), mat(`${key}_trunk`, 0x78350f));
    trunk.position.y = 0.12;
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(hi ? 0.32 : 0.22, 8, 8),
      mat(`${key}_leaf`, 0x4ade80),
    );
    leaf.position.y = hi ? 0.4 : 0.32;
    leaf.name = "leaf";
    g.add(trunk, leaf);
    if (hi) {
      const leaf2 = leaf.clone();
      leaf2.position.set(0.22, 0.35, 0.05);
      g.add(leaf2);
    }
    g.userData.sway = leaf;
  } else if (kind === "statue") {
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(hi ? 0.28 : 0.2, hi ? 0.3 : 0.22, 0.2, 8),
      mat(`${key}_plinth`, BRIGHT.stone),
    );
    plinth.position.y = 0.1;
    const figure = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.4, 4, 6), mat(`${key}_fig`, 0xcbd5e1));
    figure.position.y = 0.55;
    figure.name = "figure";
    g.add(plinth, figure);
    if (hi) {
      const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 6), mat(`${key}_cloak`, 0x64748b));
      cloak.position.y = 0.5;
      cloak.name = "cloak";
      g.add(cloak);
    }
  } else {
    // flower bed — several flowers, not one ball
    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(hi ? 0.7 : 0.45, 0.08, hi ? 0.4 : 0.3),
      mat(`${key}_bed`, 0x65a30d),
    );
    bed.position.y = 0.06;
    g.add(bed);
    const heads: THREE.Object3D[] = [];
    const n = hi ? 7 : 5;
    for (let i = 0; i < n; i++) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 4), mat(`${key}_st${i}`, 0x16a34a));
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(i === n - 1 && hi ? 0.1 : 0.06, 6, 6),
        mat(`${key}_fl${i}`, [0xec4899, 0xfacc15, 0xa855f7, 0xf97316, 0x3b82f6, 0xf43f5e, 0x22d3ee][i % 7]!),
      );
      const grp = new THREE.Group();
      stem.position.y = 0.12;
      head.position.y = 0.24;
      grp.add(stem, head);
      grp.position.set(-0.2 + (i % 4) * 0.12, 0.08, (Math.floor(i / 4) - 0.3) * 0.15);
      g.add(grp);
      heads.push(grp);
    }
    g.userData.swayHeads = heads;
  }
  addShadow(g);
  tryApplyEntityLook(g, "prop", kind, { w: 1, h: 1 });
  return g;
}

export function animateDecor(obj: THREE.Object3D, time: number): void {
  if (obj.userData.hasLookImage) {
    animateLookBillboard(obj, 0.016, time);
    return;
  }
  const sway = obj.userData.sway as THREE.Object3D | undefined;
  if (sway) {
    sway.rotation.z = Math.sin(time * 1.8) * 0.08;
    sway.position.x = Math.sin(time * 1.5) * 0.02;
  }
  const leaf2 = obj.getObjectByName("leaf2");
  if (leaf2) leaf2.rotation.z = Math.sin(time * 1.6 + 1) * 0.06;
  const cloak = obj.getObjectByName("cloak");
  if (cloak) cloak.rotation.z = Math.sin(time * 1.2) * 0.04;
  const heads = obj.userData.swayHeads as THREE.Object3D[] | undefined;
  if (heads) {
    heads.forEach((h, i) => {
      h.rotation.z = Math.sin(time * 2 + i) * 0.12;
    });
  }
}

export function buildWarehouseMesh(mat: MatFn, tier = 1): THREE.Group {
  const g = new THREE.Group();
  const hi = isHigh(tier);
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(hi ? 1.7 : 1.4, 1.15, hi ? 1.5 : 1.4),
    mat("wh_body", 0xa8a29e),
  );
  body.position.y = 0.58;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(hi ? 1.85 : 1.5, 0.12, hi ? 1.65 : 1.5), mat("wh_roof", 0x78716c));
  roof.position.y = 1.2;
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(hi ? 0.75 : 0.55, 0.75, 0.06),
    mat("wh_door", 0x57534e),
  );
  door.position.set(0, 0.42, hi ? 0.78 : 0.72);
  door.name = "door";
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.12), mat("wh_shelf", BRIGHT.wood));
  shelf.position.set(-0.4, 0.55, hi ? 0.7 : 0.65);
  g.add(body, roof, door, shelf);
  if (hi) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 1.0), mat("wh_wing", 0xa8a29e));
    wing.position.set(1.1, 0.5, 0);
    g.add(wing);
  }
  addShadow(g);
  tryApplyEntityLook(g, "prop", "warehouse");
  return g;
}

export function setWarehouseDoorOpen(obj: THREE.Object3D, open: boolean, time: number): void {
  if (obj.userData.hasLookImage) {
    animateLookBillboard(obj, 0.016, time);
    return;
  }
  const door = obj.getObjectByName("door");
  if (!door) return;
  const target = open ? -1.15 : 0;
  door.rotation.y = THREE.MathUtils.lerp(door.rotation.y, target, 0.15);
  if (open) door.position.x = Math.sin(time * 2) * 0.02;
}

/** Gate flags only — body built in ThreeParkWorld; this animates named flags. */
export function animateGateFlags(obj: THREE.Object3D, time: number): void {
  const fl = obj.getObjectByName("gateFlagL");
  const fr = obj.getObjectByName("gateFlagR");
  if (fl) fl.rotation.y = Math.sin(time * 2.4) * 0.28;
  if (fr) fr.rotation.y = Math.sin(time * 2.4 + 1.2) * -0.28;
}

/** Path lamp blink when high-tier path edge is present */
export function animatePathLamp(obj: THREE.Object3D, time: number): void {
  const lamp = obj.getObjectByName("pathLamp");
  if (!lamp) return;
  lamp.visible = Math.sin(time * 3) > -0.2;
}
