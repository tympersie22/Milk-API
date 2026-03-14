#!/usr/bin/env python3
"""
Create all missing tables and seed with demo data for local development.
Run from the project root:  python -m scripts.setup_db
"""
import sys
import os
import uuid
from datetime import datetime, date, timedelta, timezone
UTC = timezone.utc
from decimal import Decimal
from pathlib import Path

# Ensure project root is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ.setdefault("SECRET_KEY", "dev-secret-key-change-in-production-abc123")
os.environ.setdefault("PII_ENCRYPTION_KEY", "dev-pii-encryption-key-change-in-prod")
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///./milki.db")

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session

from app.models.base import Base
# Import ALL models so Base.metadata is complete
from app.db.base import *  # noqa: F403
from app.config import get_settings
from app.core.encryption import encrypt_text
from app.core.security import hash_api_key, key_prefix, generate_api_key

settings = get_settings()
engine = create_engine(settings.database_url, echo=False)


def get_existing_tables():
    inspector = inspect(engine)
    return set(inspector.get_table_names())


def create_missing_tables():
    existing = get_existing_tables()
    all_tables = set(Base.metadata.tables.keys())
    missing = all_tables - existing
    if not missing:
        print("All tables already exist.")
        return False

    print(f"Existing tables: {sorted(existing)}")
    print(f"Missing tables:  {sorted(missing)}")
    print("Creating missing tables...")
    Base.metadata.create_all(engine, checkfirst=True)
    new_tables = get_existing_tables() - existing
    print(f"Created: {sorted(new_tables)}")
    return True


def stamp_alembic():
    """Set alembic_version to latest so future migrations work correctly."""
    latest = "20260310_0005"
    with engine.connect() as conn:
        current = conn.execute(text("SELECT version_num FROM alembic_version")).fetchone()
        if current:
            conn.execute(text("UPDATE alembic_version SET version_num = :v"), {"v": latest})
        else:
            conn.execute(text("INSERT INTO alembic_version (version_num) VALUES (:v)"), {"v": latest})
        conn.commit()
    print(f"Alembic version stamped: {latest}")


