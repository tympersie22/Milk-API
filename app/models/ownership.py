import uuid
import sqlalchemy as sa
from sqlalchemy import Boolean, Date, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Ownership(Base, TimestampMixin):
    __tablename__ = "ownerships"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    property_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("properties.id"), index=True)
    owner_name_encrypted: Mapped[bytes] = mapped_column(sa.LargeBinary, nullable=False)
    owner_nida_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    owner_type: Mapped[str] = mapped_column(String(50))
    owner_nationality: Mapped[str | None] = mapped_column(String(3), nullable=True)
    acquired_date: Mapped[sa.Date | None] = mapped_column(Date, nullable=True)
    acquisition_method: Mapped[str | None] = mapped_column(String(50), nullable=True)
    transfer_ref: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_current: Mapped[bool] = mapped_column(Boolean, default=True)
    has_mortgage: Mapped[bool] = mapped_column(Boolean, default=False)
    has_caveat: Mapped[bool] = mapped_column(Boolean, default=False)
    has_lien: Mapped[bool] = mapped_column(Boolean, default=False)
    encumbrance_details: Mapped[dict | None] = mapped_column(sa.JSON, nullable=True)
    # Owner privacy: when True, owner identity is masked in API responses
    privacy_opt_out: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
