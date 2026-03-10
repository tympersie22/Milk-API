import uuid

import sqlalchemy as sa
from sqlalchemy import Boolean, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Report(Base, TimestampMixin):
    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("api_users.id"), index=True)
    property_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("properties.id"), index=True)

    title_number: Mapped[str] = mapped_column(String(100), index=True)
    requested_format: Mapped[str] = mapped_column(String(16), default="json")
    status: Mapped[str] = mapped_column(String(20), default="processing", index=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    include_valuation: Mapped[bool] = mapped_column(Boolean, default=True)
    include_risk: Mapped[bool] = mapped_column(Boolean, default=True)
    include_comparables: Mapped[bool] = mapped_column(Boolean, default=True)
    include_zipa: Mapped[bool] = mapped_column(Boolean, default=False)

    report_json: Mapped[dict | None] = mapped_column(sa.JSON, nullable=True)
    report_pdf: Mapped[bytes | None] = mapped_column(sa.LargeBinary, nullable=True)
    completed_at: Mapped[sa.DateTime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