def seed_demo_data():
    """Insert demo api_user, api_key, properties, ownerships, disputes, reports, risk_scores."""
    from app.models.api_user import ApiUser
    from app.models.api_key import ApiKey
    from app.models.property import Property
    from app.models.ownership import Ownership
    from app.models.dispute import Dispute
    from app.models.report import Report
    from app.models.risk_score import RiskScore
    from app.models.enums import ApiTier, RiskLevel, DisputeStatus

    with Session(engine) as db:
        # Check if seed data already exists
        existing_user = db.execute(
            text("SELECT COUNT(*) FROM api_users")
        ).scalar()
        if existing_user > 0:
            print("Seed data already exists, skipping.")
            return

        print("Seeding demo data...")

        # ── Demo API User ──
        user_id = uuid.UUID("00000000-0000-4000-a000-000000000001")
        user = ApiUser(
            id=user_id,
            email="demo@milki.co.tz",
            name="Demo User",
            company="Milki Demo",
            tier=ApiTier.professional,
            phone="+255700000000",
            monthly_quota=10000,
            requests_this_month=0,
            quota_reset_at=datetime(2026, 4, 1, tzinfo=UTC),
            password_hash="$pbkdf2-sha256$29000$placeholder",  # not used for API key auth
            is_active=True,
            is_verified=True,
            nida_verified=False,
        )
        db.add(user)
        db.flush()

        # ── Demo API Key ──
        raw_key = "mlk_live_demokey1234567890abcdef"
        ak = ApiKey(
            id=uuid.UUID("00000000-0000-4000-a000-000000000002"),
            user_id=user_id,
            key_prefix=key_prefix(raw_key),
            key_hash=hash_api_key(raw_key),
            name="Demo Key",
            is_active=True,
            permissions=["read", "write", "report"],
        )
        db.add(ak)

        # ── Demo Properties ──
        prop_ids = [
            uuid.UUID("10000000-0000-4000-a000-000000000001"),
            uuid.UUID("10000000-0000-4000-a000-000000000002"),
            uuid.UUID("10000000-0000-4000-a000-000000000003"),
            uuid.UUID("10000000-0000-4000-a000-000000000004"),
            uuid.UUID("10000000-0000-4000-a000-000000000005"),
        ]
        properties_data = [
            {
                "id": prop_ids[0],
                "title_number": "DS/KND/2024/00142",
                "region": "mainland",
                "district": "Kinondoni",
                "ward": "Msasani",
                "street": "Haile Selassie Road",
                "area_name": "Masaki",
                "land_type": "residential",
                "ownership_type": "granted_right_of_occupancy",
                "area_sqm": Decimal("850.00"),
                "is_verified": True,
                "last_verified_at": datetime(2026, 2, 15, tzinfo=UTC),
                "data_source": "ardhi_registry",
                "data_confidence": Decimal("0.95"),
                "foreign_eligible": True,
                "zipa_registered": False,
                "centroid": "-6.7500,39.2800",
            },
            {
                "id": prop_ids[1],
                "title_number": "DS/ILA/2023/00891",
                "region": "mainland",
                "district": "Ilala",
                "ward": "Kariakoo",
                "street": "Uhuru Street",
                "area_name": "Kariakoo",
                "land_type": "commercial",
                "ownership_type": "leasehold",
                "area_sqm": Decimal("320.00"),
                "lease_start_date": date(2020, 1, 1),
                "lease_end_date": date(2053, 12, 31),
                "lease_duration_years": 33,
                "is_verified": True,
                "last_verified_at": datetime(2025, 11, 20, tzinfo=UTC),
                "data_source": "ardhi_registry",
                "data_confidence": Decimal("0.88"),
                "foreign_eligible": False,
                "zipa_registered": False,
                "centroid": "-6.8200,39.2700",
            },
            {
                "id": prop_ids[2],
                "title_number": "ZNZ/URB/2025/00003",
                "region": "zanzibar",
                "district": "Mjini Magharibi",
                "ward": "Stone Town",
                "area_name": "Stone Town Heritage Zone",
                "land_type": "mixed_use",
                "ownership_type": "freehold",
                "area_sqm": Decimal("180.00"),
                "is_verified": True,
                "last_verified_at": datetime(2026, 1, 5, tzinfo=UTC),
                "data_source": "zipa_registry",
                "data_confidence": Decimal("0.92"),
                "foreign_eligible": False,
                "zipa_registered": True,
                "heritage_zone": True,
                "coastal_buffer_zone": True,
                "centroid": "-6.1630,39.1870",
            },
            {
                "id": prop_ids[3],
                "title_number": "DS/TEM/2024/01200",
                "region": "mainland",
                "district": "Temeke",
                "ward": "Mbagala",
                "area_name": "Mbagala Kuu",
                "land_type": "residential",
                "ownership_type": "residential_license",
                "area_sqm": Decimal("600.00"),
                "is_verified": False,
                "data_source": "community_survey",
                "data_confidence": Decimal("0.62"),
                "foreign_eligible": False,
                "zipa_registered": False,
                "centroid": "-6.8800,39.2600",
            },
            {
                "id": prop_ids[4],
                "title_number": "AR/MOR/2022/00456",
                "region": "mainland",
                "district": "Morogoro",
                "ward": "Kilombero",
                "area_name": "Kilombero Valley",
                "land_type": "agricultural",
                "ownership_type": "customary",
                "area_sqm": Decimal("50000.00"),
                "is_verified": True,
                "last_verified_at": datetime(2025, 8, 10, tzinfo=UTC),
                "data_source": "village_council",
                "data_confidence": Decimal("0.75"),
                "foreign_eligible": False,
                "zipa_registered": False,
                "centroid": "-7.7800,36.6800",
            },
        ]

        for pdata in properties_data:
            db.add(Property(**pdata))
        db.flush()

        # ── Ownerships (with encrypted names) ──
        ownerships_data = [
            {
                "id": uuid.uuid4(),
                "property_id": prop_ids[0],
                "owner_name_encrypted": encrypt_text("Amina Juma Mtambo"),
                "owner_type": "individual",
                "owner_nationality": "TZA",
                "acquired_date": date(2019, 6, 15),
                "acquisition_method": "purchase",
                "transfer_ref": "TRF-2019-KND-00142",
                "is_current": True,
                "has_mortgage": True,
                "has_caveat": False,
                "has_lien": False,
                "privacy_opt_out": False,
            },
            {
                "id": uuid.uuid4(),
                "property_id": prop_ids[0],
                "owner_name_encrypted": encrypt_text("Hassan Kimaro"),
                "owner_type": "individual",
                "owner_nationality": "TZA",
                "acquired_date": date(2010, 3, 20),
                "acquisition_method": "inheritance",
                "transfer_ref": "TRF-2010-KND-00089",
                "is_current": False,
                "has_mortgage": False,
                "has_caveat": False,
                "has_lien": False,
                "privacy_opt_out": False,
            },
            {
                "id": uuid.uuid4(),
                "property_id": prop_ids[1],
                "owner_name_encrypted": encrypt_text("Kariakoo Traders Ltd"),
                "owner_type": "company",
                "owner_nationality": "TZA",
                "acquired_date": date(2020, 1, 15),
                "acquisition_method": "lease_grant",
                "transfer_ref": "TRF-2020-ILA-00891",
                "is_current": True,
                "has_mortgage": False,
                "has_caveat": True,
                "has_lien": False,
                "privacy_opt_out": False,
            },
            {
                "id": uuid.uuid4(),
                "property_id": prop_ids[2],
                "owner_name_encrypted": encrypt_text("Stone Town Heritage Trust"),
                "owner_type": "trust",
                "owner_nationality": "TZA",
                "acquired_date": date(2015, 9, 1),
                "acquisition_method": "government_grant",
                "transfer_ref": "TRF-2015-ZNZ-00003",
                "is_current": True,
                "has_mortgage": False,
                "has_caveat": False,
                "has_lien": False,
                "privacy_opt_out": True,  # Privacy opt-out demo
            },
            {
                "id": uuid.uuid4(),
                "property_id": prop_ids[3],
                "owner_name_encrypted": encrypt_text("Joseph Mwalimu"),
                "owner_type": "individual",
                "owner_nationality": "TZA",
                "acquired_date": date(2022, 4, 10),
                "acquisition_method": "purchase",
                "transfer_ref": "TRF-2022-TEM-01200",
                "is_current": True,
                "has_mortgage": True,
                "has_caveat": False,
                "has_lien": True,
                "privacy_opt_out": False,
            },
            {
                "id": uuid.uuid4(),
                "property_id": prop_ids[4],
                "owner_name_encrypted": encrypt_text("Kilombero Village Council"),
                "owner_type": "community",
                "owner_nationality": "TZA",
                "acquired_date": date(2005, 1, 1),
                "acquisition_method": "customary_allocation",
                "is_current": True,
                "has_mortgage": False,
                "has_caveat": False,
                "has_lien": False,
                "privacy_opt_out": False,
            },
        ]

        for odata in ownerships_data:
            db.add(Ownership(**odata))
        db.flush()

        # ── Disputes ──
        disputes_data = [
            {
                "id": uuid.uuid4(),
                "property_id": prop_ids[3],
                "case_number": "LDC-2025-TEM-0089",
                "court_name": "Land Division Court - Temeke",
                "dispute_type": "boundary_dispute",
                "status": DisputeStatus.hearing,
                "filed_date": date(2025, 3, 15),
                "description": "Neighbouring plot owner claims boundary overlap after resurvey.",
                "affects_title": True,
                "blocks_transfer": True,
            },
            {
                "id": uuid.uuid4(),
                "property_id": prop_ids[0],
                "case_number": "LDC-2024-KND-0241",
                "court_name": "Land Division Court - Kinondoni",
                "dispute_type": "inheritance_claim",
                "status": DisputeStatus.resolved,
                "filed_date": date(2024, 1, 10),
                "resolution_date": date(2024, 8, 20),
                "description": "Third-party inheritance claim dismissed.",
                "affects_title": False,
                "blocks_transfer": False,
            },
        ]

        for ddata in disputes_data:
            db.add(Dispute(**ddata))
        db.flush()

        # ── Risk Scores ──
        now = datetime.now(UTC)
        risk_data = [
            {
                "id": uuid.uuid4(),
                "property_id": prop_ids[0],
                "overall_score": Decimal("2.50"),
                "risk_level": RiskLevel.low,
                "ownership_chain_score": Decimal("1.50"),
                "dispute_score": Decimal("1.00"),
                "encumbrance_score": Decimal("4.00"),
                "zone_compliance_score": Decimal("2.00"),
                "documentation_score": Decimal("1.50"),
                "data_freshness_score": Decimal("2.00"),
                "risk_factors": [
                    {"factor": "Active Mortgage", "score": 4.0, "weight": 0.2, "details": "NMB Bank mortgage since 2019"},
                    {"factor": "Resolved Dispute", "score": 1.0, "weight": 0.15, "details": "Inheritance claim dismissed in 2024"},
                    {"factor": "Verified Title", "score": 1.0, "weight": 0.25, "details": "Title verified with Ardhi registry"},
                    {"factor": "Ownership Chain", "score": 1.5, "weight": 0.2, "details": "2 owners, clean chain"},
                    {"factor": "Documentation", "score": 1.5, "weight": 0.1, "details": "Survey plan on file"},
                    {"factor": "Data Freshness", "score": 2.0, "weight": 0.1, "details": "Last verified Feb 2026"},
                ],
                "recommendations": [
                    "Clear mortgage before transfer",
                    "Update survey plan — last filed 2019",
                ],
                "algorithm_version": "v1",
                "calculated_at": now,
                "valid_until": now + timedelta(days=90),
            },
            {
                "id": uuid.uuid4(),
                "property_id": prop_ids[3],
                "overall_score": Decimal("7.20"),
                "risk_level": RiskLevel.high,
                "ownership_chain_score": Decimal("5.00"),
                "dispute_score": Decimal("9.00"),
                "encumbrance_score": Decimal("7.50"),
                "zone_compliance_score": Decimal("6.00"),
                "documentation_score": Decimal("8.00"),
                "data_freshness_score": Decimal("5.00"),
                "risk_factors": [
                    {"factor": "Active Dispute", "score": 9.0, "weight": 0.25, "details": "Boundary dispute in hearing stage"},
                    {"factor": "Transfer Blocked", "score": 9.0, "weight": 0.15, "details": "Court order blocks transfer"},
                    {"factor": "Active Mortgage + Lien", "score": 7.5, "weight": 0.2, "details": "Both mortgage and lien registered"},
                    {"factor": "Unverified Title", "score": 8.0, "weight": 0.2, "details": "Community survey data, not Ardhi verified"},
                    {"factor": "Low Confidence Data", "score": 6.0, "weight": 0.1, "details": "62% data confidence"},
                    {"factor": "Residential License", "score": 5.0, "weight": 0.1, "details": "RL has limited transferability"},
                ],
                "recommendations": [
                    "Do NOT proceed with purchase — active dispute blocks transfer",
                    "Wait for court resolution (case LDC-2025-TEM-0089)",
                    "Verify title through Ardhi office independently",
                    "Conduct fresh survey to resolve boundary questions",
                ],
                "algorithm_version": "v1",
                "calculated_at": now,
                "valid_until": now + timedelta(days=30),
            },
            {
                "id": uuid.uuid4(),
                "property_id": prop_ids[2],
                "overall_score": Decimal("3.80"),
                "risk_level": RiskLevel.medium,
                "ownership_chain_score": Decimal("2.00"),
                "dispute_score": Decimal("1.00"),
                "encumbrance_score": Decimal("1.00"),
                "zone_compliance_score": Decimal("6.50"),
                "documentation_score": Decimal("3.00"),
                "data_freshness_score": Decimal("2.50"),
                "risk_factors": [
                    {"factor": "Heritage Zone", "score": 6.5, "weight": 0.2, "details": "Located in Stone Town heritage zone — restricted modifications"},
                    {"factor": "Coastal Buffer Zone", "score": 5.0, "weight": 0.15, "details": "Within coastal buffer — extra permits required"},
                    {"factor": "No Encumbrances", "score": 1.0, "weight": 0.2, "details": "No mortgage, caveat, or lien"},
                    {"factor": "Clean Ownership", "score": 2.0, "weight": 0.2, "details": "Single trust owner since 2015"},
                    {"factor": "ZIPA Registered", "score": 2.0, "weight": 0.15, "details": "Registered with ZIPA"},
                    {"factor": "Foreign Restricted", "score": 5.0, "weight": 0.1, "details": "Not eligible for foreign ownership"},
                ],
                "recommendations": [
                    "Verify heritage zone building restrictions before development",
                    "Obtain coastal buffer zone permit if any construction planned",
                ],
                "algorithm_version": "v1",
                "calculated_at": now,
                "valid_until": now + timedelta(days=60),
            },
        ]

        for rdata in risk_data:
            db.add(RiskScore(**rdata))
        db.flush()

        # ── Reports (completed demo reports) ──
        reports_data = [
            {
                "id": uuid.uuid4(),
                "user_id": user_id,
                "property_id": prop_ids[0],
                "title_number": "DS/KND/2024/00142",
                "requested_format": "json",
                "status": "completed",
                "include_valuation": True,
                "include_risk": True,
                "include_comparables": True,
                "include_zipa": False,
                "report_json": {
                    "property": {"title_number": "DS/KND/2024/00142", "district": "Kinondoni", "land_type": "residential"},
                    "risk_summary": {"overall_score": 2.5, "risk_level": "low"},
                    "generated_at": now.isoformat(),
                },
                "completed_at": now - timedelta(hours=2),
            },
            {
                "id": uuid.uuid4(),
                "user_id": user_id,
                "property_id": prop_ids[3],
                "title_number": "DS/TEM/2024/01200",
                "requested_format": "json",
                "status": "completed",
                "include_valuation": True,
                "include_risk": True,
                "include_comparables": False,
                "include_zipa": False,
                "report_json": {
                    "property": {"title_number": "DS/TEM/2024/01200", "district": "Temeke", "land_type": "residential"},
                    "risk_summary": {"overall_score": 7.2, "risk_level": "high"},
                    "warnings": ["Active dispute", "Transfer blocked by court"],
                    "generated_at": now.isoformat(),
                },
                "completed_at": now - timedelta(hours=1),
            },
            {
                "id": uuid.uuid4(),
                "user_id": user_id,
                "property_id": prop_ids[2],
                "title_number": "ZNZ/URB/2025/00003",
                "requested_format": "json",
                "status": "processing",
                "include_valuation": True,
                "include_risk": True,
                "include_comparables": True,
                "include_zipa": True,
            },
        ]

        for rpdata in reports_data:
            db.add(Report(**rpdata))

        db.commit()
        print(f"Seeded: 1 API user, 1 API key, {len(properties_data)} properties, "
              f"{len(ownerships_data)} ownerships, {len(disputes_data)} disputes, "
              f"{len(risk_data)} risk scores, {len(reports_data)} reports")
        print(f"\n  Demo API Key: {raw_key}")
        print(f"  Use header: X-API-Key: {raw_key}")


if __name__ == "__main__":
    print("=" * 60)
    print("Milki DB Setup — Creating tables & seeding demo data")
    print("=" * 60)

    create_missing_tables()
    stamp_alembic()
    seed_demo_data()

    # Final check
    final_tables = get_existing_tables()
    print(f"\nFinal tables ({len(final_tables)}): {sorted(final_tables)}")
    print("Done!")
