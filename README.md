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
