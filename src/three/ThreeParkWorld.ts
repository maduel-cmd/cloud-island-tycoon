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
  buildAttractionMesh,
  buildStallMesh,
} from "./RideMeshes";
import { createCirrusSkyTexture } from "./cirrusSky";

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
  zoomBy: (factor: number) => void;
  getZoom: () => number;
  onZoomChange: (fn: (z: number) => void) => () => void;
  /** Two-finger gesture start — distance for zoom, angle (rad) for park rotate */
  beginPinch: (dist: number, angle: number) => void;
  /** Two-finger move — pinch zooms; twist rotates the park camera around the target */
  pinch: (dist: number, angle: number) => void;
  endPinch: () => void;
  setHover: (p: GridPos | null) => void;
  /** הזזת מטרה יחסית (WASD) בכיוון המצלמה */
  nudge: (forward: number, right: number) => void;
  /**
   * Finger wind (legacy): ground mist removed — cirrus is sky-only.
   * Always returns false.
   */
  blowCloudsAt: (clientX: number, clientY: number) => boolean;
};

const TILE_COLORS: Record<string, number> = {
  /** Lush buildable meadow — matches concept-ref green island */
  grass: 0x58b83a,
  /** Light paved walkways (not brown dirt) */
  path: 0xd8dde3,
  parking: 0x6b7280,
  road: 0x5a616c,
  /** Locked / unopened plateau — still green, never white fog on grass */
  cloud: 0x4a9e32,
  locked: 0x3f8a2c,
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
  scene.background = new THREE.Color("#6eb0dc");
  scene.fog = new THREE.FogExp2("#9ec8e0", 0.006);

  /** זום = קרבה; רדיוס orbit בסיסי / zoom */
  const BASE_RADIUS = 28;
  let zoom = 1.05;
  /** orbit כמו WoW — yaw/pitch סביב מטרה */
  let orbitYaw = Math.PI / 4;
  let orbitPitch = 0.88;
  const PITCH_MIN = 0.35;
  const PITCH_MAX = 1.25;

  const aspect = () => Math.max(0.1, (container.clientWidth || w) / Math.max(1, container.clientHeight || h));

  const camera = new THREE.PerspectiveCamera(48, aspect(), 0.2, 420);
  const camTarget = new THREE.Vector3(0, 0.4, 0);
  let mapBounds = gridWorldBounds(40, 32);

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
  renderer.shadowMap.enabled = false;
  // Shadows off: first place of a ride was stalling the main thread (~10s) with GPU sync;
  // game clock shares the main thread so it must keep ticking.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.touchAction = "none";
  container.appendChild(renderer.domElement);

  // תאורת starting-zone: שמש חמה + מילוי קריר (סגנון RPG חיצוני)
  const hemi = new THREE.HemisphereLight(0xb8d4ef, 0x3d5a28, 0.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2b0, 1.35);
  sun.position.set(28, 42, 18);
  sun.castShadow = false;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xfff5e6, 0.28));
  const rim = new THREE.DirectionalLight(0x88aacc, 0.35);
  rim.position.set(-20, 12, -15);
  scene.add(rim);

  // שורשי קבוצות
  const root = new THREE.Group();
  scene.add(root);
  const tilesGroup = new THREE.Group();
  /** Kept for API/dispose compatibility — no ground cloud sprites */
  const fogCloudsGroup = new THREE.Group();
  const parkMistGroup = new THREE.Group();
  const entitiesGroup = new THREE.Group();
  const fxGroup = new THREE.Group();
  const sceneryGroup = new THREE.Group();
  root.add(tilesGroup, fogCloudsGroup, parkMistGroup, entitiesGroup, fxGroup, sceneryGroup);

  const cliffMat = new THREE.MeshStandardMaterial({
    color: 0x6e6558,
    roughness: 0.95,
    flatShading: true,
  });
  const meadowMat = new THREE.MeshStandardMaterial({
    color: 0x3f6e2c,
    roughness: 0.95,
    flatShading: true,
  });
  const lakeMat = new THREE.MeshStandardMaterial({
    color: 0x3a8fc4,
    roughness: 0.35,
    metalness: 0.15,
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
      tex.repeat.set(14, 14);
      tex.magFilter = THREE.LinearFilter;
      meadowMat.map = tex;
      meadowMat.needsUpdate = true;
    }
  }

  /**
   * Flat world plate under the whole grid — not a round island.
   * Sized from map bounds so buildable tiles sit on continuous land.
   */
  const fitFlatWorld = () => {
    const spanX = Math.max(24, mapBounds.maxX - mapBounds.minX + 8);
    const spanZ = Math.max(24, mapBounds.maxZ - mapBounds.minZ + 8);
    meadow.scale.set(spanX / 40, 1, spanZ / 40);
    meadow.position.set(mapBounds.centerX, -0.12, mapBounds.centerZ);
  };

  const meadow = new THREE.Mesh(new THREE.BoxGeometry(40, 0.28, 40), meadowMat);
  meadow.receiveShadow = true;
  sceneryGroup.add(meadow);
  fitFlatWorld();

  // Lakes outside / at the rim — decorative only, do not eat buildable tiles
  const lakeSpots = [
    { x: 1.08, z: 0.15, sx: 5.5, sz: 3.2 },
    { x: -0.95, z: 0.85, sx: 4.2, sz: 2.8 },
    { x: 0.2, z: -1.05, sx: 6.0, sz: 3.5 },
  ];
  for (const spot of lakeSpots) {
    const lake = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.08, 20), lakeMat);
    lake.scale.set(spot.sx, 1, spot.sz);
    lake.position.set(
      mapBounds.centerX + spot.x * ((mapBounds.maxX - mapBounds.minX) * 0.55),
      -0.02,
      mapBounds.centerZ + spot.z * ((mapBounds.maxZ - mapBounds.minZ) * 0.55),
    );
    sceneryGroup.add(lake);
  }

  // Distant mountains on the horizon (outside the playable plate)
  const farMat = new THREE.MeshStandardMaterial({ color: 0x6a8499, roughness: 1, flatShading: true });
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(5 + (i % 4), 7 + (i % 5), 5), farMat);
    const ang = (i / 10) * Math.PI * 2 + 0.3;
    const dist = 58 + (i % 3) * 6;
    m.position.set(
      mapBounds.centerX + Math.cos(ang) * dist,
      1.2 + (i % 3) * 0.6,
      mapBounds.centerZ + Math.sin(ang) * dist,
    );
    sceneryGroup.add(m);
  }

  // Edge rocks / hills outside grid center — keep playable interior open
  for (let i = 0; i < 12; i++) {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.55 + (i % 4) * 0.18, 0),
      cliffMat,
    );
    const ang = (i / 12) * Math.PI * 2 + 0.4;
    const dist = 22 + (i % 4) * 2.5;
    rock.position.set(
      mapBounds.centerX + Math.cos(ang) * dist,
      0.2,
      mapBounds.centerZ + Math.sin(ang) * dist,
    );
    rock.rotation.set(0.15 * i, 0.35 * i, 0.08);
    sceneryGroup.add(rock);
  }

  // Tree line near the outer rim only
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 0.9, flatShading: true });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6b28, roughness: 0.85, flatShading: true });
  for (let i = 0; i < 14; i++) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.9, 5), trunkMat);
    trunk.position.y = 0.45;
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.55 + (i % 3) * 0.1, 1.1, 6), leafMat);
    canopy.position.y = 1.25;
    tree.add(trunk, canopy);
    const ang = (i / 14) * Math.PI * 2 + 0.2;
    const dist = 20 + (i % 3) * 1.8;
    tree.position.set(
      mapBounds.centerX + Math.cos(ang) * dist,
      0,
      mapBounds.centerZ + Math.sin(ang) * dist,
    );
    sceneryGroup.add(tree);
  }

  // High sky cirrus — matches feather-cloud reference; never on the ground
  const cirrusCanvas = createCirrusSkyTexture();
  const cirrusTex = new THREE.CanvasTexture(cirrusCanvas);
  cirrusTex.colorSpace = THREE.SRGBColorSpace;
  cirrusTex.wrapS = cirrusTex.wrapT = THREE.RepeatWrapping;
  cirrusTex.needsUpdate = true;
  const cirrusSkyMat = new THREE.MeshBasicMaterial({
    map: cirrusTex,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const skyGroup = new THREE.Group();
  scene.add(skyGroup);
  const skySheets: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(140, 55), cirrusSkyMat.clone());
    const ang = (i / 3) * Math.PI * 2 + 0.4;
    sheet.position.set(Math.cos(ang) * 18, 38 + i * 4, Math.sin(ang) * 18);
    sheet.rotation.x = -Math.PI / 2.35;
    sheet.rotation.z = ang * 0.35 + i * 0.4;
    skyGroup.add(sheet);
    skySheets.push(sheet);
  }
  // Soft overhead veil
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), cirrusSkyMat.clone());
  veil.position.set(0, 52, 0);
  veil.rotation.x = -Math.PI / 2;
  (veil.material as THREE.MeshBasicMaterial).opacity = 0.45;
  skyGroup.add(veil);
  skySheets.push(veil);

  const tileMeshes = new Map<string, THREE.Mesh>();
  const entityMeshes = new Map<string, THREE.Object3D>();
  let hoverMesh: THREE.Mesh | null = null;
  let lastTileSig = "";
  let visitorTex: THREE.Texture | null = null;
  const visitorMats = new Map<number, THREE.MeshBasicMaterial>();
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

  const visitorMatFor = (archetype: number): THREE.MeshBasicMaterial | null => {
    if (!visitorTex) return null;
    const { cols, cellW, cellH, archetypeCount, rows } = VISITOR_SHEET;
    const idx = ((archetype % archetypeCount) + archetypeCount) % archetypeCount;
    let m = visitorMats.get(idx);
    if (m) return m;
    const map = visitorTex.clone();
    map.colorSpace = THREE.SRGBColorSpace;
    const imgW = cellW * cols;
    const imgH = cellH * rows;
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    map.repeat.set(cellW / imgW, cellH / imgH);
    map.offset.set(col * (cellW / imgW), 1 - (row + 1) * (cellH / imgH));
    m = new THREE.MeshBasicMaterial({
      map,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    visitorMats.set(idx, m);
    return m;
  };

  const geoCache = {
    /** Edge-to-edge ground tiles — no gaps between neighbors */
    tile: new THREE.BoxGeometry(ISO_TILE, 0.16, ISO_TILE),
    cloudTile: new THREE.BoxGeometry(ISO_TILE * 1.05, 0.2, ISO_TILE * 1.05),
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

  /** Painted ground / cliff textures from public/assets/tiles */
  let grassMap: THREE.Texture | null = null;
  let pathMap: THREE.Texture | null = null;
  let cloudEdgeMap: THREE.Texture | null = null;
  const groundMatCache = new Map<string, THREE.MeshStandardMaterial>();

  const prepTileTex = (t: THREE.Texture) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
  };

  const groundMat = (kind: "grass" | "path" | "cloudEdge", fallback: number) => {
    const map =
      kind === "grass" ? grassMap : kind === "path" ? pathMap : cloudEdgeMap;
    const cacheKey = map ? `${kind}_tex` : `${kind}_solid_${fallback}`;
    let m = groundMatCache.get(cacheKey);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color: map ? 0xffffff : fallback,
        map: map ?? undefined,
        roughness: 0.92,
        metalness: 0.02,
        flatShading: !map,
        transparent: kind === "cloudEdge",
        opacity: kind === "cloudEdge" ? 0.98 : 1,
      });
      groundMatCache.set(cacheKey, m);
    } else if (map && m.map !== map) {
      m.map = map;
      m.color.set(0xffffff);
      m.needsUpdate = true;
    }
    return m;
  };

  {
    const grassSrc = GAME_STATIC_ASSETS.TILE_GRASS?.src;
    const pathSrc = GAME_STATIC_ASSETS.TILE_PATH?.src;
    const cloudSrc = GAME_STATIC_ASSETS.TILE_CLOUD_EDGE?.src;
    if (grassSrc) {
      texLoader.load(grassSrc, (t) => {
        prepTileTex(t);
        grassMap = t;
        lastTileSig = "";
      });
    }
    if (pathSrc) {
      texLoader.load(pathSrc, (t) => {
        prepTileTex(t);
        pathMap = t;
        lastTileSig = "";
      });
    }
    if (cloudSrc) {
      texLoader.load(cloudSrc, (t) => {
        prepTileTex(t);
        cloudEdgeMap = t;
        lastTileSig = "";
      });
    }
  }

  let mistSeeded = false;

  /** Ground mist removed — cirrus lives in the sky only. */
  const seedParkMist = (_sim: Simulation) => {
    if (mistSeeded) return;
    mistSeeded = true;
    while (parkMistGroup.children.length > 0) {
      parkMistGroup.remove(parkMistGroup.children[0]!);
    }
  };

  const tickParkMist = (_dt: number) => {
    /* no ground mist */
  };

  const zoomListeners = new Set<(z: number) => void>();
  let dragging = false;
  let dragMode: DragMode = "orbit";
  let lastMouse = { x: 0, y: 0 };
  let pinchDist = 0;
  let pinchAngle = 0;
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();

  const centerOnGate = (sim: Simulation) => {
    mapBounds = gridWorldBounds(sim.grid.width, sim.grid.height);
    fitFlatWorld();
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

  /** התפתחות כמו zones: שמים/ערפל/אחו משתנים עם רמת הפארק */
  const applyZoneLook = (parkLevel: number) => {
    const tier = parkLevel <= 1 ? 0 : parkLevel <= 3 ? 1 : 2;
    if (tier === lastZoneTier) return;
    lastZoneTier = tier;
    if (tier === 0) {
      TILE_COLORS.grass = 0x58b83a;
      TILE_COLORS.cloud = 0x4a9e32;
      TILE_COLORS.locked = 0x3f8a2c;
      meadowMat.color.set(0x58b83a);
      scene.background = new THREE.Color("#6eb0dc");
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.set("#9ec8e0");
        scene.fog.density = 0.006;
      }
      farMat.color.set(0x6a8499);
      hemi.color.set(0xb8d4ef);
      sun.color.set(0xffe8c0);
      sun.intensity = 1.35;
    } else if (tier === 1) {
      TILE_COLORS.grass = 0x4aad36;
      TILE_COLORS.cloud = 0x3f9430;
      TILE_COLORS.locked = 0x368028;
      meadowMat.color.set(0x4aad36);
      scene.background = new THREE.Color("#5aa0cb");
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.set("#90bcd8");
        scene.fog.density = 0.0055;
      }
      farMat.color.set(0x5a7088);
      hemi.color.set(0xc8d8ef);
      sun.intensity = 1.45;
    } else {
      TILE_COLORS.grass = 0x3f9a40;
      TILE_COLORS.cloud = 0x358636;
      TILE_COLORS.locked = 0x2e7230;
      meadowMat.color.set(0x3f9a40);
      scene.background = new THREE.Color("#4a90c0");
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.set("#80b0d0");
        scene.fog.density = 0.005;
      }
      farMat.color.set(0x4a5a78);
      hemi.color.set(0xd0d8f0);
      sun.color.set(0xfff0c8);
      sun.intensity = 1.55;
    }
    lastTileSig = ""; // force tile rebuild with new grass
    lastDayBand = -1;
  };

  /** One thin tile marker under the cursor — no filled gold glow */
  const ensureHover = () => {
    if (hoverMesh) return;
    const edge = ISO_TILE * 0.96;
    const g = new THREE.BoxGeometry(edge, 0.04, edge);
    hoverMesh = new THREE.Mesh(
      g,
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    hoverMesh.position.y = 0.18;
    hoverMesh.visible = false;
    fxGroup.add(hoverMesh);
  };

  let selectFrame: THREE.LineSegments | null = null;
  const ensureSelectFrame = () => {
    if (selectFrame) return;
    const e = ISO_TILE * 0.5;
    const pts = new Float32Array([
      -e, 0, -e, e, 0, -e, e, 0, -e, e, 0, e, e, 0, e, -e, 0, e, -e, 0, e, -e, 0, -e,
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    selectFrame = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: 0xe8c547, transparent: true, opacity: 0.95 }),
    );
    selectFrame.visible = false;
    fxGroup.add(selectFrame);
  };

  const rebuildTiles = (sim: Simulation) => {
    const g = sim.grid;
    let sig = `${g.width}x${g.height}|`;
    for (let y = 0; y < g.height; y++) {
      for (let x = 0; x < g.width; x++) {
        sig += g.get(x, y)[0];
      }
    }
    sig += `|p${g.plots.filter((p) => p.unlocked).length}|w${sim.state.warehouseBuilt ? 1 : 0}`;
    if (sig === lastTileSig) return;
    lastTileSig = sig;

    mapBounds = gridWorldBounds(g.width, g.height);
    fitFlatWorld();

    for (const m of tileMeshes.values()) {
      tilesGroup.remove(m);
    }
    tileMeshes.clear();
    while (fogCloudsGroup.children.length > 0) {
      fogCloudsGroup.remove(fogCloudsGroup.children[0]!);
    }

    for (let y = 0; y < g.height; y++) {
      for (let x = 0; x < g.width; x++) {
        const kind = g.get(x, y);
        const p = gridToWorld(x, y, 0);

        if (kind === "void") {
          continue;
        }

        // Buildable meadow stays textured grass/path; locked/cloud stay green grass (not white)
        const isPath = kind === "path" || kind === "parking" || kind === "road";
        const fallback = isPath
          ? (TILE_COLORS[kind] ?? TILE_COLORS.path ?? 0xd8dde3)
          : (TILE_COLORS[kind] ?? TILE_COLORS.grass ?? 0x58b83a);
        const meshMat = isPath ? groundMat("path", fallback) : groundMat("grass", fallback);
        const raised = isPath;
        const mesh = new THREE.Mesh(geoCache.tile, meshMat);
        mesh.position.set(p.x, raised ? 0.12 : 0.05, p.z);
        mesh.receiveShadow = true;
        mesh.userData = { gx: x, gy: y, kind };
        tilesGroup.add(mesh);
        tileMeshes.set(`${x},${y}`, mesh);
      }
    }

    // שער פנטזיה — אבן + זהב (starting-zone portal), לא פלסטיק כחול
    const gate = g.gatePos;
    const gp = gridToWorld(gate.x, gate.y, 0);
    const gateKey = "gate_arch";
    let gateObj = entityMeshes.get(gateKey) as THREE.Group | undefined;
    if (!gateObj) {
      gateObj = new THREE.Group();
      const stone = mat("gate_stone", 0x6a6358, { roughness: 0.95, metalness: 0.05 });
      const gold = mat("gate_gold", 0xc9a227, { roughness: 0.45, metalness: 0.4 });
      const wood = mat("gate_wood", 0x4a3420, { roughness: 0.9 });
      const banner = mat("gate_banner", 0x6b1e1e, { roughness: 0.85 });

      const baseL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.55), stone);
      const baseR = baseL.clone();
      baseL.position.set(-0.7, 0.18, 0);
      baseR.position.set(0.7, 0.18, 0);

      const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 2.1, 0.38), stone);
      const p2 = p1.clone();
      p1.position.set(-0.7, 1.2, 0);
      p2.position.set(0.7, 1.2, 0);

      const capL = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.45, 4), gold);
      const capR = capL.clone();
      capL.position.set(-0.7, 2.45, 0);
      capR.position.set(0.7, 2.45, 0);
      capL.rotation.y = Math.PI / 4;
      capR.rotation.y = Math.PI / 4;

      const beam = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.32, 0.4), wood);
      beam.position.set(0, 2.05, 0);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.42), gold);
      trim.position.set(0, 2.22, 0);

      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.12), gold);
      crest.position.set(0, 2.55, 0.08);

      const banL = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.85), banner);
      const banR = banL.clone();
      banL.position.set(-1.05, 1.5, 0.05);
      banR.position.set(1.05, 1.5, 0.05);

      const step = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.7), stone);
      step.position.set(0, 0.06, 0.35);

      gateObj.add(baseL, baseR, p1, p2, capL, capR, beam, trim, crest, banL, banR, step);
      gateObj.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });
      entitiesGroup.add(gateObj);
      entityMeshes.set(gateKey, gateObj);
    }
    gateObj.position.set(gp.x, 0.15, gp.z);
    gateObj.scale.setScalar(1.45);

    // מחסן
    const whKey = "warehouse";
    if (sim.state.warehouseBuilt) {
      let wh = entityMeshes.get(whKey) as THREE.Mesh | undefined;
      if (!wh) {
        wh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 1.4), mat("wh", 0x78716c));
        wh.castShadow = true;
        entitiesGroup.add(wh);
        entityMeshes.set(whKey, wh);
      }
      const wp = gridToWorld(g.warehousePos.x, g.warehousePos.y, 0);
      wh.position.set(wp.x, 0.7, wp.z);
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
      if (!obj || obj.userData.defId !== s.defId) {
        if (obj) {
          entitiesGroup.remove(obj);
          entityMeshes.delete(key);
        }
        if (!def) continue;
        obj = buildStallMesh(def, mat);
        obj.userData.defId = s.defId;
        entitiesGroup.add(obj);
        entityMeshes.set(key, obj);
      }
      const p = gridToWorld(s.pos.x, s.pos.y, 0);
      obj!.position.set(p.x, 0.12, p.z);
    }

    for (const k of sim.grid.bins) {
      const key = `bin_${k}`;
      live.add(key);
      let obj = entityMeshes.get(key) as THREE.Mesh | undefined;
      if (!obj) {
        obj = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.4, 8), mat("bin", 0x16a34a));
        obj.castShadow = true;
        entitiesGroup.add(obj);
        entityMeshes.set(key, obj);
      }
      const [x, y] = k.split(",").map(Number);
      const p = gridToWorld(x!, y!, 0);
      obj.position.set(p.x, 0.35, p.z);
    }

    for (const k of sim.grid.benches) {
      const key = `bench_${k}`;
      live.add(key);
      let obj = entityMeshes.get(key) as THREE.Mesh | undefined;
      if (!obj) {
        obj = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.28), mat("bench", 0x92400e));
        entitiesGroup.add(obj);
        entityMeshes.set(key, obj);
      }
      const [x, y] = k.split(",").map(Number);
      const p = gridToWorld(x!, y!, 0);
      obj.position.set(p.x, 0.28, p.z);
    }

    for (const [k, kind] of sim.grid.decor) {
      const key = `decor_${k}`;
      live.add(key);
      let obj = entityMeshes.get(key) as THREE.Object3D | undefined;
      if (!obj) {
        if (kind === "tree" || kind === "bush") {
          const g = new THREE.Group();
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.4, 6), mat("trunk", 0x78350f));
          trunk.position.y = 0.3;
          const leaf = new THREE.Mesh(
            new THREE.SphereGeometry(kind === "tree" ? 0.35 : 0.22, 8, 8),
            mat("leaf", kind === "tree" ? 0x15803d : 0x22c55e),
          );
          leaf.position.y = kind === "tree" ? 0.7 : 0.45;
          g.add(trunk, leaf);
          obj = g;
        } else if (kind === "statue") {
          obj = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.9, 5), mat("statue", 0xcbd5e1));
          (obj as THREE.Mesh).position.y = 0.5;
        } else {
          obj = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), mat("flower", 0xec4899));
          (obj as THREE.Mesh).position.y = 0.25;
        }
        entitiesGroup.add(obj);
        entityMeshes.set(key, obj);
      }
      const [x, y] = k.split(",").map(Number);
      const p = gridToWorld(x!, y!, 0);
      obj.position.x = p.x;
      obj.position.z = p.z;
      if (!("children" in obj) || (obj as THREE.Group).children.length === 0) {
        // mesh already has y
      } else {
        obj.position.y = 0;
      }
    }

    for (const t of sim.state.trash) {
      const key = `trash_${t.id}`;
      live.add(key);
      let obj = entityMeshes.get(key) as THREE.Mesh | undefined;
      if (!obj) {
        obj = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.25), mat("trash", 0x78716c));
        entitiesGroup.add(obj);
        entityMeshes.set(key, obj);
      }
      const p = gridToWorld(t.pos.x, t.pos.y, 0);
      obj.position.set(p.x, 0.22, p.z);
      obj.scale.setScalar(0.8 + t.amount * 0.15);
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
        const sheetMat = visitorMatFor(v.archetype);
        if (sheetMat) {
          obj = new THREE.Mesh(geoCache.plane, sheetMat);
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
      let obj = entityMeshes.get(key) as THREE.Mesh | undefined;
      const colors = { janitor: 0x2563eb, runner: 0xea580c, mechanic: 0x7c3aed };
      if (!obj) {
        obj = new THREE.Mesh(geoCache.capsule, mat(`st_${st.role}`, colors[st.role]));
        obj.castShadow = true;
        entitiesGroup.add(obj);
        entityMeshes.set(key, obj);
      }
      const p = pixelToWorld(st.pixel.x, st.pixel.y, 0);
      obj.position.set(p.x, 0.5, p.z);
    }

    // חניה — מכוניות
    for (const p of sim.state.parking) {
      if (!p.occupied) continue;
      const key = `car_${p.id}`;
      live.add(key);
      let obj = entityMeshes.get(key) as THREE.Mesh | undefined;
      if (!obj) {
        obj = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.35), mat(`car_${p.id}`, hexToNum(p.carColor || "#ef4444")));
        entitiesGroup.add(obj);
        entityMeshes.set(key, obj);
      }
      const wpos = gridToWorld(p.pos.x, p.pos.y, 0);
      obj.position.set(wpos.x, 0.3, wpos.z);
    }

    // ניקוי ישויות שנעלמו
    for (const [key, obj] of entityMeshes) {
      if (key === "gate_arch" || key === "warehouse") continue;
      if (!live.has(key)) {
        entitiesGroup.remove(obj);
        entityMeshes.delete(key);
      }
    }

    // Thin selection frame on the selected attraction / stall (no glow)
    ensureSelectFrame();
    if (selectFrame) {
      const sel = sim.state.selectedEntity;
      let target: THREE.Object3D | undefined;
      let half = ISO_TILE * 0.55;
      if (sel?.kind === "attraction") {
        const a = sim.state.attractions.find((x) => x.uid === sel.id);
        if (a) {
          target = entityMeshes.get(`attr_${a.uid}`);
          const def = getAttraction(a.defId);
          half = (Math.max(def?.footprint.w ?? 1, def?.footprint.h ?? 1) * ISO_TILE) / 2 + 0.08;
        }
      } else if (sel?.kind === "stall") {
        const s = sim.state.stalls.find((x) => x.uid === sel.id);
        if (s) target = entityMeshes.get(`stall_${s.uid}`);
      }
      if (target) {
        const pos = selectFrame.geometry.getAttribute("position") as THREE.BufferAttribute;
        pos.array.set([
          -half, 0, -half, half, 0, -half,
          half, 0, -half, half, 0, half,
          half, 0, half, -half, 0, half,
          -half, 0, half, -half, 0, -half,
        ]);
        pos.needsUpdate = true;
        selectFrame.position.set(target.position.x, 0.2, target.position.z);
        selectFrame.visible = true;
      } else {
        selectFrame.visible = false;
      }
    }
  };

  const sync = (sim: Simulation, dt: number) => {
    applyZoneLook(sim.state.parkLevel);
    rebuildTiles(sim);
    seedParkMist(sim);
    tickParkMist(dt);
    syncEntities(sim, dt);
    setDayNight(sim.state.timeOfDay);
    updateCamera();
    renderer.render(scene, camera);
  };

  let lastDayBand = -1;
  const setDayNight = (hour: number) => {
    const band = hour >= 18.5 ? 2 : hour >= 16 ? 1 : 0;
    if (band === lastDayBand) return;
    lastDayBand = band;
    const tier = lastZoneTier < 0 ? 0 : lastZoneTier;
    const daySky = tier === 0 ? "#6eb0dc" : tier === 1 ? "#5aa0cb" : "#4a90c0";
    const dayFog = tier === 0 ? "#9ec8e0" : tier === 1 ? "#90bcd8" : "#80b0d0";
    if (band === 2) {
      scene.background = new THREE.Color("#0b1220");
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.set("#0b1220");
        scene.fog.density = 0.014;
      }
      hemi.intensity = 0.25;
      sun.intensity = 0.25;
      sun.color.set("#93c5fd");
      rim.intensity = 0.15;
      skyGroup.visible = false;
    } else if (band === 1) {
      scene.background = new THREE.Color("#c47a3a");
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.set("#c47a3a");
        scene.fog.density = 0.01;
      }
      hemi.intensity = 0.45;
      sun.color.set("#ffb070");
      sun.intensity = 0.85;
      rim.intensity = 0.25;
      skyGroup.visible = true;
    } else {
      scene.background = new THREE.Color(daySky);
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.set(dayFog);
        scene.fog.density = tier === 2 ? 0.005 : tier === 1 ? 0.0055 : 0.006;
      }
      hemi.intensity = 0.55;
      sun.intensity = tier === 0 ? 1.35 : tier === 1 ? 1.45 : 1.55;
      sun.color.set(tier >= 2 ? "#fff0c8" : "#ffe2b0");
      rim.intensity = 0.35;
      skyGroup.visible = true;
    }
  };

  const clientToNdc = (clientX: number, clientY: number) => {
    const rect = renderer.domElement.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 2 - 1,
      y: -((clientY - rect.top) / rect.height) * 2 + 1,
    };
  };

  const blowCloudsAt = (_clientX: number, _clientY: number): boolean => {
    // Ground mist removed; cirrus is sky-only and not finger-scatterable.
    return false;
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
    blowCloudsAt,
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
        orbitYaw -= dx * 0.0055;
        orbitPitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, orbitPitch + dy * 0.004));
      } else {
        // One-finger pan: finger moves right → view follows right (not inverted)
        const radius = BASE_RADIUS / zoom;
        const scale = radius * 0.0026;
        const forward = new THREE.Vector3(Math.sin(orbitYaw), 0, Math.cos(orbitYaw));
        const right = new THREE.Vector3(Math.cos(orbitYaw), 0, -Math.sin(orbitYaw));
        camTarget.addScaledVector(right, dx * scale);
        camTarget.addScaledVector(forward, -dy * scale);
      }
      updateCamera();
    },
    endDrag: () => {
      dragging = false;
    },
    zoomAt: (delta) => {
      zoom = clampZoom(zoom * (delta > 0 ? 0.9 : 1.1));
      updateCamera();
      emitZoom();
    },
    zoomBy: (factor) => {
      zoom = clampZoom(zoom * factor);
      updateCamera();
      emitZoom();
    },
    getZoom: () => zoom,
    onZoomChange: (fn) => {
      zoomListeners.add(fn);
      return () => zoomListeners.delete(fn);
    },
    beginPinch: (dist, angle) => {
      pinchDist = dist;
      pinchAngle = angle;
    },
    pinch: (dist, angle) => {
      if (pinchDist <= 0) {
        pinchDist = dist;
        pinchAngle = angle;
        return;
      }
      // Pinch distance → zoom (unchanged)
      zoom = clampZoom(zoom * (dist / pinchDist));
      pinchDist = dist;
      // Two-finger twist → rotate park camera (HUD chrome stays fixed)
      let dAng = angle - pinchAngle;
      while (dAng > Math.PI) dAng -= Math.PI * 2;
      while (dAng < -Math.PI) dAng += Math.PI * 2;
      orbitYaw -= dAng;
      pinchAngle = angle;
      updateCamera();
      emitZoom();
    },
    endPinch: () => {
      pinchDist = 0;
      pinchAngle = 0;
    },
    nudge: (forwardAmt, rightAmt) => {
      const forward = new THREE.Vector3(Math.sin(orbitYaw), 0, Math.cos(orbitYaw));
      const right = new THREE.Vector3(Math.cos(orbitYaw), 0, -Math.sin(orbitYaw));
      const step = (BASE_RADIUS / zoom) * 0.04;
      camTarget.addScaledVector(forward, forwardAmt * step);
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
      cirrusTex.dispose();
      for (const sheet of skySheets) {
        sheet.geometry.dispose();
        const mat = sheet.material;
        if (mat instanceof THREE.Material) mat.dispose();
      }
      renderer.dispose();
      if (renderer.domElement.parentElement === container) container.removeChild(renderer.domElement);
    },
  };
}
