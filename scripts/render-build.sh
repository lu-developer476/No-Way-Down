#!/usr/bin/env bash
set -euo pipefail

echo "[render-build] Upgrading pip"
python -m pip install --upgrade pip

echo "[render-build] Installing Python dependencies"
python -m pip install -r backend/requirements.txt

echo "[render-build] Installing Node dependencies with npm ci"
npm ci --prefix game

echo "[render-build] Building Vite frontend (TypeScript, Vite, campaign validation)"
npm run build --prefix game

echo "[render-build] Verifying Vite index.html exists"
test -f game/dist/index.html

echo "[render-build] Collecting Django static files"
python backend/manage.py collectstatic --noinput

echo "[render-build] Full-stack build completed"
