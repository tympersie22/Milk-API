#!/usr/bin/env python3
"""
Seed demo data into milki.db using only stdlib + cryptography.
Run from project root: python3 scripts/seed_sqlite.py
"""
import sqlite3
import uuid
import json
import hashlib
import base64
import os
from datetime import datetime, timedelta, timezone

UTC = timezone.utc

# ── Encryption (mirrors app/core/encryption.py) ──
PII_KEY = os.environ.get("PII_ENCRYPTION_KEY", "dev-pii-encryption-key-change-in-prod")
_SALT = b"milki-pii-encryption-v1"


def _fernet_key() -> bytes:
    derived = hashlib.pbkdf2_hmac("sha256", PII_KEY.encode("utf-8"), _SALT, 600_000)
    return base64.urlsafe_b64encode(derived)


def encrypt_text(plaintext: str) -> bytes:
    from cryptography.fernet import Fernet
    fernet = Fernet(_fernet_key())
    return fernet.encrypt(plaintext.encode("utf-8"))


# ── API key hashing (legacy sha256 — supported by verify_api_key) ──
def hash_api_key_legacy(api_key: str) -> str:
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


def key_prefix(api_key: str) -> str:
    return api_key[:8]


# ── DB connection ──
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "milki.db")
conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# Check if data already exists
cur.execute("SELECT COUNT(*) FROM api_users")
if cur.fetchone()[0] > 0:
    print("Seed data already exists, skipping.")
    conn.close()
    exit(0)

print("Seeding demo data...")

now = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S")

# ── Demo API User ──
user_id = "00000000-0000-4000-a000-000000000001"
cur.execute("""
    INSERT INTO api_users (id, email, name, company, tier, phone, monthly_quota,
        requests_this_month, quota_reset_at, password_hash, is_active, is_verified,
        nida_verified, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
""", (
    user_id, "demo@milki.co.tz", "Demo User", "Milki Demo", "professional",
    "+255700000000", 10000, 0, "2026-04-01 00:00:00",
    "not-used-for-api-key-auth", 1, 1, 0, now, now
))

# ── Demo API Key ──
raw_key = "mlk_live_demokey1234567890abcdef"
cur.execute("""
    INSERT INTO api_keys (id, user_id, key_prefix, key_hash, name, is_active, permissions, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
""", (
    "00000000-0000-4000-a000-000000000002",
    user_id,
    key_prefix(raw_key),
    hash_api_key_legacy(raw_key),
    "Demo Key",
    1,
    json.dumps(["read", "write", "report"]),
    now,
))

# ── Check for existing properties ──
cur.execute("SELECT COUNT(*) FROM properties")
prop_count = cur.fetchone()[0]

