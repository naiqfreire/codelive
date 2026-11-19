#!/usr/bin/env bash
# Docker smoke test for the containerized stack (task #49).
#
# Verifies the single-origin frontend container: static SPA, deep-route
# fallback, /api proxying to the backend, and the WebSocket upgrade path.
# Run it via `docker compose up --build -d --wait` first, or let it wait.
#
# Usage: scripts/smoke-docker.sh [BASE_URL]
set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"
TIMEOUT_SECONDS="${SMOKE_TIMEOUT_SECONDS:-90}"
DEADLINE=$((SECONDS + TIMEOUT_SECONDS))

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

pass() {
  echo "ok: $*"
}

# 1. Backend reachability through the proxy (FastAPI + PostgreSQL).
echo "waiting for ${BASE_URL}/api/health (timeout ${TIMEOUT_SECONDS}s)..."
health=""
while ((SECONDS < DEADLINE)); do
  health="$(curl -fsS --max-time 5 "${BASE_URL}/api/health" 2>/dev/null || true)"
  if [[ "${health}" == *'"status":"ok"'* && "${health}" == *'"db":"ok"'* ]]; then
    break
  fi
  sleep 2
done

[[ "${health}" == *'"status":"ok"'* ]] || fail "health never reported status=ok (last: ${health:-<empty>})"
[[ "${health}" == *'"db":"ok"'* ]] || fail "health never reported db=ok (last: ${health})"
pass "GET /api/health -> ${health}"

# 2. SPA shell served by nginx.
index="$(curl -fsS --max-time 10 "${BASE_URL}/")" || fail "GET / did not return 2xx"
[[ "${index}" == *'<div id="root">'* ]] || fail "GET / is not the SPA shell"
[[ "${index}" == *'type="module"'* ]] || fail "GET / has no module script tag"
pass "GET / returns the SPA shell"

# 3. Deep route falls back to index.html (React Router history mode).
status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "${BASE_URL}/rooms/smoke-test")"
[[ "${status}" == "200" ]] || fail "deep route /rooms/smoke-test -> ${status}, expected 200"
pass "deep route /rooms/smoke-test falls back to index.html"

# 4. /api is proxied, not swallowed by the SPA fallback.
status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "${BASE_URL}/api/does-not-exist")"
[[ "${status}" == "404" ]] || fail "/api/does-not-exist -> ${status}, expected 404 from the backend"
pass "/api/* is proxied to the backend"

# 5. WebSocket upgrade reaches the app on the same origin. No Origin header
#    means admission refuses with 403 invalid_origin *before* touching the
#    database, which proves nginx forwarded the upgrade, not a plain GET.
ws_body="$(mktemp)"
ws_status="$(curl -sS -o "${ws_body}" -w '%{http_code}' --max-time 10 \
  -H 'Connection: Upgrade' \
  -H 'Upgrade: websocket' \
  -H 'Sec-WebSocket-Version: 13' \
  -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' \
  "${BASE_URL}/api/ws/rooms/00000000-0000-0000-0000-000000000000" || true)"
ws_payload="$(cat "${ws_body}")"
rm -f "${ws_body}"

[[ "${ws_status}" == "403" ]] || fail "WS upgrade -> ${ws_status}, expected 403 invalid_origin (payload: ${ws_payload})"
[[ "${ws_payload}" == *invalid_origin* ]] || fail "WS refusal has no invalid_origin payload (payload: ${ws_payload})"
pass "WS upgrade on /api/ws/* reaches the backend (403 invalid_origin)"

echo "smoke: all checks passed against ${BASE_URL}"
