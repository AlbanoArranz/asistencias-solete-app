from datetime import datetime
from pydantic import BaseModel


class TicketCreate(BaseModel):
    title: str
    description: str = ""
    priority: str = "medium"
    technician_id: int | None = None


class TicketStatusUpdate(BaseModel):
    status: str


class TicketOut(BaseModel):
    id: int
    code: str
    title: str
    description: str
    status: str
    priority: str
    technician_id: int | None
    created_at: datetime

    class Config:
        from_attributes = True
