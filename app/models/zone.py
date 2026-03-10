import uuid
import sqlalchemy as sa
from sqlalchemy import Date, Enum, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from geoalchemy2 import Geometry

from app.models.base import Base, TimestampMixin
from app.models.enums import LandType, RegionType

polygon_geom = Geometry(geometry_type="POLYGON", srid=4326, spatial_index=False).with_variant(
    Text(), "sqlite"
)


class Zone(Base, TimestampMixin):
    __tablename__ = "zones"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200))
    zone_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    region: Mapped[RegionType] = mapped_column(Enum(RegionType, name="region_type"), index=True)
    district: Mapped[str] = mapped_column(String(100), index=True)
    zone_type: Mapped[LandType] = mapped_column(Enum(LandType, name="land_type"))
    max_floors: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    max_coverage_pct: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    min_plot_size_sqm: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    setback_front_m: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    setback_side_m: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    allowed_uses: Mapped[list[str] | None] = mapped_column(sa.JSON, nullable=True)
    restricted_uses: Mapped[list[str] | None] = mapped_column(sa.JSON, nullable=True)
    boundary: Mapped[str] = mapped_column(polygon_geom)
    gazette_ref: Mapped[str | None] = mapped_column(String(100), nullable=True)
    effective_date: Mapped[sa.Date | None] = mapped_column(Date, nullable=True)
    data_source: Mapped[str | None] = mapped_column(String(50), nullable=True)
