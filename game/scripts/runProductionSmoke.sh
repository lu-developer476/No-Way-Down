#!/usr/bin/env bash
set -euo pipefail
: "${E2E_BASE_URL:=https://no-way-down.onrender.com}"
export E2E_BASE_URL E2E_EXPECTED_SHA="${E2E_EXPECTED_SHA:-}" E2E_VISUAL_COMPARISON="${E2E_VISUAL_COMPARISON:-0}"
exec bash "$(dirname "$0")/runProductionE2E.sh"
