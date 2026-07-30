#!/usr/bin/env bash
set -euo pipefail

git_sha="$(git rev-parse HEAD)"
git_branch="$(git branch --show-current)"
source_tree_from_trailer="$(git log -1 --format=%B | sed -n 's/^Source-GitHub-Tree:[[:space:]]*//p' | tail -n 1)"
source_sha_from_trailer="$(git log -1 --format=%B | sed -n 's/^Source-GitHub-SHA:[[:space:]]*//p' | tail -n 1)"
if [[ -n "$source_sha_from_trailer" && ! "$source_sha_from_trailer" =~ ^[0-9a-fA-F]{40}$ ]]; then
  echo "[render-build] Error: Source-GitHub-SHA trailer is not a full SHA." >&2
  exit 1
fi
deploy_commit_sha="${RENDER_GIT_COMMIT:-$git_sha}"
source_commit_sha="${NWD_SOURCE_SHA:-${source_sha_from_trailer:-${NWD_BUILD_SHA:-${GITHUB_SHA:-${RENDER_GIT_COMMIT:-$git_sha}}}}}"
[[ "$source_commit_sha" =~ ^[0-9a-fA-F]{40}$ ]] || { echo "[render-build] Error: source SHA is not a full hexadecimal commit." >&2; exit 1; }
[[ "$deploy_commit_sha" =~ ^[0-9a-fA-F]{40}$ ]] || { echo "[render-build] Error: deploy commit is not a full hexadecimal commit." >&2; exit 1; }
if ! origin_url="$(git config --get remote.origin.url 2>/dev/null)"; then origin_url=""; fi
origin_host="$(printf '%s' "$origin_url" | sed -E 's#^[a-z]+://([^@/]+@)?([^/:]+).*#\2#; s#^[^@]+@([^:]+):.*#\1#' | tr '[:upper:]' '[:lower:]')"
case "$origin_host" in *github.com) repository_provider=github ;; *gitlab.com|*gitlab.*) repository_provider=gitlab ;; *) repository_provider=unknown ;; esac

echo "[render-build] source commit (GitHub): $source_commit_sha"
echo "[render-build] deploy commit (Render provider): $deploy_commit_sha"
echo "[render-build] source tree: ${source_tree_from_trailer:-$(git rev-parse HEAD^{tree})}"
echo "[render-build] repository provider: $repository_provider"
echo "[render-build] branch: ${git_branch:-detached}"
echo "[render-build] Node: $(node --version)"
echo "[render-build] npm: $(npm --version)"
echo "[render-build] Python: $(python --version 2>&1)"

export NWD_SOURCE_SHA="$source_commit_sha"
export NWD_BUILD_SHA="$source_commit_sha"
export NWD_FRONTEND_SHA="$source_commit_sha"
export NWD_DEPLOY_COMMIT="$deploy_commit_sha"
export NWD_REPOSITORY_PROVIDER="$repository_provider"
export NWD_BUILT_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
export NWD_BRANCH="${RENDER_GIT_BRANCH:-${git_branch:-main}}"

echo "[render-build] Auditing tracked deploy source tree before dependency installation"
npm run audit:deploy-source-tree --prefix game

echo "[render-build] Upgrading pip"
python -m pip install --upgrade pip

echo "[render-build] Installing Python dependencies"
python -m pip install -r backend/requirements.txt

echo "[render-build] Installing Node dependencies with npm ci"
npm ci --prefix game

echo "[render-build] Running blocking deployment audits"
npm run audit:e2e-text-only --prefix game
npm run audit:protected-assets --prefix game
npm run audit:campaign --prefix game
npm run audit:tiled --prefix game
npm run audit:runtime-reachability --prefix game
npm run audit:dead-code --prefix game

echo "[render-build] Type-checking from the game workspace"
npm run typecheck --prefix game

echo "[render-build] Removing any stale frontend dist"
rm -rf game/dist

echo "[render-build] Building Vite frontend (TypeScript, Vite, campaign validation)"
npm run build --prefix game

echo "[render-build] Verifying Vite index.html exists"
test -f game/dist/index.html
test -f game/dist/build-info.json

echo "[render-build] Verifying deploy identity and generated production art"
npm run audit:deploy-identity --prefix game
npm run audit:dist-production-art --prefix game
node -e 'const fs=require("fs");const info=JSON.parse(fs.readFileSync("game/dist/build-info.json","utf8"));if(info.frontendSha!==process.env.NWD_BUILD_SHA)throw new Error(`frontendSha ${info.frontendSha} does not match ${process.env.NWD_BUILD_SHA}`)'

echo "[render-build] Collecting Django static files"
python backend/manage.py collectstatic --noinput

echo "[render-build] Full-stack build completed for $NWD_BUILD_SHA"
