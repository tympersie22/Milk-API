import uuid
import sqlalchemy as sa
from sqlalchemy import Boolean, Date, Enum, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin
from app.models.enums import LandType, OwnershipType, RegionType

class Property(Base, TimestampMixin):
    __tablename__ = "properties"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    title_number: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    region: Mapped[RegionType] = mapped_column(Enum(RegionType, name="region_type"), index=True)
    district: Mapped[str] = mapped_column(String(100), index=True)
    ward: Mapped[str | None] = mapped_column(String(100), nullable=True)
    street: Mapped[str | None] = mapped_column(String(200), nullable=True)
    area_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    land_type: Mapped[LandType] = mapped_column(Enum(LandType, name="land_type"), index=True)
    ownership_type: Mapped[OwnershipType] = mapped_column(
        Enum(OwnershipType, name="ownership_type")
    )
    area_sqm: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    lease_start_date: Mapped[Date | None] = mapped_column(Date, nullable=True)
    lease_end_date: Mapped[Date | None] = mapped_column(Date, nullable=True)
    lease_duration_years: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    # Stored as WKT in ORM for portability; migrations create PostGIS geometry in PostgreSQL.
    boundary: Mapped[str | None] = mapped_column(Text, nullable=True)
    centroid: Mapped[str | None] = mapped_column(Text, nullable=True)
    survey_plan_ref: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    last_verified_at: Mapped[sa.DateTime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    data_source: Mapped[str] = mapped_column(String(50), default="manual")
    data_confidence: Mapped[float | None] = mapped_column(Numeric(3, 2), nullable=True)
    foreign_eligible: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    zipa_registered: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    coastal_buffer_zone: Mapped[bool] = mapped_column(Boolean, default=False)
    heritage_zone: Mapped[bool] = mapped_column(Boolean, default=False)
    deleted_at: Mapped[sa.DateTime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
