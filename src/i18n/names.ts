import type { Locale } from "./catalog";
import { getLocale } from "./catalog";

/** שמות ישות לפי שפה — he/en מגיעים מהדאטה; ar/zh כאן */
type NamePair = { ar: string; zh: string };

const ATTRACTION_NAMES: Record<string, NamePair> = {
  sky_coaster: { ar: "قطار السماء", zh: "天空过山车" },
  inverted_coaster: { ar: "قطار مقلوب", zh: "倒置过山车" },
  launch_coaster: { ar: "إطلاق سريع", zh: "弹射过山车" },
  wild_mouse: { ar: "فأر بري", zh: "野鼠过山车" },
  drop_tower: { ar: "برج السقوط", zh: "自由落体塔" },
  giant_frisbee: { ar: "فريسبي عملاق", zh: "巨型飞盘" },
  top_spin: { ar: "توب سبين", zh: "空中翻滚" },
  mega_ferris: { ar: "عجلة عملاقة", zh: "巨型摩天轮" },
  enterprise_wheel: { ar: "عجلة إنتربرايز", zh: "企业号转轮" },
  space_shot: { ar: "طلقة الفضاء", zh: "太空发射" },
  grand_carousel: { ar: "كاروسيل ملكي", zh: "皇家旋转木马" },
  bumper_cars: { ar: "سيارات تصادم", zh: "碰碰车" },
  wave_swinger: { ar: "أرجوحة الأمواج", zh: "波浪秋千" },
  swan_lake: { ar: "بحيرة البجع", zh: "天鹅湖" },
  pirate_ship: { ar: "سفينة القراصنة", zh: "海盗船" },
  monorail: { ar: "قطار أحادي", zh: "单轨列车" },
  haunted_manor: { ar: "القصر المسكون", zh: "鬼屋庄园" },
  enchanted_teacups: { ar: "فناجين مسحورة", zh: "魔法茶杯" },
  maze_labyrinth: { ar: "متاهة", zh: "迷宫" },
  mini_railway: { ar: "قطار صغير", zh: "迷你铁路" },
  log_flume: { ar: "مجرى الأخشاب", zh: "原木漂流" },
  white_water: { ar: "ماء أبيض", zh: "激流勇进" },
  splash_boats: { ar: "قوارب الرذاذ", zh: "溅水船" },
  submarine: { ar: "غواصة", zh: "潜水艇" },
  motion_cinema: { ar: "سينما حركة", zh: "动感影院" },
  shooting_gallery: { ar: "رماية", zh: "射击馆" },
  ring_toss: { ar: "رمي الحلقات", zh: "套圈" },
  high_striker: { ar: "مطرقة القوة", zh: "大力锤" },
  basketball_arcade: { ar: "كرة سلة", zh: "篮球机" },
  vr_pods: { ar: "كبائن واقع افتراضي", zh: "VR舱" },
};

const STALL_NAMES: Record<string, NamePair> = {
  espresso_bar: { ar: "بار إسبريسو", zh: "意式咖啡吧" },
  cotton_candy: { ar: "غزل البنات", zh: "棉花糖" },
  balloon_vendor: { ar: "بائع بالونات", zh: "气球小贩" },
  popcorn_cart: { ar: "عربة فشار", zh: "爆米花车" },
  burger_shack: { ar: "كوخ برغر", zh: "汉堡屋" },
  pizza_slice: { ar: "شريحة بيتزا", zh: "披萨角" },
  gelato: { ar: "جيلاتو", zh: "意式冰淇淋" },
  churros: { ar: "تشوروس", zh: "西班牙油条" },
  hotdog_pretzel: { ar: "هوت دوغ وبريتزل", zh: "热狗椒盐卷" },
  lemonade: { ar: "ليمونادة", zh: "柠檬水" },
  bubble_tea: { ar: "شاي الفقاعات", zh: "奶茶" },
  waffles: { ar: "وافل", zh: "华夫饼" },
  taco_corner: { ar: "زاوية تاكو", zh: "塔可角" },
  fried_chicken: { ar: "دجاج مقلي", zh: "炸鸡" },
  donut_bar: { ar: "بار دونات", zh: "甜甜圈吧" },
  smoothie: { ar: "سموذي", zh: "冰沙" },
  souvenir_shop: { ar: "متجر هدايا", zh: "纪念品店" },
  photo_booth: { ar: "كشك صور", zh: "拍贴机" },
  candy_factory: { ar: "مصنع حلوى", zh: "糖果工厂" },
  soda_fountain: { ar: "نافورة صودا", zh: "汽水吧" },
};

const DECOR_NAMES: Record<string, NamePair> = {
  flower: { ar: "حديقة زهور", zh: "花坛" },
  bush: { ar: "شجيرة", zh: "灌木" },
  tree: { ar: "شجرة ظل", zh: "遮荫树" },
  statue: { ar: "تمثال", zh: "雕像" },
};

const UTIL_NAMES: Record<string, { he: string; en: string; ar: string; zh: string }> = {
  path: { he: "שביל מרוצף", en: "Paved Path", ar: "ممر مرصوف", zh: "铺装小径" },
  bin: { he: "פח אשפה", en: "Trash Bin", ar: "سلة مهملات", zh: "垃圾桶" },
  bench: { he: "ספסל מנוחה", en: "Park Bench", ar: "مقعد استراحة", zh: "休息长椅" },
  parking: { he: "מקום חניה", en: "Parking Bay", ar: "موقف سيارات", zh: "停车位" },
  warehouse: { he: "מחסן לוגיסטיקה", en: "Logistics Warehouse", ar: "مستودع لوجستي", zh: "后勤仓库" },
  hire_janitor: { he: "שכור מנקה", en: "Hire Janitor", ar: "وظّف منظّفًا", zh: "雇佣清洁工" },
  hire_runner: { he: "שכור שליח", en: "Hire Runner", ar: "وظّف مندوبًا", zh: "雇佣送货员" },
  hire_mechanic: { he: "שכור טכנאי", en: "Hire Mechanic", ar: "وظّف فنيًا", zh: "雇佣技工" },
};

export function pickLocalized(
  locale: Locale,
  he: string,
  en: string,
  pair?: NamePair,
): string {
  if (locale === "he") return he;
  if (locale === "en") return en;
  if (locale === "ar") return pair?.ar ?? en;
  return pair?.zh ?? en;
}

export function attractionDisplayName(
  id: string,
  nameHe: string,
  nameEn: string,
  locale: Locale = getLocale(),
): string {
  return pickLocalized(locale, nameHe, nameEn, ATTRACTION_NAMES[id]);
}

export function stallDisplayName(
  id: string,
  nameHe: string,
  nameEn: string,
  locale: Locale = getLocale(),
): string {
  return pickLocalized(locale, nameHe, nameEn, STALL_NAMES[id]);
}

export function decorDisplayName(
  id: string,
  nameHe: string,
  nameEn: string,
  locale: Locale = getLocale(),
): string {
  return pickLocalized(locale, nameHe, nameEn, DECOR_NAMES[id]);
}

export function utilDisplayName(id: string, locale: Locale = getLocale()): string {
  const u = UTIL_NAMES[id];
  if (!u) return id;
  return u[locale] ?? u.en;
}
