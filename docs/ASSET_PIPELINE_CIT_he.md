# צינור נכסים — Cloud Island Tycoon (ASSET PIPELINE)

מסמך עברי לצוות / סוכנים. **רק CIT** — לא Tipsy Dragon / food-truck.

## עקרונות

1. **אין placeholder בפרוד** — אסור `src=""`, `googleusercontent`, emoji כ־look, או `BoxGeometry` חשוף כשיש still ב־`LOOK_CATALOG`.
2. **כל ישות ב־LOOK_CATALOG = קובץ על דיסק** — still + 4 motion frames (אלא אם `MOTION_SKIP_IDS`).
3. **Procedural מוסתר** כש־`applyLookBillboard` מצליח (`hasLookImage`); tier accents נשארים.
4. **בנק** — `bankLookSrc` → `public/assets/ui/bank-looks/`; SVG ב־`IsoThumb` רק כשאין look / artSrc.
5. **צוות** — `GAME_ANIMATIONS` מצביע על `public/assets/looks/staff/<role>/{0..3}.png` (לא וידאו ריק).

## מבנה תיקיות

```
public/assets/looks/
  attraction/<id>.png          # still
  attraction/<id>/{0,1,2,3}.png
  stall/...
  prop/...                     # כולל path.png + path/{0..3} לטקסטורת אריחים
  staff/...
public/assets/tiles/           # tile-grass / tile-path / tile-cloud-edge
public/assets/ui/bank-looks/   # כרטיסי בנק שקופים
public/promo/ + docs/promo/    # צילומי חנות + og
public/og-image.jpg
```

## מינימום גודל / מימדים (שער QA)

| סוג | מינימום |
| --- | --- |
| Look still | ≥1024B ו־≥256px בצלע הקצרה (PNG) |
| Motion frame | ≥2048B |
| Static `/assets/*` מוכן | ≥512B |

מוגדר ב־`src/config/assetsQa.test.ts`.

## פקודות

```bash
npm test
npm run qa:assets
# בדיקת HEAD לחי (דורש QA_LIVE_URL):
QA_LIVE_URL=https://cloud-island-tycoon-maduel.netlify.app npm run qa:live
# בלי env — qa:live מדפיס SKIP ויוצא 0
npm run build
```

`qa:assets` כולל: `assetsQa` + `assets` + `parkLooks` + `bankLook`.

`qa:live` בודק Content-Type אמיתי (דוחה SPA `text/html` על נתיבי image). נכסים חדשים בפרי (og/promo / `inverted_coaster` motion) מדווחים כ־WARN עד deploy מאושר — לא מפילים את השער המקומי.

## הוספת look חדש

1. שמור still + 4 frames תחת `public/assets/looks/<kind>/<id>/`.
2. הוסף ל־`LOOK_CATALOG` ב־`src/three/lookRegistry.ts`.
3. אם אין motion עדיין — הוסף ל־`MOTION_SKIP_IDS` **זמנית** ותעד ב־README של looks.
4. הרץ `npm run qa:assets`.
5. אל תערבב נכסי Tipsy / משאית אוכל.

## Terrain / path

- תפרי אריח: `TILE_MESH_SCALE = 1.02` ב־`isoMath.ts` (לא 0.98).
- שבילים: טקסטורת `prop/path` + motion frames על אריחי path ב־`ThreeParkWorld`.
- גבעות אחו: Sphere צפוף (32×24) + soft mat בשפת האי — לא ליד billboards בליבה.
- **Terrain pack מלא מ־cit-art** (meadow seamless / rock rim ייעודי) — כש־`/workspace/cit-art` זמין; כרגע נשענים על tiles + looks הקיימים.

## פרומו

- `docs/promo/` ו־`public/promo/`: ≥3 צילומים + `og-image.jpg`
- Meta: `index.html` → `og:image` = `/og-image.jpg`
- טקסט חנות HE+EN: מקטע ב־`README.md`

## מה אסור

- Merge / Netlify deploy בלי אישור רותם
- מחיקת looks
- שינוי כלכלה / pathfinding / mood שלא נדרש לגרפיקה
- עבודה על שיבוט בלי `public/assets/looks`

## קבצי עוגן

- `src/three/parkLooks.ts`, `lookRegistry.ts`, `ThreeParkWorld.ts`, `isoMath.ts`
- `src/config/assets.ts`, `assetsQa.test.ts`
- `scripts/qa-live.mjs`
- `public/assets/looks/README.md`
