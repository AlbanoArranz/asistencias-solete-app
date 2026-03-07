from datetime import datetime
from pydantic import BaseModel


class TicketEventOut(BaseModel):
    id: int
    ticket_id: int
    actor_user_id: int | None
    event_type: str
    from_status: str | None
    to_status: str | None
    note: str | None
    created_at: datetime

    class Config:
        from_attributes = True
