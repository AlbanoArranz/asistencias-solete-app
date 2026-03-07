from datetime import datetime
from pydantic import BaseModel


class TicketCreate(BaseModel):
    title: str
    description: str = ""
    priority: str = "medium"
    technician_id: int | None = None


class TicketStatusUpdate(BaseModel):
    status: str


class TicketAssignUpdate(BaseModel):
    technician_id: int


class TicketScheduleUpdate(BaseModel):
    scheduled_start_at: datetime | None = None
    scheduled_end_at: datetime | None = None


class CloseSummaryUpdate(BaseModel):
    work_summary: str
    customer_acceptance: bool = True


class TicketOut(BaseModel):
    id: int
    code: str
    title: str
    description: str
    status: str
    priority: str
    technician_id: int | None
    work_summary: str
    customer_acceptance: bool
    scheduled_start_at: datetime | None
    scheduled_end_at: datetime | None
    assigned_by_user_id: int | None
    created_at: datetime

    class Config:
        from_attributes = True
