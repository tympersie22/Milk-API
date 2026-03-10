"""create async reports table

Revision ID: 20260310_0004
Revises: 20260310_0003
Create Date: 2026-03-10 16:00:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260310_0004"
down_revision = "20260310_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "reports",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("property_id", sa.Uuid(), nullable=False),
        sa.Column("title_number", sa.String(length=100), nullable=False),
        sa.Column("requested_format", sa.String(length=16), nullable=False, server_default="json"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="processing"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("include_valuation", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("include_risk", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("include_comparables", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("include_zipa", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("report_json", sa.JSON(), nullable=True),
        sa.Column("report_pdf", sa.LargeBinary(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["property_id"], ["properties.id"], ),
        sa.ForeignKeyConstraint(["user_id"], ["api_users.id"], ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_reports_user_id", "reports", ["user_id"], unique=False)
    op.create_index("ix_reports_property_id", "reports", ["property_id"], unique=False)
    op.create_index("ix_reports_title_number", "reports", ["title_number"], unique=False)
    op.create_index("ix_reports_status", "reports", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_reports_status", table_name="reports")
    op.drop_index("ix_reports_title_number", table_name="reports")
    op.drop_index("ix_reports_property_id", table_name="reports")
    op.drop_index("ix_reports_user_id", table_name="reports")
    op.drop_table("reports")
