#!/usr/bin/env bash
set -euo pipefail

git_sha="$(git rev-parse HEAD)"
git_branch="$(git branch --show-current)"
echo "[render-build] git rev-parse HEAD: $git_sha"
echo "[render-build] branch: ${git_branch:-detached}"
echo "[render-build] RENDER_GIT_COMMIT: ${RENDER_GIT_COMMIT:-}"
echo "[render-build] NWD_BUILD_SHA (incoming): ${NWD_BUILD_SHA:-}"
echo "[render-build] Node: $(node --version)"
echo "[render-build] npm: $(npm --version)"
echo "[render-build] Python: $(python --version 2>&1)"

export NWD_BUILD_SHA="${RENDER_GIT_COMMIT:-${NWD_BUILD_SHA:-$(git rev-parse HEAD)}}"
export NWD_FRONTEND_SHA="$NWD_BUILD_SHA"
export NWD_BUILT_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
export NWD_BRANCH="${RENDER_GIT_BRANCH:-${git_branch:-main}}"

echo "[render-build] Upgrading pip"
python -m pip install --upgrade pip

echo "[render-build] Installing Python dependencies"
python -m pip install -r backend/requirements.txt

echo "[render-build] Installing Node dependencies with npm ci"
npm ci --prefix game

echo "[render-build] Running blocking deployment audits"
NWD_DIFF_BASE="${NWD_DIFF_BASE:-HEAD^}" npm run audit:no-binary-diff --prefix game
npm run audit:e2e-text-only --prefix game
npm run audit:protected-assets --prefix game
npm run audit:campaign --prefix game
npm run audit:tiled --prefix game
npm run audit:runtime-reachability --prefix game
npm run audit:dead-code --prefix game

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
