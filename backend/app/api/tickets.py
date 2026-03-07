from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.ticket import Ticket
from app.models.ticket_event import TicketEvent
from app.models.attachment import Attachment
from app.models.signature import Signature
from app.models.checklist_item import ChecklistItem
from app.models.user import User
from app.schemas.ticket import TicketCreate, TicketOut, TicketStatusUpdate, CloseSummaryUpdate, TicketAssignUpdate, TicketScheduleUpdate
from app.schemas.ticket_event import TicketEventOut
from app.schemas.checklist import ChecklistItemCreate, ChecklistItemOut, ChecklistItemUpdate
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
def list_tickets(
    status: str | None = Query(default=None),
    technician_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Ticket)

    if user.role == "technician":
        q = q.filter(Ticket.technician_id == user.id)
    else:
        if technician_id is not None:
            q = q.filter(Ticket.technician_id == technician_id)

    if status:
        q = q.filter(Ticket.status == status)

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

    db.add(
        TicketEvent(
            ticket_id=ticket.id,
            event_type="created",
            from_status=None,
            to_status=ticket.status,
            note="Ticket created",
        )
    )
    db.commit()

    return ticket


@router.get("/{ticket_id}", response_model=TicketOut)
def get_ticket(ticket_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    t = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Not found")
    if user.role == "technician" and t.technician_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return t


@router.get("/{ticket_id}/events", response_model=list[TicketEventOut])
def get_ticket_events(ticket_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    t = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Not found")
    if user.role == "technician" and t.technician_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    return db.query(TicketEvent).filter(TicketEvent.ticket_id == ticket_id).order_by(TicketEvent.created_at.desc()).all()


@router.get("/{ticket_id}/checklist", response_model=list[ChecklistItemOut])
def list_checklist(ticket_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    t = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Not found")
    if user.role == "technician" and t.technician_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return db.query(ChecklistItem).filter(ChecklistItem.ticket_id == ticket_id).order_by(ChecklistItem.id.asc()).all()


@router.post("/{ticket_id}/checklist", response_model=ChecklistItemOut)
def create_checklist_item(
    ticket_id: int,
    payload: ChecklistItemCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("backoffice", "admin")),
):
    t = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Not found")
    item = ChecklistItem(ticket_id=ticket_id, label=payload.label, required=payload.required)
    db.add(item)
    db.add(TicketEvent(ticket_id=ticket_id, event_type="checklist_item_created", note=payload.label))
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{ticket_id}/checklist/{item_id}", response_model=ChecklistItemOut)
def update_checklist_item(
    ticket_id: int,
    item_id: int,
    payload: ChecklistItemUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    t = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Not found")
    if user.role == "technician" and t.technician_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    item = db.query(ChecklistItem).filter(ChecklistItem.id == item_id, ChecklistItem.ticket_id == ticket_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")

    item.done = payload.done
    item.done_by_user_id = user.id if payload.done else None
    item.done_at = datetime.utcnow() if payload.done else None
    db.add(TicketEvent(ticket_id=ticket_id, actor_user_id=user.id, event_type="checklist_item_updated", note=f"{item.label}:{item.done}"))
    db.commit()
    db.refresh(item)
    return item


@router.put("/{ticket_id}/close-summary", response_model=TicketOut)
def upsert_close_summary(
    ticket_id: int,
    payload: CloseSummaryUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    t = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Not found")
    if user.role == "technician" and t.technician_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    t.work_summary = payload.work_summary.strip()
    t.customer_acceptance = payload.customer_acceptance
    db.add(TicketEvent(ticket_id=ticket_id, actor_user_id=user.id, event_type="close_summary_upserted", note=t.work_summary[:80]))
    db.commit()
    db.refresh(t)
    return t


@router.get("/schedule", response_model=list[TicketOut])
def get_schedule(
    day: str | None = Query(default=None),
    technician_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Ticket)
    if user.role == "technician":
        q = q.filter(Ticket.technician_id == user.id)
    elif technician_id is not None:
        q = q.filter(Ticket.technician_id == technician_id)

    if day:
        q = q.filter(Ticket.scheduled_start_at.is_not(None))
        q = q.filter(Ticket.scheduled_start_at >= f"{day} 00:00:00")
        q = q.filter(Ticket.scheduled_start_at <= f"{day} 23:59:59")

    return q.order_by(Ticket.scheduled_start_at.asc().nullslast(), Ticket.created_at.desc()).all()


@router.patch("/{ticket_id}/assign", response_model=TicketOut)
def assign_ticket(
    ticket_id: int,
    payload: TicketAssignUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("backoffice", "admin")),
):
    t = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Not found")

    prev = t.technician_id
    t.technician_id = payload.technician_id
    t.assigned_by_user_id = user.id
    if t.status == "new":
        t.status = "assigned"

    db.add(TicketEvent(
        ticket_id=t.id,
        actor_user_id=user.id,
        event_type="technician_reassigned" if prev else "technician_assigned",
        note=f"from={prev} to={payload.technician_id}",
    ))
    db.commit()
    db.refresh(t)
    return t


@router.patch("/{ticket_id}/schedule", response_model=TicketOut)
def schedule_ticket(
    ticket_id: int,
    payload: TicketScheduleUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("backoffice", "admin")),
):
    t = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Not found")

    t.scheduled_start_at = payload.scheduled_start_at
    t.scheduled_end_at = payload.scheduled_end_at

    db.add(TicketEvent(
        ticket_id=t.id,
        actor_user_id=user.id,
        event_type="scheduled",
        note=f"start={payload.scheduled_start_at} end={payload.scheduled_end_at}",
    ))
    db.commit()
    db.refresh(t)
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

    # cierre con evidencia mínima + checklist + resumen
    if nxt == "closed":
        photos_count = db.query(Attachment).filter(Attachment.ticket_id == t.id).count()
        sig = db.query(Signature).filter(Signature.ticket_id == t.id).first()
        required_items = db.query(ChecklistItem).filter(ChecklistItem.ticket_id == t.id, ChecklistItem.required == True).all()
        required_done = all(i.done for i in required_items) if required_items else False
        if photos_count < 1 or not sig:
            raise HTTPException(status_code=400, detail="Closing requires at least 1 photo and signature")
        if not required_done:
            raise HTTPException(status_code=400, detail="Closing requires required checklist completed")
        if not t.work_summary.strip() or not t.customer_acceptance:
            raise HTTPException(status_code=400, detail="Closing requires close summary and customer acceptance")

    prev = t.status
    t.status = nxt
    db.add(
        TicketEvent(
            ticket_id=t.id,
            actor_user_id=user.id,
            event_type="status_change",
            from_status=prev,
            to_status=nxt,
            note=f"Status changed by {user.email}",
        )
    )
    db.commit()
    db.refresh(t)
    return t
