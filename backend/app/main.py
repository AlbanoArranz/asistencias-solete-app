from fastapi import FastAPI
from app.core.config import settings
from app.db.session import Base, engine, SessionLocal
from app.models.user import User
from app.models.ticket import Ticket
from app.models.ticket_event import TicketEvent
from app.models.attachment import Attachment
from app.models.signature import Signature
from app.models.checklist_item import ChecklistItem
from app.models.notification import Notification
from app.services.security import hash_password
from app.api.auth import router as auth_router
from app.api.tickets import router as tickets_router
from app.api.evidence import router as evidence_router
from app.api.notifications import router as notifications_router

app = FastAPI(title=settings.app_name)


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    if not db.query(User).first():
        db.add_all(
            [
                User(email="admin@solete.local", full_name="Admin", role="admin", password_hash=hash_password("admin123")),
                User(email="backoffice@solete.local", full_name="Backoffice", role="backoffice", password_hash=hash_password("backoffice123")),
                User(email="tecnico1@solete.local", full_name="Tecnico 1", role="technician", password_hash=hash_password("tecnico123")),
            ]
        )
        db.commit()
    db.close()


@app.get("/health")
def health():
    return {"ok": True}


app.include_router(auth_router, prefix="/api/v1")
app.include_router(tickets_router, prefix="/api/v1")
app.include_router(evidence_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
