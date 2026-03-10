"""add sync_runs table for ingestion monitoring

Revision ID: 20260310_0005
Revises: 20260310_0004
Create Date: 2026-03-10 17:30:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260310_0005"
down_revision = "20260310_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sync_runs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("provider", sa.String(length=64), nullable=False),
        sa.Column("region", sa.String(length=16), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("processed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("succeeded_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sync_runs_provider", "sync_runs", ["provider"], unique=False)
    op.create_index("ix_sync_runs_region", "sync_runs", ["region"], unique=False)
    op.create_index("ix_sync_runs_status", "sync_runs", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_sync_runs_status", table_name="sync_runs")
    op.drop_index("ix_sync_runs_region", table_name="sync_runs")
    op.drop_index("ix_sync_runs_provider", table_name="sync_runs")
    op.drop_table("sync_runs")
