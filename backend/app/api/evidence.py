from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.ticket import Ticket
from app.models.attachment import Attachment
from app.models.signature import Signature
from app.models.ticket_event import TicketEvent
from app.schemas.evidence import AttachmentCreate, AttachmentOut, SignatureUpsert, SignatureOut

router = APIRouter(prefix="/tickets", tags=["evidence"])


def _get_ticket_or_404(ticket_id: int, db: Session) -> Ticket:
    t = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return t


@router.get("/{ticket_id}/attachments", response_model=list[AttachmentOut])
def list_attachments(ticket_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    t = _get_ticket_or_404(ticket_id, db)
    if user.role == "technician" and t.technician_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return db.query(Attachment).filter(Attachment.ticket_id == ticket_id).order_by(Attachment.created_at.desc()).all()


@router.post("/{ticket_id}/attachments", response_model=AttachmentOut)
def create_attachment(ticket_id: int, payload: AttachmentCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    t = _get_ticket_or_404(ticket_id, db)
    if user.role == "technician" and t.technician_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    a = Attachment(
        ticket_id=ticket_id,
        kind="photo",
        filename=payload.filename,
        content_type=payload.content_type,
        size_bytes=payload.size_bytes,
        created_by_user_id=user.id,
    )
    db.add(a)
    db.add(TicketEvent(ticket_id=ticket_id, actor_user_id=user.id, event_type="attachment_added", note=payload.filename))
    db.commit()
    db.refresh(a)
    return a


@router.get("/{ticket_id}/signature", response_model=SignatureOut)
def get_signature(ticket_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    t = _get_ticket_or_404(ticket_id, db)
    if user.role == "technician" and t.technician_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    s = db.query(Signature).filter(Signature.ticket_id == ticket_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Signature not found")
    return s


@router.put("/{ticket_id}/signature", response_model=SignatureOut)
def upsert_signature(ticket_id: int, payload: SignatureUpsert, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    t = _get_ticket_or_404(ticket_id, db)
    if user.role == "technician" and t.technician_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    s = db.query(Signature).filter(Signature.ticket_id == ticket_id).first()
    if not s:
        s = Signature(
            ticket_id=ticket_id,
            signer_name=payload.signer_name,
            signer_role=payload.signer_role,
            image_base64=payload.image_base64,
            created_by_user_id=user.id,
        )
        db.add(s)
    else:
        s.signer_name = payload.signer_name
        s.signer_role = payload.signer_role
        s.image_base64 = payload.image_base64

    db.add(TicketEvent(ticket_id=ticket_id, actor_user_id=user.id, event_type="signature_upserted", note=payload.signer_name))
    db.commit()
    db.refresh(s)
    return s
