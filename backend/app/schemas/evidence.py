from datetime import datetime
from pydantic import BaseModel, Field


class AttachmentCreate(BaseModel):
    filename: str
    content_type: str = "image/jpeg"
    size_bytes: int = 0


class AttachmentOut(BaseModel):
    id: int
    ticket_id: int
    kind: str
    filename: str
    content_type: str
    size_bytes: int
    created_by_user_id: int | None
    created_at: datetime

    class Config:
        from_attributes = True


class SignatureUpsert(BaseModel):
    signer_name: str
    signer_role: str | None = None
    image_base64: str = Field(min_length=16)


class SignatureOut(BaseModel):
    id: int
    ticket_id: int
    signer_name: str
    signer_role: str | None
    created_by_user_id: int | None
    created_at: datetime

    class Config:
        from_attributes = True
