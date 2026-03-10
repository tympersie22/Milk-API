import uuid
import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("api_users.id"), index=True)
    key_prefix: Mapped[str] = mapped_column(String(16), index=True)
    key_hash: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_used_at: Mapped[sa.DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[sa.DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    permissions: Mapped[list[str]] = mapped_column(JSON, default=["read"])
    created_at: Mapped[sa.DateTime] = mapped_column(DateTime(timezone=True), server_default=sa.func.now())
