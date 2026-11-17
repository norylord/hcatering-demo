#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
owner=$(gh api --hostname github.com user --jq '.login')
repo="$owner/hcatering-demo"

if git remote get-url origin >/dev/null 2>&1; then
  remote=$(git remote get-url origin)
  case "$remote" in
    "https://github.com/$repo"|"https://github.com/$repo.git"|"git@github.com:$repo.git") ;;
    *) echo "У этого репозитория другой origin: $remote" >&2; exit 1 ;;
  esac
else
  gh repo create "$repo" --public --source=. --remote=origin --description "Интерактивная демонстрация hCatering"
fi
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push -u origin main

endpoint="repos/$repo/pages"
if gh api "$endpoint" --silent 2>/dev/null; then
  method=PUT
else
  method=POST
fi
gh api --method "$method" "$endpoint" -f 'source[branch]=main' -f 'source[path]=/docs' --silent
for ((attempt=0; attempt<60; attempt++)); do
  status=$(gh api "$endpoint" --jq '.status')
  case "$status" in
    built) gh api "$endpoint" --jq '.html_url'; exit 0 ;;
    errored) gh api "repos/$repo/pages/builds/latest" --jq '.error.message'; exit 1 ;;
  esac
  sleep 5
done
echo "GitHub принял файлы. Проверьте состояние сборки в Settings → Pages." >&2
exit 1
