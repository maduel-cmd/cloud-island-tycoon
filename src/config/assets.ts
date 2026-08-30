/** רישום נכסים ואנימציות — טעינה מודולרית לבנק התוספות (לא פרלוד לפארק) */

export interface GameAsset {
  id: string;
  name: string;
  type: "video_animation" | "sprite_image";
  src: string;
  loop?: boolean;
}

export const GAME_ANIMATIONS: Record<string, GameAsset> = {
  // אנימציה 1: עובד ניקיון ואשפה
  JANITOR_CLEANING: {
    id: "anim_janitor_cleaning",
    name: "Janitor Walking & Sweeping Trash",
    type: "video_animation",
    // מקור חיצוני מהקונספט; כשאין קובץ מקומי — AnimatedStaff לא מציג
    src: "http://googleusercontent.com/generated_video_content/13103824751900569372",
    loop: true,
  },
  // אנימציה 2: טכנאי צועד (הכנה לקובץ הבא)
  MECHANIC_WALKING: {
    id: "anim_mechanic_walking",
    name: "Mechanic Walking to Broken Ride",
    type: "video_animation",
    src: "", // יוזן עם יצירת הסרטון הבא
    loop: true,
  },
  // אנימציה 3: טכנאי מתקן מתקן
  MECHANIC_REPAIRING: {
    id: "anim_mechanic_repairing",
    name: "Mechanic Repairing Attraction",
    type: "video_animation",
    src: "", // יוזן עם יצירת הסרטון הבא
    loop: true,
  },
};

export const GAME_STATIC_ASSETS: Record<string, GameAsset> = {
  PARK_MAP_ISOMETRIC: {
    id: "map_floating_island",
    name: "Floating Island Base Map",
    type: "sprite_image",
    /** קונספט פארק מלא — לבנק/תצוגה; לא נטען אוטומטית כמפת משחק */
    src: "/assets/park-map-isometric.jpg",
  },
  BALLOON_VENDOR_TILE: {
    id: "tile_balloon_vendor",
    name: "Balloon Vendor Stand",
    type: "sprite_image",
    /** אריח איזומטרי לדוכן בלונים — מוצג כשמציבים מהבנק */
    src: "/assets/balloon-vendor-tile.jpg",
  },
  VISITOR_SHEET: {
    id: "sheet_park_visitors",
    name: "Park Visitors Sprite Sheet",
    type: "sprite_image",
    /** גליון 12×4 מבקרים — רינדור runtime בלבד (לא על מגרש ריק) */
    src: "/assets/visitors/visitor-sheet.png",
  },
};

export function getAnimationAsset(key: keyof typeof GAME_ANIMATIONS): GameAsset {
  return GAME_ANIMATIONS[key]!;
}

export function getStaticAsset(key: keyof typeof GAME_STATIC_ASSETS): GameAsset {
  return GAME_STATIC_ASSETS[key]!;
}

/** נכס מוכן לשימוש (יש src תקין שניתן לטעון בדפדפן) */
export function isAssetReady(asset: GameAsset): boolean {
  const src = asset.src?.trim() ?? "";
  if (!src) return false;
  // כתובות placeholder מ־Gemini/usercontent לא נטענות במשחק
  if (src.includes("googleusercontent.com/generated_")) return false;
  return true;
}
