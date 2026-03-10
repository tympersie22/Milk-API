import uuid
import sqlalchemy as sa
from sqlalchemy import Boolean, Date, Enum, ForeignKey, Numeric, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import LandType


class Valuation(Base):
    __tablename__ = "valuations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    property_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("properties.id"), index=True)
    estimated_value_tzs: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    estimated_value_usd: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    confidence_interval_low: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    confidence_interval_high: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    confidence_pct: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    comparables_count: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    comparables: Mapped[dict | None] = mapped_column(sa.JSON, nullable=True)
    valuation_method: Mapped[str | None] = mapped_column(String(50), nullable=True)
    model_version: Mapped[str | None] = mapped_column(String(20), nullable=True)
    calculated_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())


class PriceHistory(Base):
    __tablename__ = "price_history"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    property_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("properties.id"), index=True, nullable=True
    )
    district: Mapped[str | None] = mapped_column(String(100), index=True, nullable=True)
    area_name: Mapped[str | None] = mapped_column(String(200), index=True, nullable=True)
    transaction_date: Mapped[sa.Date] = mapped_column(Date)
    price_tzs: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    price_usd: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    price_per_sqm_tzs: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    area_sqm: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    land_type: Mapped[LandType | None] = mapped_column(
        Enum(LandType, name="land_type"), nullable=True
    )
    source: Mapped[str] = mapped_column(String(50))
    source_ref: Mapped[str | None] = mapped_column(String(200), nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())
