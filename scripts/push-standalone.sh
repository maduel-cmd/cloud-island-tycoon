#!/usr/bin/env bash
# דחיפה לריפו העצמאי (להריץ מחשבון עם הרשאות GitHub שלך)
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="${1:-https://github.com/maduel-cmd/cloud-island-tycoon.git}"
git remote remove origin 2>/dev/null || true
git remote add origin "$REPO"
git push -u origin main
echo "OK → $REPO"
