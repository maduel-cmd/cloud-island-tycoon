#!/usr/bin/env bash
set -euo pipefail
REPO_URL="${1:-}"
if [[ -z "$REPO_URL" ]]; then
  echo "Usage: $0 https://github.com/OWNER/cloud-island-tycoon.git"
  exit 1
fi
git remote remove standalone 2>/dev/null || true
git remote add standalone "$REPO_URL"
git push -u standalone HEAD:main
echo "Pushed to $REPO_URL"
