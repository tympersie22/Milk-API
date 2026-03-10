import uuid
import sqlalchemy as sa
from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import PaymentProvider, PaymentStatus


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("api_users.id"), index=True)
    property_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("properties.id"), index=True, nullable=True
    )
    amount_tzs: Mapped[float] = mapped_column(Numeric(12, 2))
    amount_usd: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="TZS")
    provider: Mapped[PaymentProvider] = mapped_column(Enum(PaymentProvider, name="payment_provider"))
    provider_ref: Mapped[str | None] = mapped_column(String(200), index=True, nullable=True)
    phone_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    service_type: Mapped[str] = mapped_column(String(50))
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="payment_status"), default=PaymentStatus.pending, index=True
    )
    initiated_at: Mapped[sa.DateTime] = mapped_column(DateTime(timezone=True), server_default=sa.func.now())
    completed_at: Mapped[sa.DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_at: Mapped[sa.DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
