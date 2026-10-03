/**
 * Nano Banana high-tier stills → live park entity looks.
 */
import type { LookKind } from "./parkLooks";

/** Entity ids that must stay on written/procedural look (no still yet / wrong still). */
export const LOOK_SKIP_IDS: ReadonlySet<string> = new Set([
  // empty — gate + inverted coaster replacements are live
]);

/**
 * Motion-frame packs under public/assets/looks/<kind>/<id>/{0..3}.png.
 * Skipped: mini_railway (continuous scene cut), inverted_coaster (only 1/4 frames match approved hang).
 */
export const MOTION_SKIP_IDS: ReadonlySet<string> = new Set([
  "mini_railway",
  "inverted_coaster",
]);

export function shouldSkipMotion(id: string): boolean {
  return MOTION_SKIP_IDS.has(id);
}

/** All look assets shipped under public/assets/looks/<kind>/<id>.png */
export const LOOK_CATALOG: ReadonlyArray<{ kind: LookKind; id: string }> = [
  // attractions
  { kind: "attraction", id: "sky_coaster" },
  { kind: "attraction", id: "inverted_coaster" },
  { kind: "attraction", id: "launch_coaster" },
  { kind: "attraction", id: "wild_mouse" },
  { kind: "attraction", id: "drop_tower" },
  { kind: "attraction", id: "giant_frisbee" },
  { kind: "attraction", id: "top_spin" },
  { kind: "attraction", id: "mega_ferris" },
  { kind: "attraction", id: "enterprise_wheel" },
  { kind: "attraction", id: "space_shot" },
  { kind: "attraction", id: "grand_carousel" },
  { kind: "attraction", id: "bumper_cars" },
  { kind: "attraction", id: "wave_swinger" },
  { kind: "attraction", id: "swan_lake" },
  { kind: "attraction", id: "pirate_ship" },
  { kind: "attraction", id: "monorail" },
  { kind: "attraction", id: "haunted_manor" },
  { kind: "attraction", id: "enchanted_teacups" },
  { kind: "attraction", id: "maze_labyrinth" },
  { kind: "attraction", id: "mini_railway" },
  { kind: "attraction", id: "log_flume" },
  { kind: "attraction", id: "white_water" },
  { kind: "attraction", id: "splash_boats" },
  { kind: "attraction", id: "submarine" },
  { kind: "attraction", id: "motion_cinema" },
  { kind: "attraction", id: "shooting_gallery" },
  { kind: "attraction", id: "ring_toss" },
  { kind: "attraction", id: "high_striker" },
  { kind: "attraction", id: "basketball_arcade" },
  { kind: "attraction", id: "vr_pods" },
  // stalls
  { kind: "stall", id: "espresso_bar" },
  { kind: "stall", id: "cotton_candy" },
  { kind: "stall", id: "balloon_vendor" },
  { kind: "stall", id: "popcorn_cart" },
  { kind: "stall", id: "burger_shack" },
  { kind: "stall", id: "pizza_slice" },
  { kind: "stall", id: "gelato" },
  { kind: "stall", id: "churros" },
  { kind: "stall", id: "hotdog_pretzel" },
  { kind: "stall", id: "lemonade" },
  { kind: "stall", id: "bubble_tea" },
  { kind: "stall", id: "waffles" },
  { kind: "stall", id: "taco_corner" },
  { kind: "stall", id: "fried_chicken" },
  { kind: "stall", id: "donut_bar" },
  { kind: "stall", id: "smoothie" },
  { kind: "stall", id: "souvenir_shop" },
  { kind: "stall", id: "photo_booth" },
  { kind: "stall", id: "candy_factory" },
  { kind: "stall", id: "soda_fountain" },
  // props
  { kind: "prop", id: "flower" },
  { kind: "prop", id: "bush" },
  { kind: "prop", id: "tree" },
  { kind: "prop", id: "statue" },
  { kind: "prop", id: "bin" },
  { kind: "prop", id: "bench" },
  { kind: "prop", id: "warehouse" },
  { kind: "prop", id: "path" },
  { kind: "prop", id: "gate" },
  // staff
  { kind: "staff", id: "janitor" },
  { kind: "staff", id: "runner" },
  { kind: "staff", id: "mechanic" },
];

export function shouldSkipLook(id: string): boolean {
  return LOOK_SKIP_IDS.has(id);
}
