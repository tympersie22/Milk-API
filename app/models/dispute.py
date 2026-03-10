import uuid
import sqlalchemy as sa
from sqlalchemy import Boolean, Date, Enum, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin
from app.models.enums import DisputeStatus


class Dispute(Base, TimestampMixin):
    __tablename__ = "disputes"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    property_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("properties.id"), index=True, nullable=True
    )
    case_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    court_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    dispute_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[DisputeStatus] = mapped_column(Enum(DisputeStatus, name="dispute_status"), index=True)
    filed_date: Mapped[sa.Date | None] = mapped_column(Date, nullable=True)
    resolution_date: Mapped[sa.Date | None] = mapped_column(Date, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    affects_title: Mapped[bool] = mapped_column(Boolean, default=True)
    blocks_transfer: Mapped[bool] = mapped_column(Boolean, default=False)
