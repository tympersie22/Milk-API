from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.models.api_key import ApiKey
from app.models.api_user import ApiUser
from app.core.security import hash_api_key_legacy
from conftest import TEST_API_KEY


def test_expired_api_key_rejected(client, db_session):
    key = db_session.scalar(select(ApiKey).where(ApiKey.key_prefix == TEST_API_KEY[:8]))
    assert key is not None
    key.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    db_session.add(key)
    db_session.commit()

    response = client.get("/v1/property/search", headers={"X-API-Key": TEST_API_KEY})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "API_KEY_EXPIRED"


def test_legacy_sha256_api_key_still_authenticates_and_migrates(client, db_session):
    key = db_session.scalar(select(ApiKey).where(ApiKey.key_prefix == TEST_API_KEY[:8]))
    assert key is not None
    key.key_hash = hash_api_key_legacy(TEST_API_KEY)
    db_session.add(key)
    db_session.commit()

    response = client.get("/v1/property/search", headers={"X-API-Key": TEST_API_KEY})
    assert response.status_code == 200

    db_session.refresh(key)
    assert key.key_hash.startswith("$")


def test_login_rate_limited_after_five_attempts(client, db_session):
    user = db_session.scalar(select(ApiUser).where(ApiUser.email == "test@milki.tz"))
    assert user is not None

    for _ in range(5):
        response = client.post("/v1/auth/login", json={"email": user.email, "password": "wrong-password"})
        assert response.status_code == 401

    blocked = client.post("/v1/auth/login", json={"email": user.email, "password": "wrong-password"})
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "RATE_LIMIT_EXCEEDED"
