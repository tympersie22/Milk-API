from sqlalchemy import select

from app.models.api_key import ApiKey
from app.models.api_user import ApiUser
from app.models.enums import ApiTier
from conftest import TEST_API_KEY


def test_register_and_login_and_api_key_issue(client, db_session):
    reg = client.post(
        "/v1/auth/register",
        json={
            "email": "newuser@milki.tz",
            "password": "Password123!",
            "name": "New User",
            "company": "Milki Labs",
        },
    )
    assert reg.status_code == 200

    login = client.post(
        "/v1/auth/login",
        json={"email": "newuser@milki.tz", "password": "Password123!"},
    )
    assert login.status_code == 200
    access_token = login.json()["access_token"]

    create_key = client.post(
        "/v1/auth/api-keys",
        json={"name": "cli"},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert create_key.status_code == 200
    body = create_key.json()
    assert body["key"].startswith("mlk_live_")
    assert len(body["prefix"]) == 8

    user = db_session.scalar(select(ApiUser).where(ApiUser.email == "newuser@milki.tz"))
    assert user is not None
    key = db_session.scalar(select(ApiKey).where(ApiKey.user_id == user.id))
    assert key is not None


def test_monthly_quota_exceeded_returns_429(client, db_session):
    user = db_session.scalar(select(ApiUser).where(ApiUser.email == "test@milki.tz"))
    assert user is not None
    user.tier = ApiTier.free
    user.monthly_quota = 1
    user.requests_this_month = 1
    db_session.add(user)
    db_session.commit()

    response = client.get("/v1/property/search", headers={"X-API-Key": TEST_API_KEY})
    assert response.status_code == 429
    assert response.json()["error"]["code"] == "MONTHLY_QUOTA_EXCEEDED"
