from datetime import UTC, datetime
import uuid
from sqlalchemy import JSON, DateTime, Enum, ForeignKey, Numeric, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import RiskLevel


class RiskScore(Base):
    __tablename__ = "risk_scores"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    property_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("properties.id"), index=True)
    overall_score: Mapped[float] = mapped_column(Numeric(4, 2))
    risk_level: Mapped[RiskLevel] = mapped_column(Enum(RiskLevel, name="risk_level"), index=True)
    ownership_chain_score: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    dispute_score: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    encumbrance_score: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    zone_compliance_score: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    documentation_score: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    data_freshness_score: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    risk_factors: Mapped[dict] = mapped_column(JSON)
    recommendations: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    algorithm_version: Mapped[str] = mapped_column(String(20), default="v1")
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    valid_until: Mapped[datetime] = mapped_column(DateTime(timezone=True))
