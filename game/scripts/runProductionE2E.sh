#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
npm run build --prefix game
export DJANGO_SETTINGS_MODULE=config.settings.development
export DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost
python backend/manage.py migrate --noinput >/dev/null
python backend/manage.py runserver 127.0.0.1:8000 --noreload >game/test-results/django.log 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do curl -fsS http://127.0.0.1:8000/ >/dev/null && break; sleep .25; done
python game/e2e/production_e2e.py 2>&1 | tee game/test-results/e2e-report.txt
