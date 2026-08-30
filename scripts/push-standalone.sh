#!/usr/bin/env bash
# דחיפה לריפו העצמאי maduel-cmd/cloud-island-tycoon
# סדר עדיפויות לאימות:
#   1) CLOUD_ISLAND_PUSH_TOKEN / GH_TOKEN / GITHUB_TOKEN (PAT עם contents:write)
#   2) gh auth token (Cursor App — עובד רק אחרי הוספת הריפו ל־App)
#   3) remote origin הקיים
set -euo pipefail
cd "$(dirname "$0")/.."
REPO_URL="${1:-https://github.com/maduel-cmd/cloud-island-tycoon.git}"

TOKEN="${CLOUD_ISLAND_PUSH_TOKEN:-${GH_TOKEN:-${GITHUB_TOKEN:-}}}"
if [[ -z "$TOKEN" ]] && command -v gh >/dev/null 2>&1; then
  TOKEN="$(gh auth token 2>/dev/null || true)"
fi

if [[ -n "$TOKEN" ]]; then
  AUTH_URL="https://x-access-token:${TOKEN}@github.com/maduel-cmd/cloud-island-tycoon.git"
else
  AUTH_URL="$REPO_URL"
fi

git remote remove origin 2>/dev/null || true
git remote add origin "$AUTH_URL"
# שמירת remote נקי בלי טוקן בלוג
git remote set-url --push origin "$AUTH_URL"
git push -u origin main
# החלפה ל־URL נקי אחרי הצלחה
git remote set-url origin "$REPO_URL"
echo "OK → $REPO_URL"
