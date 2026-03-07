from datetime import datetime
from pydantic import BaseModel


class ChecklistItemCreate(BaseModel):
    label: str
    required: bool = True


class ChecklistItemUpdate(BaseModel):
    done: bool


class ChecklistItemOut(BaseModel):
    id: int
    ticket_id: int
    label: str
    required: bool
    done: bool
    done_by_user_id: int | None
    done_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True
