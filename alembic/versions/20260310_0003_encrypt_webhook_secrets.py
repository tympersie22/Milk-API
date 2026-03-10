"""encrypt webhook secrets column

Revision ID: 20260310_0003
Revises: 20260310_0002
Create Date: 2026-03-10 12:00:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260310_0003"
down_revision = "20260310_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add the new encrypted column
    op.add_column(
        "webhook_subscriptions",
        sa.Column("secret_encrypted", sa.LargeBinary(), nullable=True),
    )

    # Migrate existing plaintext secrets to encrypted form.
    # We do this in Python so we can use the Fernet encryption helpers.
    conn = op.get_bind()
    rows = conn.execute(
        sa.text("SELECT id, secret FROM webhook_subscriptions WHERE secret IS NOT NULL")
    ).fetchall()

    if rows:
        from app.core.encryption import encrypt_text

        for row in rows:
            encrypted = encrypt_text(row.secret)
            conn.execute(
                sa.text("UPDATE webhook_subscriptions SET secret_encrypted = :enc WHERE id = :id"),
                {"enc": encrypted, "id": row.id},
            )

    # Drop old plaintext column, make new one non-nullable
    op.drop_column("webhook_subscriptions", "secret")
    op.alter_column(
        "webhook_subscriptions",
        "secret_encrypted",
        existing_type=sa.LargeBinary(),
        nullable=False,
    )


def downgrade() -> None:
    # Re-add plaintext column
    op.add_column(
        "webhook_subscriptions",
        sa.Column("secret", sa.String(64), nullable=True),
    )

    # Decrypt back to plaintext
    conn = op.get_bind()
    rows = conn.execute(
        sa.text("SELECT id, secret_encrypted FROM webhook_subscriptions WHERE secret_encrypted IS NOT NULL")
    ).fetchall()

    if rows:
        from app.core.encryption import decrypt_text

        for row in rows:
            plaintext = decrypt_text(row.secret_encrypted)
            conn.execute(
                sa.text("UPDATE webhook_subscriptions SET secret = :sec WHERE id = :id"),
                {"sec": plaintext, "id": row.id},
            )

    op.drop_column("webhook_subscriptions", "secret_encrypted")
    op.alter_column(
        "webhook_subscriptions",
        "secret",
        existing_type=sa.String(64),
        nullable=False,
    )
