# הוצאת Cloud Island Tycoon לריפו עצמאי

## מה כבר מוכן

| נכס | קישור |
| --- | --- |
| משחק חי (Netlify) | https://cloud-island-tycoon-maduel.netlify.app |
| שיבוט Git (dumb HTTP מ־Netlify) | `git clone https://cloud-island-tycoon-maduel.netlify.app/repo.git` |
| ZIP מקור | https://cloud-island-tycoon-maduel.netlify.app/download/cloud-island-tycoon-source.zip |
| דף הוראות | https://cloud-island-tycoon-maduel.netlify.app/source.html |
| ענף זמני ב־TrailLink | `standalone/cloud-island-tycoon` |
| Release + bundle | https://github.com/maduel-cmd/TrailLink/releases/tag/cloud-island-tycoon-v0.1 |
| ריפו ייעודי (יעד) | https://github.com/maduel-cmd/cloud-island-tycoon |

## למה הסוכן לא דוחף ישירות

Cursor GitHub App מותקן עם גישה ל־**TrailLink בלבד**.  
`git push` ל־`maduel-cmd/cloud-island-tycoon` מחזיר 403 (`Permission denied to cursor[bot]`).

## איך למלא את הריפו הייעודי (בחר אחת)

### א) Import ב־GitHub (הכי מהיר)

1. פתח https://github.com/maduel-cmd/cloud-island-tycoon  
2. **Import code** (או https://github.com/new/import)  
3. כתובת המקור: `https://cloud-island-tycoon-maduel.netlify.app/repo.git`

### ב) מהמחשב שלך

```bash
git clone https://cloud-island-tycoon-maduel.netlify.app/repo.git cloud-island-tycoon
cd cloud-island-tycoon
git remote set-url origin https://github.com/maduel-cmd/cloud-island-tycoon.git
git push -u origin main
```

### ג) לתת לסוכן / Actions לדחוף

1. הוסף את `cloud-island-tycoon` ל־Repository access של אפליקציית Cursor ב־GitHub  
   **או** צור PAT עם `contents:write` לריפו  
2. הזן כסוד סביבה `CLOUD_ISLAND_PUSH_TOKEN` (לסוכן) ו/או כ־GitHub Actions secret ב־TrailLink באותו שם  
3. הרץ `./scripts/push-standalone.sh` או workflow **Mirror Cloud Island Tycoon** ב־TrailLink

## תיקייה מקומית

`/home/ubuntu/cloud-island-tycoon` — `git init` על `main`, ללא מונוריפו TrailLink.
