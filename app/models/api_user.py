import uuid
import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, Enum, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin
from app.models.enums import ApiTier


class ApiUser(Base, TimestampMixin):
    __tablename__ = "api_users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    company: Mapped[str | None] = mapped_column(String(200), nullable=True)
    tier: Mapped[ApiTier] = mapped_column(Enum(ApiTier, name="api_tier"), default=ApiTier.free)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    monthly_quota: Mapped[int] = mapped_column(Integer, default=100)
    requests_this_month: Mapped[int] = mapped_column(Integer, default=0)
    quota_reset_at: Mapped[sa.DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    nida_verified: Mapped[bool] = mapped_column(Boolean, default=False)
