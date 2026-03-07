# Asistencias Solete App

Implementación inicial del MVP (Sprint 2):
- `backend/` API FastAPI con auth RBAC + tickets núcleo
- `mobile/` app React Native (Expo) con login + listado + detalle
- `docs/` notas de contrato API v1

## Quick start

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Mobile
```bash
cd mobile
npm install
npx expo start
```

## Credenciales demo
- admin@solete.local / admin123
- backoffice@solete.local / backoffice123
- tecnico1@solete.local / tecnico123


## One-command backend dev
```bash
make dev
```

## Mobile quick start
```bash
make mobile-install
make mobile-start
```

### Android real device tip
Set your server LAN IP in `mobile/app.json`:
```json
"extra": { "apiUrl": "http://<TU_IP_LAN>:8000/api/v1" }
```
Then restart Expo and ensure phone + server are on same Wi‑Fi.


## Smoke test rápido
```bash
make smoke
```

Opcional URL custom:
```bash
./scripts/smoke.sh http://localhost:8000
```


## Seed de datos demo
Con backend levantado:
```bash
make demo-seed
```

Opcional:
```bash
SEED_DAY=2026-03-10 SEED_TECH_ID=3 ./scripts/demo-seed.sh http://localhost:8000
```
