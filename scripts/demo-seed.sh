#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:8000}"
BACKOFFICE_EMAIL="${SEED_EMAIL:-backoffice@solete.local}"
BACKOFFICE_PASSWORD="${SEED_PASSWORD:-backoffice123}"
TECH_ID="${SEED_TECH_ID:-3}"
DAY="${SEED_DAY:-$(date +%F)}"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing dependency: $1"; exit 1; }
}

need_cmd curl
need_cmd python3

echo "[seed] BASE_URL=$BASE_URL DAY=$DAY TECH_ID=$TECH_ID"

LOGIN_JSON=$(curl -fsS -X POST "$BASE_URL/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$BACKOFFICE_EMAIL\",\"password\":\"$BACKOFFICE_PASSWORD\"}")
TOKEN=$(python3 -c 'import json,sys;print(json.loads(sys.stdin.read()).get("access_token",""))' <<< "$LOGIN_JSON")
[[ -n "$TOKEN" ]] || { echo "Seed login failed"; exit 1; }

create_ticket() {
  local title="$1"
  local desc="$2"
  local priority="$3"

  local TJSON
  TJSON=$(curl -fsS -X POST "$BASE_URL/api/v1/tickets" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"title\":\"$title\",\"description\":\"$desc\",\"priority\":\"$priority\",\"technician_id\":$TECH_ID}")

  local TID
  TID=$(python3 -c 'import json,sys;print(json.loads(sys.stdin.read()).get("id",""))' <<< "$TJSON")
  [[ -n "$TID" ]] || { echo "Could not parse ticket id"; exit 1; }

  curl -fsS -X PATCH "$BASE_URL/api/v1/tickets/$TID/schedule" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"scheduled_start_at\":\"${DAY}T09:00:00\",\"scheduled_end_at\":\"${DAY}T11:00:00\"}" >/dev/null

  for item in "Inspección inicial" "Prueba funcional" "Checklist seguridad"; do
    curl -fsS -X POST "$BASE_URL/api/v1/tickets/$TID/checklist" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d "{\"label\":\"$item\",\"required\":true}" >/dev/null
  done

  echo "created ticket_id=$TID title='$title'"
}

create_ticket "Canteadora NB7X - ajuste de arrastre" "Cliente reporta desvío en arrastre de tablero" "high"
create_ticket "Seccionadora NCG3021 - revisión de corte" "Ajuste de escuadra y test de repetibilidad" "medium"
create_ticket "Taladro CNC - error intermitente" "Diagnóstico eléctrico y revisión conectores" "high"

echo "✅ demo seed completed"
