#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$ROOT"; mkdir -p game/test-results
if [[ -n "${E2E_BASE_URL:-}" && "${E2E_BASE_URL}" != http://127.0.0.1:* && "${E2E_BASE_URL}" != http://localhost:* ]]; then
  python game/e2e/production_e2e.py 2>&1 | tee game/test-results/e2e-report.txt
  exit ${PIPESTATUS[0]}
fi
npm run build --prefix game
export DJANGO_SETTINGS_MODULE=config.settings.development DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost
python backend/manage.py migrate --noinput >/dev/null
python backend/manage.py runserver 127.0.0.1:8000 --noreload >game/test-results/django.log 2>&1 & pid=$!
trap 'kill "$pid" 2>/dev/null || true' EXIT
for _ in $(seq 1 80); do curl -fsS http://127.0.0.1:8000/api/build-info/ >game/test-results/build-info.json && break; sleep .25; done
python game/e2e/production_e2e.py 2>&1 | tee game/test-results/e2e-report.txt
exit ${PIPESTATUS[0]}
