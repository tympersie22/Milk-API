import uuid

import sqlalchemy as sa
from sqlalchemy import DateTime, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SyncRun(Base):
    __tablename__ = "sync_runs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    provider: Mapped[str] = mapped_column(String(64), index=True)
    region: Mapped[str | None] = mapped_column(String(16), index=True, nullable=True)
    status: Mapped[str] = mapped_column(String(20), index=True)

    processed_count: Mapped[int] = mapped_column(Integer, default=0)
    succeeded_count: Mapped[int] = mapped_column(Integer, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, default=0)

    started_at: Mapped[sa.DateTime] = mapped_column(DateTime(timezone=True), server_default=sa.func.now())
    completed_at: Mapped[sa.DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
