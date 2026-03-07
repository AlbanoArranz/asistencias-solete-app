from datetime import datetime
from sqlalchemy import String, Text, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(50), default="new")
    priority: Mapped[str] = mapped_column(String(50), default="medium")
    technician_id: Mapped[int | None] = mapped_column(nullable=True)
    work_summary: Mapped[str] = mapped_column(Text, default="")
    customer_acceptance: Mapped[bool] = mapped_column(Boolean, default=False)
    scheduled_start_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    scheduled_end_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    assigned_by_user_id: Mapped[int | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
