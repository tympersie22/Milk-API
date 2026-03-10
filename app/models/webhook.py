import uuid
import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, LargeBinary, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class WebhookSubscription(Base):
    __tablename__ = "webhook_subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("api_users.id"), index=True)
    url: Mapped[str] = mapped_column(String(500))
    events: Mapped[list[str]] = mapped_column(JSON)
    secret_encrypted: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    failure_count: Mapped[int] = mapped_column(sa.Integer, default=0)
    last_triggered_at: Mapped[sa.DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[sa.DateTime] = mapped_column(DateTime(timezone=True), server_default=sa.func.now())

    def set_secret(self, plaintext: str) -> None:
        from app.core.encryption import encrypt_text
        self.secret_encrypted = encrypt_text(plaintext)

    def get_secret(self) -> str:
        from app.core.encryption import decrypt_text
        return decrypt_text(self.secret_encrypted)
