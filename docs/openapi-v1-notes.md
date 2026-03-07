# OpenAPI v1 Notes (Sprint 2)

Endpoints iniciales implementados:
- POST /api/v1/auth/login
- GET /api/v1/auth/me
- GET /api/v1/tickets
- POST /api/v1/tickets
- GET /api/v1/tickets/{id}
- PATCH /api/v1/tickets/{id}/status
- GET /api/v1/tickets/{id}/events

Estados permitidos:
- new -> assigned|cancelled
- assigned -> in_progress|cancelled
- in_progress -> resolved|pending_material
- pending_material -> in_progress|cancelled
- resolved -> closed|in_progress


Filtros disponibles en listado:
- status
- technician_id (backoffice/admin)
