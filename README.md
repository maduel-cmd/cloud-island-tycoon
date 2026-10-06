# Cloud Island Tycoon — ממלכת השמיים

משחק ניהול פארק שעשועים תלת־ממדי על אי מרחף (Sky Park).  
**ריפו עצמאי** — לא חלק מ־TrailLink / Tipsy Dragon.

## דרישות

- Node.js 20+
- npm 10+

## התקנה והרצה

```bash
npm install
npm run dev
```

נפתח ב־`http://127.0.0.1:5175` (או לפי `vite.config.ts`).

## פקודות

| פקודה | תיאור |
| --- | --- |
| `npm run dev` | שרת פיתוח (Vite) |
| `npm run build` | בנייה לפרודקשן |
| `npm run preview` | תצוגה מקדימה של הבילד |
| `npm test` | בדיקות יחידה (כולל assets QA) |
| `npm run qa:assets` | נכסים: looks / stills+motion / bank / min size+dims |
| `npm run qa:live` | HEAD לחי — דורש `QA_LIVE_URL` (בלי env → SKIP) |
| `npm run typecheck` | בדיקת TypeScript |

```bash
QA_LIVE_URL=https://cloud-island-tycoon-maduel.netlify.app npm run qa:live
```

## גרפיקה — הערות QA

- **תפרי שביל/אריח:** `TILE_MESH_SCALE` ב־`src/three/isoMath.ts` (≥1, כרגע `1.02`) סוגר רווחים; אל תחזירו `0.98`.
- **גבעות אחו:** mesh צפוף + shading חלק בשפת האי; לא כדורים low-poly ליד looks.
- **Path atlas:** אריחי path משתמשים ב־`prop/path` still + motion frames (לא צבע שטוח בלבד).
- **אין placeholder בפרוד:** `isAssetReady` דוחה src ריק / `googleusercontent`; צוות רץ על look motion מקומי (`AnimatedStaff`).
- **Procedural מוסתר** כש־look נטען (`applyLookBillboard`).
- **אל תמחקו** קבצים תחת `public/assets/looks/`.
- צינור מלא: [`docs/ASSET_PIPELINE_CIT_he.md`](docs/ASSET_PIPELINE_CIT_he.md)

## פרומו / חנות (HE)

- צילומים: [`docs/promo/`](docs/promo/) ו־[`public/promo/`](public/promo/) (≥3 + `og-image.jpg`)
- `og:image`: `/og-image.jpg` ב־`index.html`
- לינק חי: https://cloud-island-tycoon-maduel.netlify.app
- כותרת: **Cloud Island Tycoon — ממלכת השמיים**
- תיאור קצר: טייקון פארק שעשועים איזומטרי על אי בעננים — בנה מתקנים, נהל מבקרים, הרחב את האי.

## Promo / store (EN)

- Shots: [`docs/promo/`](docs/promo/) and [`public/promo/`](public/promo/) (≥3 + `og-image.jpg`)
- Open Graph image: `/og-image.jpg`
- Live: https://cloud-island-tycoon-maduel.netlify.app
- Title: **Cloud Island Tycoon — Kingdom of the Clouds**
- Blurb: Isometric sky-park tycoon — place rides and stalls, keep guests happy, grow your floating island. High-tier stills + motion looks, Hebrew HUD, PWA-ready.

## מה כלול

- רינדור **Three.js בלבד** (מצלמת orbit, אחו/עננים, מתקני פנטזיה + looks)
- מנוע טיקים, רשת, pathfinding, מבקרים, כלכלה
- PWA (לוגו + התקנה למסך הבית)
- UI בעברית / ערבית / אנגלית / סינית

## כלל פתיחה

במפה בהתחלה: **מגרש ריק + שער בלבד**. כל השאר מהבנק לבנייה.

## פריסה

Production (Netlify): https://cloud-island-tycoon-maduel.netlify.app

## מבנה

```
src/
  components/   HUD, פאנלים, ThreeGameView
  three/        עולם Three.js + מודלי מתקנים + looks
  managers/     סימולציה
  data/         מתקנים / דוכנים
  i18n/         תרגומים
docs/
  ASSET_PIPELINE_CIT_he.md
  promo/        צילומי חנות
public/icons/   אייקון PWA
public/promo/   צילומים ל־CDN
public/assets/looks/
```

## מקור Git

ריפו ייעודי: https://github.com/maduel-cmd/cloud-island-tycoon

```bash
git clone https://github.com/maduel-cmd/cloud-island-tycoon.git
cd cloud-island-tycoon
npm install
npm run dev
```

פירוט הוצאה מהמונוריפו: [`docs/STANDALONE_EXTRACT_he.md`](docs/STANDALONE_EXTRACT_he.md)
