/**
 * Three.js isometric park — full WebGL path (owner chose option ג).
 * ThreeGameView is the live primary renderer; Canvas 2D remains as fallback toggle.
 */
export { mountThreePark, type ThreeParkHandle, THREE_ZOOM_MIN, THREE_ZOOM_MAX } from "./ThreeParkWorld";
export { gridToWorld, worldToGrid, pixelToWorld, ISO_TILE } from "./isoMath";
export { buildAttractionMesh, buildStallMesh, animateAttraction } from "./RideMeshes";

export const THREE_MIGRATION = {
  status: "live-primary" as const,
  target: "isometric-three-js",
  noteHe:
    "מעבר מלא ל־Three.js איזומטרי פעיל כברירת מחדל. מתקנים לפי shape (גלגל/קרוסלה/רכבת/מגדל וכו׳) + דוכנים עשירים. Canvas 2D כ־fallback.",
};
