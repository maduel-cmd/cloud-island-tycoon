/**
 * מנוע פארק Three.js איזומטרי מלא — תצוגה חיה מסונכרנת ל־Simulation.
 * כלל זיכרון: מגרש ריק + שער בפתיחה; שאר התוכן מהבנק בלבד.
 */
import * as THREE from "three";
import type { Simulation } from "../managers/Simulation";
import type { GridPos } from "../data/types";
import { getAttraction } from "../data/attractions";
import { getStall } from "../data/stalls";
import { gridToWorld, pixelToWorld, worldToGrid, gridWorldBounds, ISO_TILE } from "./isoMath";
import { VISITOR_SHEET } from "../assets/sprites/VisitorSheet";
import { GAME_STATIC_ASSETS } from "../config/assets";
import {
  animateAttraction,
  animateStall,
  buildAttractionMesh,
  buildStallMesh,
} from "./RideMeshes";
import { tryApplyEntityLook, warmLook, warmPathMotionFrames, warmMotionFrames } from "./parkLooks";
import {
  animateBench,
  animateBin,
  animateDecor,
  animateGateFlags,
  animatePathLamp,
  animateStaff,
  buildBenchMesh,
  buildBinMesh,
  buildCarMesh,
  buildDecorMesh,
  buildStaffMesh,
  buildTrashMesh,
  buildWarehouseMesh,
  setTrashAmount,
  setWarehouseDoorOpen,
} from "./ParkProps";

/** Re-apply look once the still finishes loading (mesh may have been built earlier). */
function ensureLook(
  obj: THREE.Group,
  kind: "attraction" | "stall" | "prop" | "staff",
  id: string,
  footprint?: { w: number; h: number },
  tier?: number,
): void {
  const t = Math.max(
    1,
    Math.min(5, Math.floor(tier ?? (obj.userData.tier as number) ?? (obj.userData.propTier as number) ?? 1) || 1),
  );
  // Keep warming motion frames even after the still is applied
  warmMotionFrames(kind, id);
  if (obj.userData.hasLookImage && obj.userData.lookTier === t) return;
  tryApplyEntityLook(obj, kind, id, footprint, undefined, t);
}

export const THREE_ZOOM_MIN = 0.35;
export const THREE_ZOOM_MAX = 3.5;

export type DragMode = "orbit" | "pan";

export type ThreeParkHandle = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  dispose: () => void;
  sync: (sim: Simulation, dt: number) => void;
  setDayNight: (hour: number) => void;
  screenToGrid: (clientX: number, clientY: number) => GridPos;
  beginDrag: (x: number, y: number, mode?: DragMode) => void;
  drag: (x: number, y: number) => void;
  endDrag: () => void;
  zoomAt: (delta: number, clientX?: number, clientY?: number) => void;
  zoomBy: (factor: number, clientX?: number, clientY?: number) => void;
  getZoom: () => number;
  onZoomChange: (fn: (z: number) => void) => () => void;
  beginPinch: (dist: number) => void;
  pinch: (dist: number, midClientX?: number, midClientY?: number) => void;
  endPinch: () => void;
  setHover: (p: GridPos | null) => void;
  /** הזזת מטרה יחסית (WASD) בכיוון המצלמה */
  nudge: (forward: number, right: number) => void;
};

const TILE_COLORS: Record<string, number> = {
  grass: 0x5f9e3a,
  path: 0xb0a090,
  parking: 0x6b7280,
  road: 0x57534e,
  cloud: 0xb8c9d4,
  locked: 0x6b7280,
  void: 0x6a9bc2,
};

function hexToNum(hex: string): number {
  const n = hex.replace("#", "");
  if (n.length !== 6) return 0x888888;
  return parseInt(n, 16);
}

