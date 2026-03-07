from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.ticket import Ticket
from app.models.user import User
from app.schemas.ticket import TicketCreate, TicketOut, TicketStatusUpdate
from app.api.deps import get_current_user, require_roles

router = APIRouter(prefix="/tickets", tags=["tickets"])

ALLOWED_TRANSITIONS = {
    "new": {"assigned", "cancelled"},
    "assigned": {"in_progress", "cancelled"},
    "in_progress": {"resolved", "pending_material"},
    "pending_material": {"in_progress", "cancelled"},
    "resolved": {"closed", "in_progress"},
    "closed": set(),
    "cancelled": set(),
}


@router.get("", response_model=list[TicketOut])
def list_tickets(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Ticket)
    if user.role == "technician":
        q = q.filter(Ticket.technician_id == user.id)
    return q.order_by(Ticket.created_at.desc()).all()


@router.post("", response_model=TicketOut)
def create_ticket(
    payload: TicketCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("backoffice", "admin")),
):
    code = f"AST-{int(datetime.utcnow().timestamp())}"
    ticket = Ticket(
        code=code,
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        technician_id=payload.technician_id,
        status="assigned" if payload.technician_id else "new",
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


@router.get("/{ticket_id}", response_model=TicketOut)
def get_ticket(ticket_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    t = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Not found")
    if user.role == "technician" and t.technician_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return t


@router.patch("/{ticket_id}/status", response_model=TicketOut)
def update_status(
    ticket_id: int,
    payload: TicketStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    t = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Not found")
    if user.role == "technician" and t.technician_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    nxt = payload.status
    if nxt not in ALLOWED_TRANSITIONS.get(t.status, set()):
        raise HTTPException(status_code=400, detail=f"Transition {t.status} -> {nxt} not allowed")

    t.status = nxt
    db.commit()
    db.refresh(t)
    return t
