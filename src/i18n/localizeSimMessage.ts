import { getLocale, t, type Locale } from "./catalog";

/**
 * Simulation still emits Hebrew message strings. Localize at the toast boundary
 * so English (and other locales) match the active language without rewriting tick logic.
 */
const EXACT: Record<string, string> = {
  "שביל נסלל — גררו להמשך": "msgPathPaint",
  "פח רק על שביל או דשא": "msgBinTile",
  "לא ניתן להציב פח על מתקן או דוכן": "msgBinOccupy",
  "כבר יש פח כאן": "msgBinExists",
  "המשבצת תפוסה — בחרו מקום אחר": "msgCellBusy",
  "אין מספיק מזומן לפח": "msgNoCashBin",
  "ספסל רק על שביל או דשא": "msgBenchTile",
  "לא ניתן להציב ספסל על מתקן או דוכן": "msgBenchOccupy",
  "כבר יש פח כאן — בחרו משבצת אחרת": "msgBenchBinConflict",
  "אין מספיק מזומן לספסל": "msgNoCashBench",
  "חניה רק על דשא פנוי": "msgParkingGrass",
  "המשבצת תפוסה": "msgCellTaken",
  "הגעתם למקסימום חניות": "msgParkingMax",
  "אין מספיק מזומן לחניה": "msgNoCashParking",
  "כבר יש מחסן בפארק": "msgWarehouseExists",
  "מחסן רק על דשא פנוי": "msgWarehouseGrass",
  "אין מספיק מזומן למחסן": "msgNoCashWarehouse",
  "מחסן לוגיסטיקה הוצב — הזמינו מלאי מהתפריט": "msgWarehouseBuilt",
  "נוי רק על שביל או דשא": "msgDecorTile",
  "לא ניתן להציב נוי על מתקן או דוכן": "msgDecorOccupy",
  "אין מספיק מזומן להרחבה": "msgNoCashExpand",
  "אין מספיק מזומן לשדרוג": "msgNoCashUpgrade",
  "אין מספיק מזומן לגיוס צוות": "msgNoCashHire",
  "בנו מחסן מבנק הבנייה לפני הזמנת מלאי": "msgNeedWarehouse",
  "בחרו משבצת דשא להצבת חניה (₪800)": "msgPickParking",
  "המתקן תוקן": "msgRideFixed",
  "מתקן פורק": "msgRideDemolished",
  "דוכן פורק": "msgStallDemolished",
  "אין מספיק מזומן למתקן": "msgNoCashRide",
  "אין מספיק מזומן לדוכן": "msgNoCashStall",
  "אין מספיק כסף לשביל": "msgNoCashPath",
  "קודם סללו שביל מהשער — ואז הציבו את הקרוסלה החינמית": "msgNeedPathCarousel",
  "קודם סללו שביל מהשער — ואז הציבו את הדוכן החינמי": "msgNeedPathStall",
  "דילגתם על שכר הלילה עם יהלום": "msgGemSkipWage",
};

export function localizeSimMessage(raw: string, locale: Locale = getLocale()): string {
  if (!raw) return raw;
  if (locale === "he") return raw;

  const exactKey = EXACT[raw];
  if (exactKey) return t(exactKey, locale);

  let m = /^דמי כניסה: ₪(\d+)$/.exec(raw);
  if (m) return t("msgGateFee", locale, { n: m[1]! });

  m = /^שכר לילה: −₪(\d+)$/.exec(raw);
  if (m) return t("msgNightWagePaid", locale, { n: m[1]! });

  m = /^🎉 רמת פארק (\d+)! \+5 יהלומים$/.exec(raw);
  if (m) return t("msgParkLevelUp", locale, { n: m[1]! });

  m = /^סיכום יום (\d+)$/.exec(raw);
  if (m) return t("msgDaySummary", locale, { n: m[1]! });

  m = /^פח פורק \(\+₪(\d+)\)$/.exec(raw);
  if (m) return t("msgBinRefund", locale, { n: m[1]! });

  m = /^ספסל פורק \(\+₪(\d+)\)$/.exec(raw);
  if (m) return t("msgBenchRefund", locale, { n: m[1]! });

  m = /^מקום חניה נוסף · (\d+)\/18$/.exec(raw);
  if (m) return t("msgParkingAdded", locale, { n: m[1]! });

  m = /^המחסן התמלא \(\+(\d+)\)$/.exec(raw);
  if (m) return t("msgWarehouseStock", locale, { n: m[1]! });

  m = /^נתיב כניסה נוסף \((\d+)\)$/.exec(raw);
  if (m) return t("msgEntranceLane", locale, { n: m[1]! });

  m = /^נפתח אזור חדש: (.+)$/.exec(raw);
  if (m) return t("msgPlotOpened", locale, { id: m[1]! });

  m = /^(\d+) מתקנים\/דוכנים מנותקים מהשביל — המבקרים לא מגיעים!$/.exec(raw);
  if (m) return t("msgDisconnected", locale, { n: m[1]! });

  // Built / kit installed with Hebrew attraction or stall name embedded
  m = /^הותקן מערכה: (.+) — סללו שביל מהכניסה עד המתקן!$/.exec(raw);
  if (m) return t("msgKitRideNeedPath", locale, { name: m[1]! });
  m = /^הותקן מערכה: (.+) — חברו שביל מהכניסה לדוכן!$/.exec(raw);
  if (m) return t("msgKitStallNeedPath", locale, { name: m[1]! });
  m = /^הותקן מערכה: (.+)$/.exec(raw);
  if (m) return t("msgKitInstalled", locale, { name: m[1]! });
  m = /^נבנה: (.+) — בלי שביל המבקרים לא יגיעו\. סללו שביל!$/.exec(raw);
  if (m) return t("msgBuiltNeedPath", locale, { name: m[1]! });
  m = /^נבנה: (.+)$/.exec(raw);
  if (m) return t("msgBuilt", locale, { name: m[1]! });
  m = /^נפתח: (.+) — בלי שביל הלקוחות לא יגיעו!$/.exec(raw);
  if (m) return t("msgStallNeedPath", locale, { name: m[1]! });
  m = /^נפתח: (.+)$/.exec(raw);
  if (m) return t("msgStallOpened", locale, { name: m[1]! });

  m = /^ספסל הוצב \(₪(\d+)\) · (\d+) ספסלים — אורחים יושבים ונחים$/.exec(raw);
  if (m) return t("msgBenchPlaced", locale, { cost: m[1]!, n: m[2]! });

  m = /^(.+) הוצב \(₪(\d+)\) · (\d+) פריטי נוי — מצב הרוח עולה$/.exec(raw);
  if (m) return t("msgDecorPlaced", locale, { name: m[1]!, cost: m[2]!, n: m[3]! });

  m = /^(.+) שודרג לרמה (\d+)$/.exec(raw);
  if (m) return t("msgUpgraded", locale, { name: m[1]!, tier: m[2]! });

  m = /^(.+) פורק \(\+₪(\d+)\)$/.exec(raw);
  if (m) return t("msgDecorRefund", locale, { name: m[1]!, n: m[2]! });

  m = /^אין מספיק מזומן ל(.+)$/.exec(raw);
  if (m) return t("msgNoCashFor", locale, { name: m[1]! });

  return raw;
}
