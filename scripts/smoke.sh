#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:8000}"
EMAIL="${SMOKE_EMAIL:-tecnico1@solete.local}"
PASSWORD="${SMOKE_PASSWORD:-tecnico123}"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing dependency: $1"; exit 1; }
}

need_cmd curl
need_cmd python3

curl_json() {
  curl -fsS --connect-timeout 5 --max-time 20 "$@"
}

echo "[smoke] BASE_URL=$BASE_URL"

echo "[1/4] health"
HEALTH=$(curl_json "$BASE_URL/health")
echo "$HEALTH" | grep -q '"ok"' || { echo "Health check failed"; exit 1; }

echo "[2/4] login"
LOGIN_JSON=$(curl_json -X POST "$BASE_URL/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
TOKEN=$(python3 -c 'import json,sys;print(json.loads(sys.stdin.read()).get("access_token",""))' <<< "$LOGIN_JSON")
[[ -n "$TOKEN" ]] || { echo "Login failed: no token"; exit 1; }

echo "[3/4] auth/me"
ME_JSON=$(curl_json "$BASE_URL/api/v1/auth/me" -H "Authorization: Bearer $TOKEN")
echo "$ME_JSON" | grep -q '"email"' || { echo "/auth/me failed"; exit 1; }

echo "[4/4] tickets list"
TICKETS_JSON=$(curl_json "$BASE_URL/api/v1/tickets" -H "Authorization: Bearer $TOKEN")
python3 - << 'PY' <<< "$TICKETS_JSON"
import json,sys
obj=json.loads(sys.stdin.read())
assert isinstance(obj,list), 'tickets response is not a list'
print(f"tickets_count={len(obj)}")
PY

echo "✅ smoke ok"
