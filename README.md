# Cloud Island Tycoon — ממלכת השמיים

משחק ניהול פארק שעשועים תלת־ממדי על אי מרחף (Sky Park).  
**ריפו עצמאי** — לא חלק מ־TrailLink.

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
| `npm test` | בדיקות יחידה |
| `npm run typecheck` | בדיקת TypeScript |

## מה כלול

- רינדור **Three.js בלבד** (מצלמת orbit, אחו/עננים, מתקני פנטזיה)
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
  three/        עולם Three.js + מודלי מתקנים
  managers/     סימולציה
  data/         מתקנים / דוכנים
  i18n/         תרגומים
public/icons/   אייקון PWA
```

## מקור Git

ריפו ייעודי: https://github.com/maduel-cmd/cloud-island-tycoon  

שיבוט מיידי (גם לפני שהריפו ב־GitHub מלא):

```bash
git clone https://cloud-island-tycoon-maduel.netlify.app/repo.git
```

ZIP: https://cloud-island-tycoon-maduel.netlify.app/download/cloud-island-tycoon-source.zip  

ענף זמני ב־TrailLink: [`standalone/cloud-island-tycoon`](https://github.com/maduel-cmd/TrailLink/tree/standalone/cloud-island-tycoon)  

פירוט הוצאה / דחיפה: [`docs/STANDALONE_EXTRACT_he.md`](docs/STANDALONE_EXTRACT_he.md)
