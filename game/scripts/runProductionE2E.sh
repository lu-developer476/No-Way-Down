#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
RESULTS=game/test-results
mkdir -p "$RESULTS"

if [[ -n "${E2E_BASE_URL:-}" && "${E2E_BASE_URL}" != http://127.0.0.1:* && "${E2E_BASE_URL}" != http://localhost:* ]]; then
  python game/e2e/production_e2e.py 2>&1 | tee "$RESULTS/e2e-report.txt"
  exit "${PIPESTATUS[0]}"
fi

if [[ "${E2E_SKIP_BUILD:-0}" == "1" ]]; then
  if [[ ! -f game/dist/index.html ]]; then
    echo 'E2E_SKIP_BUILD=1 requires game/dist/index.html' >&2
    exit 2
  fi
else
  npm run build --prefix game
fi

export DJANGO_SETTINGS_MODULE=config.settings.development
export DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost
python backend/manage.py migrate --noinput >/dev/null
python backend/manage.py check
python backend/manage.py runserver 127.0.0.1:8000 --noreload >"$RESULTS/django.log" 2>&1 &
pid=$!
cleanup() { kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

deadline=$((SECONDS + 30))
ready_api=0
ready_root=0
while (( SECONDS < deadline )); do
  if ! kill -0 "$pid" 2>/dev/null; then
    echo 'Django terminated before readiness.' >&2
    cat "$RESULTS/django.log" >&2
    exit 3
  fi
  if curl -fsS http://127.0.0.1:8000/api/build-info/ >"$RESULTS/build-info.json.tmp" 2>/dev/null; then ready_api=1; fi
  if curl -fsS -o /dev/null http://127.0.0.1:8000/ 2>/dev/null; then ready_root=1; fi
  if (( ready_api && ready_root )); then mv "$RESULTS/build-info.json.tmp" "$RESULTS/build-info.json"; break; fi
  sleep .25
done
if (( ! ready_api || ! ready_root )); then
  echo 'Django readiness timed out after 30 seconds.' >&2
  cat "$RESULTS/django.log" >&2
  exit 4
fi

python game/e2e/production_e2e.py 2>&1 | tee "$RESULTS/e2e-report.txt"
exit "${PIPESTATUS[0]}"
