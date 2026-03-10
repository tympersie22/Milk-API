import uuid
from datetime import UTC, datetime, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import get_db
from app.main import app
from app.models.base import Base
from app.models.api_key import ApiKey
from app.models.api_user import ApiUser
from app.models.enums import ApiTier, LandType, OwnershipType, RegionType
from app.models.ownership import Ownership
from app.models.property import Property
from app.core.security import hash_api_key, hash_password
from app.core.rate_limiter import rate_limiter
from app.core.encryption import encrypt_text


SQLALCHEMY_DATABASE_URL = "sqlite+pysqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
TEST_API_KEY = "mlk_test_12345678901234567890123456789012"


@pytest.fixture(autouse=True)
def clear_rate_limiter():
    rate_limiter.clear()
    yield
    rate_limiter.clear()


@pytest.fixture()
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        user = ApiUser(
            id=uuid.uuid4(),
            email="test@milki.tz",
            name="Test User",
            tier=ApiTier.enterprise,
            password_hash=hash_password("Password123!"),
            monthly_quota=999999,
            requests_this_month=0,
            quota_reset_at=datetime.now(UTC) + timedelta(days=30),
        )
        db.add(user)
        key = ApiKey(
            user_id=user.id,
            key_prefix=TEST_API_KEY[:8],
            key_hash=hash_api_key(TEST_API_KEY),
            name="test",
            is_active=True,
        )
        db.add(key)
        prop = Property(
            title_number="ZNZ-12345",
            region=RegionType.zanzibar,
            district="North A",
            area_name="Nungwi",
            land_type=LandType.residential,
            ownership_type=OwnershipType.leasehold,
            is_verified=True,
            data_source="bpra",
            data_confidence=0.91,
        )
        db.add(prop)
        db.flush()
        db.add(
            Ownership(
                property_id=prop.id,
                owner_name_encrypted=encrypt_text("Asha Ali"),
                owner_nida_hash="e3b0c44298fc1c149afbf4c8996fb924",
                owner_type="individual",
                owner_nationality="TZA",
                acquisition_method="purchase",
                transfer_ref="TR-ZNZ-12345",
                is_current=True,
                has_mortgage=False,
                has_caveat=False,
                has_lien=False,
                encumbrance_details={"notes": "Clean title"},
            )
        )
        db.commit()
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
