from datetime import datetime
from sqlalchemy import String, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class Signature(Base):
    __tablename__ = "signatures"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    ticket_id: Mapped[int] = mapped_column(index=True, unique=True)
    signer_name: Mapped[str] = mapped_column(String(255))
    signer_role: Mapped[str | None] = mapped_column(String(100), nullable=True)
    image_base64: Mapped[str] = mapped_column(Text)
    created_by_user_id: Mapped[int | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