export function mountThreePark(container: HTMLElement): ThreeParkHandle {
  const w = Math.max(1, container.clientWidth || 640);
  const h = Math.max(1, container.clientHeight || 480);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#87b8dc");
  // ערפל קל בלבד — חייב לראות דשא ואזורי בנייה, לא מסך עננים
  scene.fog = new THREE.FogExp2("#c5dceb", 0.006);

  /** זום = קרבה; רדיוס orbit בסיסי / zoom */
  const BASE_RADIUS = 22;
  let zoom = 1.15;
  /** orbit כמו WoW — yaw/pitch סביב מטרה */
  let orbitYaw = Math.PI / 4;
  let orbitPitch = 0.88;
  const PITCH_MIN = 0.35;
  const PITCH_MAX = 1.25;

  const aspect = () => Math.max(0.1, (container.clientWidth || w) / Math.max(1, container.clientHeight || h));

  const camera = new THREE.PerspectiveCamera(48, aspect(), 0.2, 280);
  const camTarget = new THREE.Vector3(0, 0.4, 0);
  let mapBounds = gridWorldBounds(28, 22);

  const clampCamTarget = () => {
    // שוליים לפי זום — בקצה המפה העצירה; תמיד נשארים מעל שטח המפה (עננים/אחו)
    const half = (BASE_RADIUS / zoom) * 0.42;
    const midX = mapBounds.centerX;
    const midZ = mapBounds.centerZ;
    let minX = mapBounds.minX + half;
    let maxX = mapBounds.maxX - half;
    let minZ = mapBounds.minZ + half;
    let maxZ = mapBounds.maxZ - half;
    if (minX > maxX) {
      minX = maxX = midX;
    }
    if (minZ > maxZ) {
      minZ = maxZ = midZ;
    }
    camTarget.x = Math.min(maxX, Math.max(minX, camTarget.x));
    camTarget.z = Math.min(maxZ, Math.max(minZ, camTarget.z));
    camTarget.y = 0.4;
  };

  const updateCamera = () => {
    clampCamTarget();
    camera.aspect = aspect();
    camera.updateProjectionMatrix();
    const radius = BASE_RADIUS / zoom;
    const sp = Math.sin(orbitPitch);
    const cp = Math.cos(orbitPitch);
    camera.position.set(
      camTarget.x + radius * sp * Math.sin(orbitYaw),
      camTarget.y + radius * cp,
      camTarget.z + radius * sp * Math.cos(orbitYaw),
    );
    camera.lookAt(camTarget);
  };
  updateCamera();

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.touchAction = "none";
  container.appendChild(renderer.domElement);

  // תאורת איזומטרית בהירה — קונספט רפרנס, לא מראה כהה
  const hemi = new THREE.HemisphereLight(0xe8f4ff, 0x8fbc6a, 0.75);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4dd, 1.55);
  sun.position.set(28, 42, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  sun.shadow.bias = -0.0002;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xfffaf0, 0.42));
  const rim = new THREE.DirectionalLight(0xb8d4ef, 0.4);
  rim.position.set(-20, 12, -15);
  scene.add(rim);

  // שורשי קבוצות
  const root = new THREE.Group();
  scene.add(root);
  const tilesGroup = new THREE.Group();
  const fogCloudsGroup = new THREE.Group();
  const entitiesGroup = new THREE.Group();
  const fxGroup = new THREE.Group();
  root.add(tilesGroup, fogCloudsGroup, entitiesGroup, fxGroup);

  // אי אבן / צוקים — כמו starting zone (לא גליל חום קריקטורי)
  const islandMat = new THREE.MeshStandardMaterial({
    color: 0x5a5348,
    roughness: 0.92,
    metalness: 0.05,
    flatShading: true,
  });
  const cliffMat = new THREE.MeshStandardMaterial({
    color: 0x6e6558,
    roughness: 0.95,
    flatShading: true,
  });
  const mossMat = new THREE.MeshStandardMaterial({
    color: 0x3d6b28,
    roughness: 0.9,
    flatShading: true,
  });
  const meadowMat = new THREE.MeshStandardMaterial({
    color: 0x5f9e3a,
    roughness: 0.95,
    flatShading: true,
  });
  // טקסטורת אחו פרוצדורלית (ווריאציה עדינה)
  {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#3d6b28";
      ctx.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 900; i++) {
        const g = 40 + ((i * 17) % 50);
        ctx.fillStyle = `rgb(${30 + (i % 20)},${g},${20 + (i % 15)})`;
        ctx.fillRect((i * 13) % 128, (i * 29) % 128, 2, 2);
      }
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = "#5a7a38";
        ctx.beginPath();
        ctx.ellipse((i * 31) % 128, (i * 47) % 128, 6 + (i % 4), 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(6, 6);
      tex.magFilter = THREE.LinearFilter;
      meadowMat.map = tex;
      meadowMat.needsUpdate = true;
    }
  }

  // גוף צוק מתחת — לא נראה מלמעלה
  const islandBase = new THREE.Mesh(new THREE.CylinderGeometry(15.5, 12.2, 3.2, 7), islandMat);
  islandBase.position.y = -2.0;
  islandBase.receiveShadow = true;
  islandBase.castShadow = true;
  root.add(islandBase);

  // משטח אחו ירוק על גג האי (כיסוי מלא — לא אבן אפורה חשופה)
  const meadow = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 0.35, 28), meadowMat);
  meadow.position.y = -0.05;
  meadow.receiveShadow = true;
  root.add(meadow);

  // ים עננים תחתון — מתחת לאי בלבד, לא מכסה דשא/בנייה
  const seaCloudMat = new THREE.MeshStandardMaterial({
    color: 0xe8eef5,
    roughness: 1,
    transparent: true,
    opacity: 0.72,
    flatShading: true,
    depthWrite: false,
  });
  const cloudSea = new THREE.Mesh(new THREE.CylinderGeometry(24, 24, 0.6, 28), seaCloudMat);
  cloudSea.position.y = -1.35;
  root.add(cloudSea);

  // שפת אחו מורמת / גבעות קטנות
  for (let i = 0; i < 8; i++) {
    const mound = new THREE.Mesh(new THREE.SphereGeometry(1.8 + (i % 3) * 0.4, 8, 6), meadowMat);
    const ang = (i / 8) * Math.PI * 2;
    mound.position.set(Math.cos(ang) * 10.5, 0.15, Math.sin(ang) * 10.5);
    mound.scale.set(1.6, 0.28, 1.3);
    mound.receiveShadow = true;
    root.add(mound);
  }

  // מדפי צוק
  for (let i = 0; i < 5; i++) {
    const ledge = new THREE.Mesh(
      new THREE.BoxGeometry(3.5 + (i % 3), 0.7 + (i % 2) * 0.4, 2.2),
      cliffMat,
    );
    const ang = (i / 5) * Math.PI * 2;
    ledge.position.set(Math.cos(ang) * 11.5, -1.2 - (i % 3) * 0.35, Math.sin(ang) * 11.5);
    ledge.rotation.y = ang;
    ledge.castShadow = true;
    root.add(ledge);
  }

  const underRock = new THREE.Mesh(new THREE.ConeGeometry(10.5, 9, 6), cliffMat);
  underRock.position.y = -7.2;
  underRock.castShadow = true;
  root.add(underRock);

  // כתמי אזוב על שפת האי
  for (let i = 0; i < 10; i++) {
    const patch = new THREE.Mesh(new THREE.SphereGeometry(0.9 + (i % 3) * 0.25, 6, 6), mossMat);
    const ang = (i / 10) * Math.PI * 2;
    patch.position.set(Math.cos(ang) * 13.2, -0.35, Math.sin(ang) * 13.2);
    patch.scale.set(1.4, 0.35, 1.1);
    root.add(patch);
  }

  // סלעים בודדים באחו (פרטים כמו starting zone)
  for (let i = 0; i < 7; i++) {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.35 + (i % 3) * 0.12, 0),
      cliffMat,
    );
    const ang = (i / 7) * Math.PI * 2 + 0.7;
    rock.position.set(Math.cos(ang) * (6 + (i % 4)), 0.25, Math.sin(ang) * (6 + (i % 4)));
    rock.rotation.set(0.2 * i, 0.4 * i, 0.1);
    rock.castShadow = true;
    root.add(rock);
  }

  // עצים פשוטים (גזע + עלוה) — נוכחות יער קלה
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 0.9, flatShading: true });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6b28, roughness: 0.85, flatShading: true });
  for (let i = 0; i < 9; i++) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.9, 5), trunkMat);
    trunk.position.y = 0.45;
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.55 + (i % 3) * 0.1, 1.1, 6), leafMat);
    canopy.position.y = 1.25;
    tree.add(trunk, canopy);
    const ang = (i / 9) * Math.PI * 2 + 0.15;
    const dist = 8.5 + (i % 3) * 1.2;
    tree.position.set(Math.cos(ang) * dist, 0, Math.sin(ang) * dist);
    tree.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
    root.add(tree);
  }

  // הרים רחוקים באופק
  const farMat = new THREE.MeshStandardMaterial({ color: 0x6a8499, roughness: 1, flatShading: true });
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(4 + (i % 3), 6 + (i % 4), 5), farMat);
    const ang = (i / 6) * Math.PI * 2 + 0.4;
    m.position.set(Math.cos(ang) * 48, 1 + (i % 2), Math.sin(ang) * 48);
    root.add(m);
  }

  // עננים רכים רחוקים (לא כדורים לבנים על האי)
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xf2f0ea,
    transparent: true,
    opacity: 0.55,
    roughness: 1,
  });
  for (let i = 0; i < 6; i++) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(2.2 + (i % 3) * 0.6, 10, 10), cloudMat);
    const ang = (i / 6) * Math.PI * 2;
    c.position.set(Math.cos(ang) * 22, 8 + (i % 3), Math.sin(ang) * 22);
    c.scale.set(2.2, 0.55, 1.4);
    root.add(c);
  }

  const tileMeshes = new Map<string, THREE.Object3D>();
  const entityMeshes = new Map<string, THREE.Object3D>();
  let hoverMesh: THREE.Mesh | null = null;
  let lastTileSig = "";
  let visitorTex: THREE.Texture | null = null;
  let pathLookTex: THREE.Texture | null = null;
  let pathMotionTextures: THREE.Texture[] | null = null;
  let pathMotionFrame = 0;
  let pathMotionAcc = 0;
  const PATH_MOTION_DT = 1 / 6;
  const texLoader = new THREE.TextureLoader();
  const visitorSheetSrc = GAME_STATIC_ASSETS.VISITOR_SHEET?.src;
  if (visitorSheetSrc) {
    texLoader.load(visitorSheetSrc, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      visitorTex = t;
    });
  }

  const geoCache = {
    tile: new THREE.BoxGeometry(ISO_TILE * 0.98, 0.18, ISO_TILE * 0.98),
    cloudTile: new THREE.BoxGeometry(ISO_TILE * 1.02, 0.22, ISO_TILE * 1.02),
    cloudPuff: new THREE.SphereGeometry(0.52, 8, 6),
    box: new THREE.BoxGeometry(1, 1, 1),
    capsule: new THREE.CapsuleGeometry(0.18, 0.35, 4, 8),
    plane: new THREE.PlaneGeometry(0.95, 1.55),
  };

  const matCache = new Map<string, THREE.MeshStandardMaterial>();
  const mat = (key: string, color: number, opts?: Partial<THREE.MeshStandardMaterialParameters>) => {
    const k = `${key}_${color}_${opts?.emissive ?? ""}_${opts?.roughness ?? ""}`;
    let m = matCache.get(k);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color,
        flatShading: true,
        roughness: 0.82,
        metalness: 0.08,
        ...opts,
      });
      matCache.set(k, m);
    }
    return m;
  };

  const zoomListeners = new Set<(z: number) => void>();
  let dragging = false;
  let dragMode: DragMode = "orbit";
  let lastMouse = { x: 0, y: 0 };
  let pinchDist = 0;
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();

  const centerOnGate = (sim: Simulation) => {
    mapBounds = gridWorldBounds(sim.grid.width, sim.grid.height);
    const mid = gridToWorld(sim.grid.width / 2, sim.grid.height / 2, 0);
    camTarget.set(mid.x, 0.4, mid.z);
    const g = sim.grid.gatePos;
    const wpos = gridToWorld(g.x, g.y, 0);
    camTarget.lerp(new THREE.Vector3(wpos.x, 0.4, wpos.z), 0.35);
    updateCamera();
  };

  let centered = false;
  let animTime = 0;
  let lastZoneTier = -1;

  /** Bright isometric zone look — stays readable, not dark fantasy */
  const applyZoneLook = (parkLevel: number) => {
    const tier = parkLevel <= 1 ? 0 : parkLevel <= 3 ? 1 : 2;
    if (tier === lastZoneTier) return;
    lastZoneTier = tier;
    if (tier === 0) {
      TILE_COLORS.grass = 0x5f9e3a;
      meadowMat.color.set(0x5f9e3a);
      scene.background = new THREE.Color("#87b8dc");
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.set("#c5dceb");
        scene.fog.density = 0.006;
      }
      farMat.color.set(0x8aa8ba);
      hemi.color.set(0xe8f4ff);
      sun.color.set(0xfff4dd);
      sun.intensity = 1.55;
    } else if (tier === 1) {
      TILE_COLORS.grass = 0x58b03a;
      meadowMat.color.set(0x58b03a);
      scene.background = new THREE.Color("#7aafd4");
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.set("#b8d4e8");
        scene.fog.density = 0.0055;
      }
      farMat.color.set(0x7a9aab);
      hemi.color.set(0xeef6ff);
      sun.intensity = 1.6;
    } else {
      TILE_COLORS.grass = 0x4aa84a;
      meadowMat.color.set(0x4aa84a);
      scene.background = new THREE.Color("#6a9ec8");
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.set("#a8c8dc");
        scene.fog.density = 0.005;
      }
      farMat.color.set(0x6a8a9a);
      hemi.color.set(0xf0f7ff);
      sun.color.set(0xfff8e8);
      sun.intensity = 1.65;
    }
    lastTileSig = ""; // force tile rebuild with new grass
  };

  const ensureHover = () => {
    if (hoverMesh) return;
    hoverMesh = new THREE.Mesh(
      geoCache.tile,
      new THREE.MeshStandardMaterial({
        color: 0xc9a227,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    );
    hoverMesh.position.y = 0.2;
    hoverMesh.visible = false;
    fxGroup.add(hoverMesh);
  };

  const rebuildTiles = (sim: Simulation) => {
    const g = sim.grid;
    // Path still → tile look once the image finishes loading (rebuild then).
    const pathImg = warmLook("prop", "path");
    if (pathImg && !pathLookTex) {
      pathLookTex = new THREE.Texture(pathImg);
      pathLookTex.colorSpace = THREE.SRGBColorSpace;
      pathLookTex.needsUpdate = true;
      pathLookTex.wrapS = THREE.RepeatWrapping;
      pathLookTex.wrapT = THREE.RepeatWrapping;
      lastTileSig = "";
    }
    // Path motion frames texture path tiles (not a standing lamp card).
    if (!pathMotionTextures) {
      const frames = warmPathMotionFrames();
      if (frames) {
        pathMotionTextures = frames.map((img) => {
          const t = new THREE.Texture(img);
          t.colorSpace = THREE.SRGBColorSpace;
          t.needsUpdate = true;
          t.wrapS = THREE.RepeatWrapping;
          t.wrapT = THREE.RepeatWrapping;
          return t;
        });
        pathLookTex = pathMotionTextures[0]!;
        lastTileSig = "";
      }
    }
    let sig = `${g.width}x${g.height}|`;
    for (let y = 0; y < g.height; y++) {
      for (let x = 0; x < g.width; x++) {
        sig += g.get(x, y)[0];
      }
    }
    sig += `|p${g.plots.filter((p) => p.unlocked).length}|w${sim.state.warehouseBuilt ? 1 : 0}|L${sim.state.parkLevel}|pl${pathLookTex ? 1 : 0}`;
    if (sig === lastTileSig) return;
    lastTileSig = sig;

    mapBounds = gridWorldBounds(g.width, g.height);
    // Full 1–5 prop stages — do not collapse park levels into {1,3,5}
    const propTier = Math.min(5, Math.max(1, Math.floor(sim.state.parkLevel) || 1));

    // הסר ישנים (גיאומטריה משותפת — לא dispose)
    for (const m of tileMeshes.values()) {
      tilesGroup.remove(m);
    }
    tileMeshes.clear();
    while (fogCloudsGroup.children.length > 0) {
      fogCloudsGroup.remove(fogCloudsGroup.children[0]!);
    }

    const cloudCells: { x: number; y: number; wx: number; wz: number }[] = [];

    for (let y = 0; y < g.height; y++) {
      for (let x = 0; x < g.width; x++) {
        const kind = g.get(x, y);
        const p = gridToWorld(x, y, 0);
        if (kind === "void" || kind === "cloud" || kind === "locked") {
          cloudCells.push({ x, y, wx: p.x, wz: p.z });
          continue;
        }
        const color = TILE_COLORS[kind] ?? 0x58c944;
        const pathMat =
          kind === "path" && pathLookTex
            ? (() => {
                const k = "t_path_look";
                let m = matCache.get(k);
                if (!m) {
                  m = new THREE.MeshStandardMaterial({
                    map: pathLookTex,
                    color: 0xffffff,
                    flatShading: true,
                    roughness: 0.92,
                    metalness: 0.04,
                  });
                  matCache.set(k, m);
                }
                return m;
              })()
            : mat(`t_${kind}`, color);
        const mesh = new THREE.Mesh(geoCache.tile, pathMat);
        mesh.position.set(p.x, kind === "path" || kind === "parking" || kind === "road" ? 0.12 : 0.05, p.z);
        mesh.receiveShadow = true;
        mesh.userData = { gx: x, gy: y, kind };
        tilesGroup.add(mesh);
        tileMeshes.set(`${x},${y}`, mesh);
        // Path body changes at stages 2, 3, 4+ (not only at 4)
        if (kind === "path") {
          const edgeScale = propTier >= 4 ? 1.06 : propTier >= 3 ? 1.04 : propTier >= 2 ? 1.02 : 1.0;
          if (propTier >= 2) {
            const edge = new THREE.Mesh(
              new THREE.BoxGeometry(ISO_TILE * edgeScale, propTier >= 3 ? 0.05 : 0.035, ISO_TILE * edgeScale),
              mat("path_edge", propTier >= 3 ? 0x8a8070 : 0x7a7060, { roughness: 0.95 }),
            );
            edge.position.set(p.x, 0.08, p.z);
            edge.receiveShadow = true;
            tilesGroup.add(edge);
            tileMeshes.set(`edge_${x},${y}`, edge);
          }
          if (propTier >= 3) {
            const cobble = new THREE.Mesh(
              new THREE.BoxGeometry(ISO_TILE * 0.55, 0.025, ISO_TILE * 0.55),
              mat("path_cobble", 0x9a9180, { roughness: 0.97 }),
            );
            cobble.position.set(p.x, 0.1, p.z);
            tilesGroup.add(cobble);
            tileMeshes.set(`cobble_${x},${y}`, cobble);
          }
          if (propTier >= 4) {
            const edge2 = new THREE.Mesh(
              new THREE.BoxGeometry(ISO_TILE * 0.92, 0.03, ISO_TILE * 0.92),
              mat("path_edge2", 0xa89f90, { roughness: 0.95 }),
            );
            edge2.position.set(p.x, 0.11, p.z);
            tilesGroup.add(edge2);
            tileMeshes.set(`edge2_${x},${y}`, edge2);
            if ((x + y) % 5 === 0) {
              const lamp = new THREE.Group();
              const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.55, 5), mat("path_pole", 0x57534e));
              pole.position.y = 0.4;
              const bulb = new THREE.Mesh(
                new THREE.SphereGeometry(0.07, 8, 8),
                mat("path_bulb", 0xfef08a, { emissive: 0xfef08a, emissiveIntensity: 0.7 }),
              );
              bulb.position.y = 0.7;
              bulb.name = "pathLamp";
              lamp.add(pole, bulb);
              lamp.position.set(p.x + 0.35, 0, p.z + 0.35);
              tilesGroup.add(lamp);
              tileMeshes.set(`lamp_${x},${y}`, lamp);
            }
          }
          if (propTier >= 5 && (x + y) % 7 === 0) {
            const planter = new THREE.Mesh(
              new THREE.CylinderGeometry(0.08, 0.1, 0.14, 6),
              mat("path_planter", 0x65a30d),
            );
            planter.position.set(p.x - 0.32, 0.12, p.z - 0.32);
            tilesGroup.add(planter);
            tileMeshes.set(`planter_${x},${y}`, planter);
          }
        }
      }
    }

    // אזורים נעולים — דשא מעומעם + ערפל שקוף (רואים קרקע; ברור מה לא לבנייה)
    if (cloudCells.length > 0) {
      const lockedGrassMat = mat("fog_grass", 0x4a6e3a, {
        roughness: 1,
        transparent: true,
        opacity: 0.55,
      });
      const mistMat = mat("fog_mist", 0xd5e2ef, {
        roughness: 1,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      });
      const puffMat = mat("fog_puff", 0xf4f7fb, {
        roughness: 1,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      });
      const grassInst = new THREE.InstancedMesh(geoCache.tile, lockedGrassMat, cloudCells.length);
      const mistInst = new THREE.InstancedMesh(geoCache.cloudTile, mistMat, cloudCells.length);
      const puffInst = new THREE.InstancedMesh(geoCache.cloudPuff, puffMat, cloudCells.length * 2);
      const dummy = new THREE.Object3D();
      cloudCells.forEach((c, i) => {
        dummy.position.set(c.wx, 0.04, c.wz);
        dummy.scale.set(1, 1, 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        grassInst.setMatrixAt(i, dummy.matrix);

        dummy.position.set(c.wx, 0.18, c.wz);
        dummy.updateMatrix();
        mistInst.setMatrixAt(i, dummy.matrix);

        const h1 = 0.55 + (i % 5) * 0.08;
        dummy.position.set(c.wx + ((i % 3) - 1) * 0.12, h1, c.wz + ((i % 2) - 0.5) * 0.1);
        dummy.scale.setScalar(0.7 + (i % 4) * 0.1);
        dummy.updateMatrix();
        puffInst.setMatrixAt(i * 2, dummy.matrix);

        dummy.position.set(c.wx - 0.15, h1 + 0.25, c.wz + 0.12);
        dummy.scale.setScalar(0.5 + (i % 3) * 0.08);
        dummy.updateMatrix();
        puffInst.setMatrixAt(i * 2 + 1, dummy.matrix);
      });
      grassInst.instanceMatrix.needsUpdate = true;
      mistInst.instanceMatrix.needsUpdate = true;
      puffInst.instanceMatrix.needsUpdate = true;
      grassInst.receiveShadow = true;
      fogCloudsGroup.add(grassInst, mistInst, puffInst);
    }

    // שער אבן — body changes at stages 2, 3, 4+ (not only at 4); flags animate
    const gate = g.gatePos;
    const gp = gridToWorld(gate.x, gate.y, 0);
    const gateKey = "gate_arch";
    let gateObj = entityMeshes.get(gateKey) as THREE.Group | undefined;
    if (gateObj && gateObj.userData.propTier !== propTier) {
      entitiesGroup.remove(gateObj);
      entityMeshes.delete(gateKey);
      gateObj = undefined;
    }
    if (!gateObj) {
      gateObj = new THREE.Group();
      gateObj.userData.propTier = propTier;
      const stone = mat("gate_stone", 0x6a6358, { roughness: 0.95, metalness: 0.05 });
      const gold = mat("gate_gold", 0xc9a227, { roughness: 0.35, metalness: 0.65, emissive: 0x3a2a08, emissiveIntensity: 0.15 });
      const wood = mat("gate_wood", 0x4a3420, { roughness: 0.9 });
      const banner = mat("gate_banner", 0x6b1e1e, { roughness: 0.85 });

      const span = propTier >= 4 ? 1.05 : propTier >= 3 ? 0.9 : propTier >= 2 ? 0.8 : 0.7;
      const thick = propTier >= 4 ? 0.5 : propTier >= 3 ? 0.44 : propTier >= 2 ? 0.4 : 0.38;
      const pillarH = propTier >= 3 ? 2.35 : 2.2;
      const baseL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.6), stone);
      const baseR = baseL.clone();
      baseL.position.set(-span, 0.18, 0);
      baseR.position.set(span, 0.18, 0);

      const p1 = new THREE.Mesh(new THREE.BoxGeometry(thick, pillarH, thick), stone);
      const p2 = p1.clone();
      p1.position.set(-span, pillarH / 2 + 0.15, 0);
      p2.position.set(span, pillarH / 2 + 0.15, 0);

      const capL = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.45, 4), gold);
      const capR = capL.clone();
      capL.position.set(-span, pillarH + 0.35, 0);
      capR.position.set(span, pillarH + 0.35, 0);
      capL.rotation.y = Math.PI / 4;
      capR.rotation.y = Math.PI / 4;

      const beamH = propTier >= 4 ? 0.45 : propTier >= 2 ? 0.38 : 0.32;
      const beamY = propTier >= 3 ? 2.25 : 2.15;
      const beam = new THREE.Mesh(new THREE.BoxGeometry(span * 2 + 0.4, beamH, 0.45), wood);
      beam.position.set(0, beamY, 0);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(span * 2 + 0.5, 0.08, 0.48), gold);
      trim.position.set(0, beamY + 0.23, 0);

      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.12), gold);
      crest.position.set(0, beamY + 0.5, 0.08);

      const banL = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.85), banner);
      const banR = banL.clone();
      banL.position.set(-span - 0.35, 1.5, 0.05);
      banR.position.set(span + 0.35, 1.5, 0.05);
      banL.name = "gateFlagL";
      banR.name = "gateFlagR";

      const step = new THREE.Mesh(new THREE.BoxGeometry(span * 2, 0.12, 0.7), stone);
      step.position.set(0, 0.06, 0.35);

      gateObj.add(baseL, baseR, p1, p2, capL, capR, beam, trim, crest, banL, banR, step);

      if (propTier >= 2) {
        // Stage 2: lanterns on the pillars
        for (const sx of [-span, span]) {
          const lantern = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 8, 8),
            mat("gate_lantern", 0xfef08a, { emissive: 0xfef08a, emissiveIntensity: 0.55 }),
          );
          lantern.position.set(sx, 1.7, thick / 2 + 0.08);
          gateObj.add(lantern);
        }
      }
      if (propTier >= 3) {
        // Stage 3: arch braces under the beam (body change before dual opening)
        const braceL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.12), wood);
        const braceR = braceL.clone();
        braceL.position.set(-span * 0.45, beamY - 0.35, 0);
        braceR.position.set(span * 0.45, beamY - 0.35, 0);
        braceL.rotation.z = 0.45;
        braceR.rotation.z = -0.45;
        gateObj.add(braceL, braceR);
      }
      if (propTier >= 4) {
        // Stage 4+: second opening — middle pillar
        const mid = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.0, 0.35), stone);
        mid.position.set(0, 1.15, 0);
        gateObj.add(mid);
      }
      if (propTier >= 5) {
        const finial = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 4), gold);
        finial.position.set(0, beamY + 0.95, 0);
        gateObj.add(finial);
      }
      gateObj.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });
      // Flag-wave cycle so the Nano Banana gate still keeps motion
      gateObj.userData.cycles = [{ type: "flag", speed: 2.4, amp: 0.28 }];
      entitiesGroup.add(gateObj);
      entityMeshes.set(gateKey, gateObj);
    }
    gateObj.position.set(gp.x, 0.15, gp.z);
    gateObj.scale.setScalar(1.45);
    ensureLook(gateObj, "prop", "gate", { w: 2, h: 1 }, propTier);

    // מחסן — sliding door + shelf; high stage second wing
    const whKey = "warehouse";
    if (sim.state.warehouseBuilt) {
      let wh = entityMeshes.get(whKey) as THREE.Group | undefined;
      if (!wh || wh.userData.propTier !== propTier) {
        if (wh) {
          entitiesGroup.remove(wh);
          entityMeshes.delete(whKey);
        }
        wh = buildWarehouseMesh(mat, propTier);
        wh.userData.propTier = propTier;
        entitiesGroup.add(wh);
        entityMeshes.set(whKey, wh);
      }
      const wp = gridToWorld(g.warehousePos.x, g.warehousePos.y, 0);
      wh.position.set(wp.x, 0, wp.z);
      wh.visible = true;
    } else {
      const wh = entityMeshes.get(whKey);
      if (wh) wh.visible = false;
    }

    // מרכז מצלמה בפעם הראשונה
    if (!centered) {
      centerOnGate(sim);
      centered = true;
    }
  };

  const syncEntities = (sim: Simulation, dt: number) => {
    const live = new Set<string>();
    animTime += dt;
    // Full 1–5 prop stages — do not collapse park levels into {1,3,5}
    const propTier = Math.min(5, Math.max(1, Math.floor(sim.state.parkLevel) || 1));

    for (const a of sim.state.attractions) {
      const key = `attr_${a.uid}`;
      live.add(key);
      const def = getAttraction(a.defId);
      let obj = entityMeshes.get(key) as THREE.Group | undefined;
      const needRebuild =
        !obj ||
        obj.userData.broken !== a.broken ||
        obj.userData.defId !== a.defId ||
        obj.userData.tier !== a.tier;
      if (needRebuild) {
        if (obj) {
          entitiesGroup.remove(obj);
          entityMeshes.delete(key);
        }
        if (!def) continue;
        obj = buildAttractionMesh(def, mat, a.broken, a.tier);
        entitiesGroup.add(obj);
        entityMeshes.set(key, obj);
      }
      ensureLook(obj!, "attraction", a.defId, def?.footprint, a.broken ? 1 : a.tier);
      const fw = def?.footprint.w ?? 1;
      const fh = def?.footprint.h ?? 1;
      const p = gridToWorld(a.pos.x + fw / 2 - 0.5, a.pos.y + fh / 2 - 0.5, 0);
      obj!.position.set(p.x, 0.12, p.z);
      animateAttraction(obj!, dt, a.broken, animTime);
    }

    for (const s of sim.state.stalls) {
      const key = `stall_${s.uid}`;
      live.add(key);
      const def = getStall(s.defId);
      let obj = entityMeshes.get(key) as THREE.Group | undefined;
      const needRebuild = !obj || obj.userData.defId !== s.defId || obj.userData.tier !== s.tier;
      if (needRebuild) {
        if (obj) {
          entitiesGroup.remove(obj);
          entityMeshes.delete(key);
        }
        if (!def) continue;
        obj = buildStallMesh(def, mat, s.tier);
        entitiesGroup.add(obj);
        entityMeshes.set(key, obj);
      }
      ensureLook(obj!, "stall", s.defId, undefined, s.tier);
      const p = gridToWorld(s.pos.x, s.pos.y, 0);
      obj!.position.set(p.x, 0.12, p.z);
      animateStall(obj!, dt, animTime);
    }

    for (const k of sim.grid.bins) {
      const key = `bin_${k}`;
      live.add(key);
      let obj = entityMeshes.get(key) as THREE.Group | undefined;
      if (!obj || !obj.isGroup || obj.userData.propTier !== propTier) {
        if (obj) {
          entitiesGroup.remove(obj);
          entityMeshes.delete(key);
        }
        obj = buildBinMesh(mat, propTier);
        obj.userData.propTier = propTier;
        entitiesGroup.add(obj);
        entityMeshes.set(key, obj);
      }
      ensureLook(obj, "prop", "bin", undefined, propTier);
      const [x, y] = k.split(",").map(Number);
      const p = gridToWorld(x!, y!, 0);
      obj.position.set(p.x, 0, p.z);
      animateBin(obj, animTime, sim.state.trash.length > 0);
    }

    for (const k of sim.grid.benches) {
      const key = `bench_${k}`;
      live.add(key);
      let obj = entityMeshes.get(key) as THREE.Group | undefined;
      if (!obj || !obj.isGroup || obj.userData.propTier !== propTier) {
        if (obj) {
          entitiesGroup.remove(obj);
          entityMeshes.delete(key);
        }
        obj = buildBenchMesh(mat, propTier);
        obj.userData.propTier = propTier;
        entitiesGroup.add(obj);
        entityMeshes.set(key, obj);
      }
      ensureLook(obj, "prop", "bench", undefined, propTier);
      const [x, y] = k.split(",").map(Number);
      const p = gridToWorld(x!, y!, 0);
      obj.position.set(p.x, 0, p.z);
      animateBench(obj, animTime);
    }

    for (const [k, kind] of sim.grid.decor) {
      const key = `decor_${k}`;
      live.add(key);
      let obj = entityMeshes.get(key) as THREE.Group | undefined;
      if (!obj || obj.userData.decorKind !== kind || obj.userData.propTier !== propTier) {
        if (obj) {
          entitiesGroup.remove(obj);
          entityMeshes.delete(key);
        }
        obj = buildDecorMesh(mat, kind, key, propTier);
        obj.userData.decorKind = kind;
        obj.userData.propTier = propTier;
        entitiesGroup.add(obj);
        entityMeshes.set(key, obj);
      }
      ensureLook(obj, "prop", kind, undefined, propTier);
      const [x, y] = k.split(",").map(Number);
      const p = gridToWorld(x!, y!, 0);
      obj.position.set(p.x, 0, p.z);
      animateDecor(obj, animTime);
    }

    for (const t of sim.state.trash) {
      const key = `trash_${t.id}`;
      live.add(key);
      let obj = entityMeshes.get(key) as THREE.Group | undefined;
      if (!obj || !obj.isGroup) {
        if (obj) {
          entitiesGroup.remove(obj);
          entityMeshes.delete(key);
        }
        obj = buildTrashMesh(mat, t.id);
        entitiesGroup.add(obj);
        entityMeshes.set(key, obj);
      }
      const p = gridToWorld(t.pos.x, t.pos.y, 0);
      obj.position.set(p.x, 0, p.z);
      setTrashAmount(obj, t.amount);
    }

    for (const v of sim.state.visitors) {
      const key = `vis_${v.id}`;
      live.add(key);
      let obj = entityMeshes.get(key) as THREE.Object3D | undefined;
      const wantSprite = !!visitorTex;
      const isSprite = !!(obj && (obj as THREE.Mesh).isMesh && (obj as THREE.Mesh).material instanceof THREE.MeshBasicMaterial);
      if (obj && wantSprite && !isSprite) {
        entitiesGroup.remove(obj);
        entityMeshes.delete(key);
        obj = undefined;
      }
      if (!obj) {
        if (visitorTex) {
          const map = visitorTex.clone();
          map.colorSpace = THREE.SRGBColorSpace;
          map.needsUpdate = true;
          const matV = new THREE.MeshBasicMaterial({
            map,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
          });
          const { cols, cellW, cellH } = VISITOR_SHEET;
          const idx = ((v.archetype % VISITOR_SHEET.archetypeCount) + VISITOR_SHEET.archetypeCount) %
            VISITOR_SHEET.archetypeCount;
          const col = idx % cols;
          const row = Math.floor(idx / cols);
          const imgW = cellW * cols;
          const imgH = cellH * VISITOR_SHEET.rows;
          map.repeat.set(cellW / imgW, cellH / imgH);
          map.offset.set(col * (cellW / imgW), 1 - (row + 1) * (cellH / imgH));
          const plane = new THREE.Mesh(geoCache.plane, matV);
          obj = plane;
        } else {
          const g = new THREE.Group();
          const body = new THREE.Mesh(geoCache.capsule, mat(`vc_${v.id}`, hexToNum(v.color)));
          body.position.y = 0.45;
          g.add(body);
          obj = g;
        }
        entitiesGroup.add(obj);
        entityMeshes.set(key, obj);
      }
      const p = pixelToWorld(v.pixel.x, v.pixel.y, 0);
      // billboard ממורכז מעל האריח (לא נבלע בקרקע)
      obj.position.set(p.x, visitorTex ? 0.72 : 0.05, p.z);
      obj.quaternion.copy(camera.quaternion);
      const base = visitorTex ? 1.35 : 1;
      if (v.ageBand === "child") obj.scale.setScalar(base * 0.88);
      else if (v.ageBand === "senior") obj.scale.setScalar(base * 0.96);
      else obj.scale.setScalar(base);
    }

    for (const st of sim.state.staff) {
      const key = `staff_${st.id}`;
      live.add(key);
      let obj = entityMeshes.get(key) as THREE.Group | undefined;
      if (!obj || obj.userData.role !== st.role) {
        if (obj) {
          entitiesGroup.remove(obj);
          entityMeshes.delete(key);
        }
        obj = buildStaffMesh(mat, st.role, st.id);
        entitiesGroup.add(obj);
        entityMeshes.set(key, obj);
      }
      ensureLook(obj, "staff", st.role);
      const p = pixelToWorld(st.pixel.x, st.pixel.y, 0);
      obj.position.set(p.x, 0, p.z);
      const repairing = st.role === "mechanic" && st.busyTimer > 0;
      const moving = st.path.length > 0 && st.busyTimer <= 0;
      animateStaff(
        obj,
        st.facing,
        repairing ? animTime * 2.2 : st.walkPhase,
        repairing,
        moving,
      );
    }

    // חניה — מכוניות סטטיות
    for (const p of sim.state.parking) {
      if (!p.occupied) continue;
      const key = `car_${p.id}`;
      live.add(key);
      let obj = entityMeshes.get(key) as THREE.Group | undefined;
      if (!obj || !obj.isGroup) {
        if (obj) {
          entitiesGroup.remove(obj);
          entityMeshes.delete(key);
        }
        obj = buildCarMesh(mat, p.id, p.carColor || "#ef4444");
        entitiesGroup.add(obj);
        entityMeshes.set(key, obj);
      }
      const wpos = gridToWorld(p.pos.x, p.pos.y, 0);
      obj.position.set(wpos.x, 0, wpos.z);
    }

    // שער — motion frames cycle flags; fallback procedural flag wave
    const gateObj = entityMeshes.get("gate_arch");
    if (gateObj) animateGateFlags(gateObj, animTime, dt);

    // Path tile motion — cycle textured path tiles through the 4-frame pack
    if (pathMotionTextures && pathMotionTextures.length >= 1) {
      pathMotionAcc += dt;
      while (pathMotionAcc >= PATH_MOTION_DT) {
        pathMotionAcc -= PATH_MOTION_DT;
        pathMotionFrame = (pathMotionFrame + 1) % pathMotionTextures.length;
      }
      const tex = pathMotionTextures[pathMotionFrame]!;
      if (pathLookTex !== tex) {
        pathLookTex = tex;
        const pathMat = matCache.get("t_path_look");
        if (pathMat) {
          pathMat.map = tex;
          pathMat.needsUpdate = true;
        }
      }
    }

    // נורות שביל בשלב גבוה — הבהוב
    for (const [key, obj] of tileMeshes) {
      if (key.startsWith("lamp_")) animatePathLamp(obj, animTime);
    }

    // מחסן — דלת נפתחת כשרץ ליד המחסן
    const wh = entityMeshes.get("warehouse");
    if (wh && wh.visible) {
      ensureLook(wh as THREE.Group, "prop", "warehouse", undefined, Math.min(5, Math.max(1, Math.floor(sim.state.parkLevel) || 1)));
      const wp = sim.grid.warehousePos;
      const runnerIn =
        sim.state.warehouseBuilt &&
        sim.state.staff.some(
          (st) =>
            st.role === "runner" &&
            Math.abs(st.pos.x - wp.x) + Math.abs(st.pos.y - wp.y) <= 1,
        );
      setWarehouseDoorOpen(wh, runnerIn, animTime);
    }

    // ניקוי ישויות שנעלמו
    for (const [key, obj] of entityMeshes) {
      if (key === "gate_arch" || key === "warehouse") continue;
      if (!live.has(key)) {
        entitiesGroup.remove(obj);
        entityMeshes.delete(key);
      }
    }
  };

  const sync = (sim: Simulation, dt: number) => {
    applyZoneLook(sim.state.parkLevel);
    rebuildTiles(sim);
    syncEntities(sim, dt);
    setDayNight(sim.state.timeOfDay);
    updateCamera();
    renderer.render(scene, camera);
  };

  const setDayNight = (hour: number) => {
    const tier = lastZoneTier < 0 ? 0 : lastZoneTier;
    const daySky = tier === 0 ? "#87b8dc" : tier === 1 ? "#7aafd4" : "#6a9ec8";
    const dayFog = tier === 0 ? "#c5dceb" : tier === 1 ? "#b8d4e8" : "#a8c8dc";
    if (hour >= 18.5) {
      scene.background = new THREE.Color("#0b1220");
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.set("#0b1220");
        scene.fog.density = 0.012;
      }
      hemi.intensity = 0.25;
      sun.intensity = 0.25;
      sun.color.set("#93c5fd");
      rim.intensity = 0.15;
    } else if (hour >= 16) {
      scene.background = new THREE.Color("#c47a3a");
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.set("#c47a3a");
        scene.fog.density = 0.01;
      }
      hemi.intensity = 0.45;
      sun.color.set("#ffb070");
      sun.intensity = 0.85;
      rim.intensity = 0.25;
    } else {
      scene.background = new THREE.Color(daySky);
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.set(dayFog);
        scene.fog.density = tier === 2 ? 0.005 : tier === 1 ? 0.0055 : 0.006;
      }
      hemi.intensity = 0.75;
      sun.intensity = tier === 0 ? 1.55 : tier === 1 ? 1.6 : 1.65;
      sun.color.set(tier >= 2 ? "#fff8e8" : "#fff4dd");
      rim.intensity = 0.4;
    }
  };

  const clientToNdc = (clientX: number, clientY: number) => {
    const rect = renderer.domElement.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 2 - 1,
      y: -((clientY - rect.top) / rect.height) * 2 + 1,
    };
  };

  const screenToGrid = (clientX: number, clientY: number): GridPos => {
    const ndc = clientToNdc(clientX, clientY);
    raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
    if (raycaster.ray.intersectPlane(groundPlane, hit)) {
      return worldToGrid(hit.x, hit.z);
    }
    return { x: 0, y: 0 };
  };

  const setHover = (p: GridPos | null) => {
    ensureHover();
    if (!p || !hoverMesh) {
      if (hoverMesh) hoverMesh.visible = false;
      return;
    }
    const wpos = gridToWorld(p.x, p.y, 0);
    hoverMesh.position.set(wpos.x, 0.22, wpos.z);
    hoverMesh.visible = true;
  };

  const emitZoom = () => {
    for (const fn of zoomListeners) fn(zoom);
  };

  const clampZoom = (z: number) => Math.max(THREE_ZOOM_MIN, Math.min(THREE_ZOOM_MAX, z));

  const zoomFocusHit = new THREE.Vector3();
  const zoomAfterHit = new THREE.Vector3();

  /** Zoom toward the world point under the cursor/fingers (not a fixed spot). */
  const zoomToward = (factor: number, focusClientX?: number, focusClientY?: number) => {
    const prev = zoom;
    const next = clampZoom(prev * factor);
    if (next === prev) return;

    let hasFocus = false;
    if (focusClientX != null && focusClientY != null) {
      const ndc = clientToNdc(focusClientX, focusClientY);
      raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
      hasFocus = !!raycaster.ray.intersectPlane(groundPlane, zoomFocusHit);
    }

    zoom = next;
    updateCamera();

    if (hasFocus && focusClientX != null && focusClientY != null) {
      const ndc = clientToNdc(focusClientX, focusClientY);
      raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
      if (raycaster.ray.intersectPlane(groundPlane, zoomAfterHit)) {
        camTarget.x += zoomFocusHit.x - zoomAfterHit.x;
        camTarget.z += zoomFocusHit.z - zoomAfterHit.z;
        updateCamera();
      }
    }
    emitZoom();
  };

  const onResize = () => {
    const cw = container.clientWidth || 1;
    const ch = container.clientHeight || 1;
    renderer.setSize(cw, ch, false);
    updateCamera();
  };
  window.addEventListener("resize", onResize);

  return {
    renderer,
    scene,
    camera,
    sync,
    setDayNight,
    screenToGrid,
    setHover,
    beginDrag: (x, y, mode = "orbit") => {
      dragging = true;
      dragMode = mode;
      lastMouse = { x, y };
    },
    drag: (x, y) => {
      if (!dragging) return;
      const dx = x - lastMouse.x;
      const dy = y - lastMouse.y;
      lastMouse = { x, y };
      if (dragMode === "orbit") {
        // orbit follows the finger (grab the scene) — same feel as pan
        orbitYaw += dx * 0.0055;
        orbitPitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, orbitPitch - dy * 0.004));
      } else {
        // Grab-the-park pan: world stays under the finger (right and down).
        // forward = toward camera on ground; screen-right = `right`.
        const radius = BASE_RADIUS / zoom;
        const scale = radius * 0.0026;
        const forward = new THREE.Vector3(Math.sin(orbitYaw), 0, Math.cos(orbitYaw));
        const right = new THREE.Vector3(Math.cos(orbitYaw), 0, -Math.sin(orbitYaw));
        camTarget.addScaledVector(right, -dx * scale);
        camTarget.addScaledVector(forward, -dy * scale);
      }
      updateCamera();
    },
    endDrag: () => {
      dragging = false;
    },
    zoomAt: (delta, clientX, clientY) => {
      zoomToward(delta > 0 ? 0.9 : 1.1, clientX, clientY);
    },
    zoomBy: (factor, clientX, clientY) => {
      zoomToward(factor, clientX, clientY);
    },
    getZoom: () => zoom,
    onZoomChange: (fn) => {
      zoomListeners.add(fn);
      return () => zoomListeners.delete(fn);
    },
    beginPinch: (dist) => {
      pinchDist = dist;
    },
    pinch: (dist, midClientX, midClientY) => {
      if (pinchDist <= 0) {
        pinchDist = dist;
        return;
      }
      const factor = dist / pinchDist;
      pinchDist = dist;
      zoomToward(factor, midClientX, midClientY);
    },
    endPinch: () => {
      pinchDist = 0;
    },
    nudge: (forwardAmt, rightAmt) => {
      // Positive forward = into the park (away from camera). `forward` vec points toward camera.
      const towardCamera = new THREE.Vector3(Math.sin(orbitYaw), 0, Math.cos(orbitYaw));
      const right = new THREE.Vector3(Math.cos(orbitYaw), 0, -Math.sin(orbitYaw));
      const step = (BASE_RADIUS / zoom) * 0.04;
      camTarget.addScaledVector(towardCamera, -forwardAmt * step);
      camTarget.addScaledVector(right, rightAmt * step);
      updateCamera();
    },
    dispose: () => {
      window.removeEventListener("resize", onResize);
      for (const m of matCache.values()) m.dispose();
      geoCache.tile.dispose();
      geoCache.cloudTile.dispose();
      geoCache.cloudPuff.dispose();
      geoCache.box.dispose();
      geoCache.capsule.dispose();
      geoCache.plane.dispose();
      visitorTex?.dispose();
      meadowMat.map?.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) container.removeChild(renderer.domElement);
    },
  };
}