if prop_count == 0:
    print("  Inserting demo properties...")
    prop_ids = [
        "10000000-0000-4000-a000-000000000001",
        "10000000-0000-4000-a000-000000000002",
        "10000000-0000-4000-a000-000000000003",
        "10000000-0000-4000-a000-000000000004",
        "10000000-0000-4000-a000-000000000005",
    ]

    properties = [
        (prop_ids[0], "DS/KND/2024/00142", "mainland", "Kinondoni", "Msasani", "Haile Selassie Road",
         "Masaki", "residential", "granted_right_of_occupancy", 850.0, None, None, None,
         None, "-6.7500,39.2800", None, 1, "2026-02-15 00:00:00", "ardhi_registry", 0.95,
         1, 0, 0, 0),
        (prop_ids[1], "DS/ILA/2023/00891", "mainland", "Ilala", "Kariakoo", "Uhuru Street",
         "Kariakoo", "commercial", "leasehold", 320.0, "2020-01-01", "2053-12-31", 33,
         None, "-6.8200,39.2700", None, 1, "2025-11-20 00:00:00", "ardhi_registry", 0.88,
         0, 0, 0, 0),
        (prop_ids[2], "ZNZ/URB/2025/00003", "zanzibar", "Mjini Magharibi", "Stone Town", None,
         "Stone Town Heritage Zone", "mixed_use", "freehold", 180.0, None, None, None,
         None, "-6.1630,39.1870", None, 1, "2026-01-05 00:00:00", "zipa_registry", 0.92,
         0, 1, 1, 1),
        (prop_ids[3], "DS/TEM/2024/01200", "mainland", "Temeke", "Mbagala", None,
         "Mbagala Kuu", "residential", "residential_license", 600.0, None, None, None,
         None, "-6.8800,39.2600", None, 0, None, "community_survey", 0.62,
         0, 0, 0, 0),
        (prop_ids[4], "AR/MOR/2022/00456", "mainland", "Morogoro", "Kilombero", None,
         "Kilombero Valley", "agricultural", "customary", 50000.0, None, None, None,
         None, "-7.7800,36.6800", None, 1, "2025-08-10 00:00:00", "village_council", 0.75,
         0, 0, 0, 0),
    ]

    for p in properties:
        cur.execute("""
            INSERT INTO properties (id, title_number, region, district, ward, street,
                area_name, land_type, ownership_type, area_sqm, lease_start_date, lease_end_date,
                lease_duration_years, boundary, centroid, survey_plan_ref, is_verified,
                last_verified_at, data_source, data_confidence, foreign_eligible, zipa_registered,
                coastal_buffer_zone, heritage_zone, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (*p, now, now))
else:
    print(f"  {prop_count} properties already exist, getting their IDs...")
    cur.execute("SELECT id FROM properties ORDER BY title_number LIMIT 5")
    prop_ids = [r[0] for r in cur.fetchall()]
    if len(prop_ids) < 5:
        # Pad with existing IDs if fewer than 5
        prop_ids.extend(prop_ids[:1] * (5 - len(prop_ids)))

# ── Ownerships ──
print("  Inserting ownerships...")
ownerships = [
    (str(uuid.uuid4()), prop_ids[0], encrypt_text("Amina Juma Mtambo"), None,
     "individual", "TZA", "2019-06-15", "purchase", "TRF-2019-KND-00142",
     1, 1, 0, 0, None, 0),
    (str(uuid.uuid4()), prop_ids[0], encrypt_text("Hassan Kimaro"), None,
     "individual", "TZA", "2010-03-20", "inheritance", "TRF-2010-KND-00089",
     0, 0, 0, 0, None, 0),
    (str(uuid.uuid4()), prop_ids[1], encrypt_text("Kariakoo Traders Ltd"), None,
     "company", "TZA", "2020-01-15", "lease_grant", "TRF-2020-ILA-00891",
     1, 0, 1, 0, None, 0),
    (str(uuid.uuid4()), prop_ids[2], encrypt_text("Stone Town Heritage Trust"), None,
     "trust", "TZA", "2015-09-01", "government_grant", "TRF-2015-ZNZ-00003",
     1, 0, 0, 0, None, 1),  # privacy_opt_out = 1
    (str(uuid.uuid4()), prop_ids[3], encrypt_text("Joseph Mwalimu"), None,
     "individual", "TZA", "2022-04-10", "purchase", "TRF-2022-TEM-01200",
     1, 1, 0, 1, None, 0),
    (str(uuid.uuid4()), prop_ids[4 % len(prop_ids)], encrypt_text("Kilombero Village Council"), None,
     "community", "TZA", "2005-01-01", "customary_allocation", None,
     1, 0, 0, 0, None, 0),
]

for o in ownerships:
    cur.execute("""
        INSERT INTO ownerships (id, property_id, owner_name_encrypted, owner_nida_hash,
            owner_type, owner_nationality, acquired_date, acquisition_method, transfer_ref,
            is_current, has_mortgage, has_caveat, has_lien, encumbrance_details,
            privacy_opt_out, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (*o, now, now))

# ── Disputes ──
print("  Inserting disputes...")
disputes = [
    (str(uuid.uuid4()), prop_ids[3], "LDC-2025-TEM-0089",
     "Land Division Court - Temeke", "boundary_dispute", "hearing",
     "2025-03-15", None, "Neighbouring plot owner claims boundary overlap after resurvey.",
     1, 1),
    (str(uuid.uuid4()), prop_ids[0], "LDC-2024-KND-0241",
     "Land Division Court - Kinondoni", "inheritance_claim", "resolved",
     "2024-01-10", "2024-08-20", "Third-party inheritance claim dismissed.",
     0, 0),
]

for d in disputes:
    cur.execute("""
        INSERT INTO disputes (id, property_id, case_number, court_name, dispute_type,
            status, filed_date, resolution_date, description, affects_title,
            blocks_transfer, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (*d, now, now))

# ── Risk Scores ──
print("  Inserting risk scores...")
valid_until_90 = (datetime.now(UTC) + timedelta(days=90)).strftime("%Y-%m-%d %H:%M:%S")
valid_until_30 = (datetime.now(UTC) + timedelta(days=30)).strftime("%Y-%m-%d %H:%M:%S")
valid_until_60 = (datetime.now(UTC) + timedelta(days=60)).strftime("%Y-%m-%d %H:%M:%S")

risk_scores = [
    (str(uuid.uuid4()), prop_ids[0], 2.50, "low", 1.50, 1.00, 4.00, 2.00, 1.50, 2.00,
     json.dumps([
         {"factor": "Active Mortgage", "score": 4.0, "weight": 0.2, "details": "NMB Bank mortgage since 2019"},
         {"factor": "Resolved Dispute", "score": 1.0, "weight": 0.15, "details": "Inheritance claim dismissed in 2024"},
         {"factor": "Verified Title", "score": 1.0, "weight": 0.25, "details": "Title verified with Ardhi registry"},
         {"factor": "Ownership Chain", "score": 1.5, "weight": 0.2, "details": "2 owners, clean chain"},
         {"factor": "Documentation", "score": 1.5, "weight": 0.1, "details": "Survey plan on file"},
         {"factor": "Data Freshness", "score": 2.0, "weight": 0.1, "details": "Last verified Feb 2026"},
     ]),
     json.dumps(["Clear mortgage before transfer", "Update survey plan — last filed 2019"]),
     "v1", now, valid_until_90),

    (str(uuid.uuid4()), prop_ids[3], 7.20, "high", 5.00, 9.00, 7.50, 6.00, 8.00, 5.00,
     json.dumps([
         {"factor": "Active Dispute", "score": 9.0, "weight": 0.25, "details": "Boundary dispute in hearing stage"},
         {"factor": "Transfer Blocked", "score": 9.0, "weight": 0.15, "details": "Court order blocks transfer"},
         {"factor": "Active Mortgage + Lien", "score": 7.5, "weight": 0.2, "details": "Both mortgage and lien registered"},
         {"factor": "Unverified Title", "score": 8.0, "weight": 0.2, "details": "Community survey data, not Ardhi verified"},
         {"factor": "Low Confidence Data", "score": 6.0, "weight": 0.1, "details": "62% data confidence"},
         {"factor": "Residential License", "score": 5.0, "weight": 0.1, "details": "RL has limited transferability"},
     ]),
     json.dumps([
         "Do NOT proceed with purchase — active dispute blocks transfer",
         "Wait for court resolution (case LDC-2025-TEM-0089)",
         "Verify title through Ardhi office independently",
         "Conduct fresh survey to resolve boundary questions",
     ]),
     "v1", now, valid_until_30),

    (str(uuid.uuid4()), prop_ids[2], 3.80, "medium", 2.00, 1.00, 1.00, 6.50, 3.00, 2.50,
     json.dumps([
         {"factor": "Heritage Zone", "score": 6.5, "weight": 0.2, "details": "Stone Town heritage zone — restricted modifications"},
         {"factor": "Coastal Buffer", "score": 5.0, "weight": 0.15, "details": "Within coastal buffer — extra permits required"},
         {"factor": "No Encumbrances", "score": 1.0, "weight": 0.2, "details": "No mortgage, caveat, or lien"},
         {"factor": "Clean Ownership", "score": 2.0, "weight": 0.2, "details": "Single trust owner since 2015"},
         {"factor": "ZIPA Registered", "score": 2.0, "weight": 0.15, "details": "Registered with ZIPA"},
         {"factor": "Foreign Restricted", "score": 5.0, "weight": 0.1, "details": "Not eligible for foreign ownership"},
     ]),
     json.dumps([
         "Verify heritage zone building restrictions before development",
         "Obtain coastal buffer zone permit if any construction planned",
     ]),
     "v1", now, valid_until_60),
]

for r in risk_scores:
    cur.execute("""
        INSERT INTO risk_scores (id, property_id, overall_score, risk_level,
            ownership_chain_score, dispute_score, encumbrance_score, zone_compliance_score,
            documentation_score, data_freshness_score, risk_factors, recommendations,
            algorithm_version, calculated_at, valid_until)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, r)

# ── Reports ──
print("  Inserting reports...")
two_hours_ago = (datetime.now(UTC) - timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S")
one_hour_ago = (datetime.now(UTC) - timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S")

reports = [
    (str(uuid.uuid4()), user_id, prop_ids[0], "DS/KND/2024/00142", "json", "completed",
     None, 1, 1, 1, 0,
     json.dumps({
         "property": {"title_number": "DS/KND/2024/00142", "district": "Kinondoni", "land_type": "residential"},
         "risk_summary": {"overall_score": 2.5, "risk_level": "low"},
         "generated_at": now,
     }),
     None, two_hours_ago),
    (str(uuid.uuid4()), user_id, prop_ids[3], "DS/TEM/2024/01200", "json", "completed",
     None, 1, 1, 0, 0,
     json.dumps({
         "property": {"title_number": "DS/TEM/2024/01200", "district": "Temeke", "land_type": "residential"},
         "risk_summary": {"overall_score": 7.2, "risk_level": "high"},
         "warnings": ["Active dispute", "Transfer blocked by court"],
         "generated_at": now,
     }),
     None, one_hour_ago),
    (str(uuid.uuid4()), user_id, prop_ids[2], "ZNZ/URB/2025/00003", "json", "processing",
     None, 1, 1, 1, 1, None, None, None),
]

for rp in reports:
    cur.execute("""
        INSERT INTO reports (id, user_id, property_id, title_number, requested_format,
            status, error_message, include_valuation, include_risk, include_comparables,
            include_zipa, report_json, report_pdf, completed_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (*rp, now, now))

conn.commit()
conn.close()

print("\nSeed complete!")
print(f"  5 properties, 6 ownerships, 2 disputes, 3 risk scores, 3 reports")
print(f"  1 API user (demo@milki.co.tz), 1 API key")
print(f"\n  Demo API Key: {raw_key}")
print(f"  Use header:   X-API-Key: {raw_key}")
