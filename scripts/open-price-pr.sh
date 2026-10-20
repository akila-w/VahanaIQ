#!/usr/bin/env bash
# Commits the refreshed js/catalog.js to a prices/YYYY-MM branch and opens (or updates)
# its pull request against main. It never commits to main. Used by
# .github/workflows/refresh-prices.yml and by the monthly Claude research task
# (scripts/price-research-task.md).
#
#   scripts/open-price-pr.sh <pr-body.md>
set -euo pipefail

body="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
cd "$(dirname "$0")/.."

if git diff --quiet -- js/catalog.js; then
  echo "js/catalog.js is unchanged; no pull request needed."
  exit 0
fi

month=$(node -p 'require("fs").readFileSync("js/catalog.js", "utf8").match(/priceUpdated: "(\d{4}-\d{2})"/)[1]')
branch="prices/$month"
title="Catalogue prices for $month (AI estimates, please check)"

# -C: a rerun in the same month replaces that month's branch
git switch -C "$branch"
git add js/catalog.js
git commit -m "chore(catalog): refresh vehicle prices for $month"
git push --force origin "$branch"

if [ "$(gh pr view "$branch" --json state --jq .state 2>/dev/null)" = "OPEN" ]; then
  gh pr edit "$branch" --title "$title" --body-file "$body"
else
  gh pr create --base main --head "$branch" --title "$title" --body-file "$body"
fi
