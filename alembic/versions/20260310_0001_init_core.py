"""init production schema with enums and postgis

Revision ID: 20260310_0001
Revises:
Create Date: 2026-03-10
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from geoalchemy2 import Geometry


revision = "20260310_0001"
down_revision = None
branch_labels = None
depends_on = None


region_type = postgresql.ENUM("mainland", "zanzibar", name="region_type")
land_type = postgresql.ENUM(
    "residential",
    "commercial",
    "agricultural",
    "industrial",
    "mixed_use",
    "government",
    "conservation",
    name="land_type",
)
ownership_type = postgresql.ENUM(
    "freehold",
    "leasehold",
    "customary",
    "granted_right_of_occupancy",
    "residential_license",
    name="ownership_type",
)
risk_level = postgresql.ENUM("low", "medium", "high", "critical", name="risk_level")
dispute_status = postgresql.ENUM("filed", "hearing", "resolved", "appealed", name="dispute_status")
payment_status = postgresql.ENUM(
    "pending", "processing", "completed", "failed", "refunded", name="payment_status"
)
payment_provider = postgresql.ENUM(
    "mpesa",
    "tigo_pesa",
    "airtel_money",
    "halo_pesa",
    "card",
    "bank_transfer",
    name="payment_provider",
)
api_tier = postgresql.ENUM("free", "basic", "professional", "enterprise", name="api_tier")


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"
    polygon_type = Geometry(geometry_type="POLYGON", srid=4326) if is_postgres else sa.Text()
    point_type = Geometry(geometry_type="POINT", srid=4326) if is_postgres else sa.Text()

    if is_postgres:
        op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
        op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    for enum in [
        region_type,
        land_type,
        ownership_type,
        risk_level,
        dispute_status,
        payment_status,
        payment_provider,
        api_tier,
    ]:
        enum.create(bind, checkfirst=True)

    op.create_table(
        "properties",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("title_number", sa.String(length=100), nullable=False, unique=True),
        sa.Column("region", sa.Enum(name="region_type", create_type=False), nullable=False),
        sa.Column("district", sa.String(length=100), nullable=False),
        sa.Column("ward", sa.String(length=100), nullable=True),
        sa.Column("street", sa.String(length=200), nullable=True),
        sa.Column("area_name", sa.String(length=200), nullable=True),
        sa.Column("land_type", sa.Enum(name="land_type", create_type=False), nullable=False),
        sa.Column(
            "ownership_type",
            sa.Enum(name="ownership_type", create_type=False),
            nullable=False,
        ),
        sa.Column("area_sqm", sa.Numeric(12, 2), nullable=True),
        sa.Column("lease_start_date", sa.Date(), nullable=True),
        sa.Column("lease_end_date", sa.Date(), nullable=True),
        sa.Column("lease_duration_years", sa.Integer(), nullable=True),
        sa.Column("boundary", polygon_type, nullable=True),
        sa.Column("centroid", point_type, nullable=True),
        sa.Column("survey_plan_ref", sa.String(length=100), nullable=True),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("last_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("data_source", sa.String(length=50), nullable=False),
        sa.Column("data_confidence", sa.Numeric(3, 2), nullable=True),
        sa.Column("foreign_eligible", sa.Boolean(), nullable=True),
        sa.Column("zipa_registered", sa.Boolean(), nullable=True),
        sa.Column("coastal_buffer_zone", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("heritage_zone", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_properties_title_number", "properties", ["title_number"])
    op.create_index("ix_properties_region", "properties", ["region"])
    op.create_index("ix_properties_district", "properties", ["district"])
    op.create_index("ix_properties_land_type", "properties", ["land_type"])
    if is_postgres:
        op.create_index("idx_properties_boundary", "properties", ["boundary"], postgresql_using="gist")
        op.create_index("idx_properties_centroid", "properties", ["centroid"], postgresql_using="gist")

    op.create_table(
        "api_users",
        sa.Column("id", sa.Uuid(), nullable=False, primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False, unique=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("company", sa.String(length=200), nullable=True),
        sa.Column("tier", sa.Enum(name="api_tier", create_type=False), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("monthly_quota", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("requests_this_month", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("quota_reset_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("password_hash", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("nida_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_api_users_email", "api_users", ["email"])

    op.create_table(
        "api_keys",
        sa.Column("id", sa.Uuid(), nullable=False, primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("api_users.id"), nullable=False),
        sa.Column("key_prefix", sa.String(length=16), nullable=False),
        sa.Column("key_hash", sa.String(length=64), nullable=False, unique=True),
        sa.Column("name", sa.String(length=100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("permissions", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_api_keys_user_id", "api_keys", ["user_id"])
    op.create_index("ix_api_keys_key_prefix", "api_keys", ["key_prefix"])

    op.create_table(
        "ownerships",
        sa.Column("id", sa.Uuid(), nullable=False, primary_key=True),
        sa.Column("property_id", sa.Uuid(), sa.ForeignKey("properties.id"), nullable=False),
        sa.Column("owner_name_encrypted", sa.LargeBinary(), nullable=False),
        sa.Column("owner_nida_hash", sa.String(length=64), nullable=True),
        sa.Column("owner_type", sa.String(length=50), nullable=False),
        sa.Column("owner_nationality", sa.String(length=3), nullable=True),
        sa.Column("acquired_date", sa.Date(), nullable=True),
        sa.Column("acquisition_method", sa.String(length=50), nullable=True),
        sa.Column("transfer_ref", sa.String(length=100), nullable=True),
        sa.Column("is_current", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("has_mortgage", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("has_caveat", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("has_lien", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("encumbrance_details", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("idx_ownerships_property", "ownerships", ["property_id"])

    op.create_table(
        "zones",
        sa.Column("id", sa.Uuid(), nullable=False, primary_key=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("zone_code", sa.String(length=50), nullable=True),
        sa.Column("region", sa.Enum(name="region_type", create_type=False), nullable=False),
        sa.Column("district", sa.String(length=100), nullable=False),
        sa.Column("zone_type", sa.Enum(name="land_type", create_type=False), nullable=False),
        sa.Column("max_floors", sa.Integer(), nullable=True),
        sa.Column("max_coverage_pct", sa.Numeric(5, 2), nullable=True),
        sa.Column("min_plot_size_sqm", sa.Numeric(12, 2), nullable=True),
        sa.Column("setback_front_m", sa.Numeric(6, 2), nullable=True),
        sa.Column("setback_side_m", sa.Numeric(6, 2), nullable=True),
        sa.Column("allowed_uses", sa.JSON(), nullable=True),
        sa.Column("restricted_uses", sa.JSON(), nullable=True),
        sa.Column("boundary", polygon_type, nullable=False),
        sa.Column("gazette_ref", sa.String(length=100), nullable=True),
        sa.Column("effective_date", sa.Date(), nullable=True),
        sa.Column("data_source", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("idx_zones_region", "zones", ["region"])
    if is_postgres:
        op.create_index("idx_zones_boundary", "zones", ["boundary"], postgresql_using="gist")

    op.create_table(
        "disputes",
        sa.Column("id", sa.Uuid(), nullable=False, primary_key=True),
        sa.Column("property_id", sa.Uuid(), sa.ForeignKey("properties.id"), nullable=True),
        sa.Column("case_number", sa.String(length=100), nullable=True),
        sa.Column("court_name", sa.String(length=200), nullable=True),
        sa.Column("dispute_type", sa.String(length=100), nullable=True),
        sa.Column("status", sa.Enum(name="dispute_status", create_type=False), nullable=False),
        sa.Column("filed_date", sa.Date(), nullable=True),
        sa.Column("resolution_date", sa.Date(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("affects_title", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("blocks_transfer", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("idx_disputes_property", "disputes", ["property_id"])
    op.create_index("idx_disputes_status", "disputes", ["status"])

    op.create_table(
        "risk_scores",
        sa.Column("id", sa.Uuid(), nullable=False, primary_key=True),
        sa.Column("property_id", sa.Uuid(), sa.ForeignKey("properties.id"), nullable=False),
        sa.Column("overall_score", sa.Numeric(4, 2), nullable=False),
        sa.Column("risk_level", sa.Enum(name="risk_level", create_type=False), nullable=False),
        sa.Column("ownership_chain_score", sa.Numeric(4, 2), nullable=True),
        sa.Column("dispute_score", sa.Numeric(4, 2), nullable=True),
        sa.Column("encumbrance_score", sa.Numeric(4, 2), nullable=True),
        sa.Column("zone_compliance_score", sa.Numeric(4, 2), nullable=True),
        sa.Column("documentation_score", sa.Numeric(4, 2), nullable=True),
        sa.Column("data_freshness_score", sa.Numeric(4, 2), nullable=True),
        sa.Column("risk_factors", sa.JSON(), nullable=False),
        sa.Column("recommendations", sa.JSON(), nullable=True),
        sa.Column("algorithm_version", sa.String(length=20), nullable=False),
        sa.Column("calculated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("valid_until", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("idx_risk_property", "risk_scores", ["property_id"])
    op.create_index("idx_risk_level", "risk_scores", ["risk_level"])

    op.create_table(
        "valuations",
        sa.Column("id", sa.Uuid(), nullable=False, primary_key=True),
        sa.Column("property_id", sa.Uuid(), sa.ForeignKey("properties.id"), nullable=False),
        sa.Column("estimated_value_tzs", sa.Numeric(15, 2), nullable=True),
        sa.Column("estimated_value_usd", sa.Numeric(15, 2), nullable=True),
        sa.Column("confidence_interval_low", sa.Numeric(15, 2), nullable=True),
        sa.Column("confidence_interval_high", sa.Numeric(15, 2), nullable=True),
        sa.Column("confidence_pct", sa.Numeric(5, 2), nullable=True),
        sa.Column("comparables_count", sa.Integer(), nullable=True),
        sa.Column("comparables", sa.JSON(), nullable=True),
        sa.Column("valuation_method", sa.String(length=50), nullable=True),
        sa.Column("model_version", sa.String(length=20), nullable=True),
        sa.Column("calculated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    op.create_table(
        "price_history",
        sa.Column("id", sa.Uuid(), nullable=False, primary_key=True),
        sa.Column("property_id", sa.Uuid(), sa.ForeignKey("properties.id"), nullable=True),
        sa.Column("district", sa.String(length=100), nullable=True),
        sa.Column("area_name", sa.String(length=200), nullable=True),
        sa.Column("transaction_date", sa.Date(), nullable=False),
        sa.Column("price_tzs", sa.Numeric(15, 2), nullable=True),
        sa.Column("price_usd", sa.Numeric(15, 2), nullable=True),
        sa.Column("price_per_sqm_tzs", sa.Numeric(12, 2), nullable=True),
        sa.Column("area_sqm", sa.Numeric(12, 2), nullable=True),
        sa.Column("land_type", sa.Enum(name="land_type", create_type=False), nullable=True),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column("source_ref", sa.String(length=200), nullable=True),
        sa.Column("verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("idx_price_district", "price_history", ["district", "transaction_date"])
    op.create_index("idx_price_area", "price_history", ["area_name", "transaction_date"])

    op.create_table(
        "payments",
        sa.Column("id", sa.Uuid(), nullable=False, primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("api_users.id"), nullable=False),
        sa.Column("property_id", sa.Uuid(), sa.ForeignKey("properties.id"), nullable=True),
        sa.Column("amount_tzs", sa.Numeric(12, 2), nullable=False),
        sa.Column("amount_usd", sa.Numeric(12, 2), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="TZS"),
        sa.Column("provider", sa.Enum(name="payment_provider", create_type=False), nullable=False),
        sa.Column("provider_ref", sa.String(length=200), nullable=True),
        sa.Column("phone_number", sa.String(length=20), nullable=True),
        sa.Column("service_type", sa.String(length=50), nullable=False),
        sa.Column("status", sa.Enum(name="payment_status", create_type=False), nullable=False),
        sa.Column("initiated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
    )
    op.create_index("idx_payments_user", "payments", ["user_id"])
    op.create_index("idx_payments_status", "payments", ["status"])
    op.create_index("idx_payments_provider_ref", "payments", ["provider_ref"])

    op.create_table(
        "webhook_subscriptions",
        sa.Column("id", sa.Uuid(), nullable=False, primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("api_users.id"), nullable=False),
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column("events", sa.JSON(), nullable=False),
        sa.Column("secret", sa.String(length=64), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("failure_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_triggered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("api_key_prefix", sa.String(length=16), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("resource_type", sa.String(length=50), nullable=True),
        sa.Column("resource_id", sa.Uuid(), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("request_id", sa.Uuid(), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("data_categories", sa.JSON(), nullable=True),
        sa.Column("legal_basis", sa.String(length=50), nullable=True),
        sa.Column("cross_border", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_audit_timestamp", "audit_logs", ["timestamp"])
    op.create_index("idx_audit_action", "audit_logs", ["action"])


def downgrade() -> None:
    for table in [
        "audit_logs",
        "webhook_subscriptions",
        "payments",
        "price_history",
        "valuations",
        "risk_scores",
        "disputes",
        "zones",
        "ownerships",
        "api_keys",
        "api_users",
        "properties",
    ]:
        op.drop_table(table)

    bind = op.get_bind()
    for enum in [
        api_tier,
        payment_provider,
        payment_status,
        dispute_status,
        risk_level,
        ownership_type,
        land_type,
        region_type,
    ]:
        enum.drop(bind, checkfirst=True)
