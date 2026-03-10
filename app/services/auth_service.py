from datetime import UTC, datetime
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ApiError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    generate_api_key,
    hash_api_key,
    hash_password,
    key_prefix,
    tier_monthly_quota,
    verify_password,
)
from app.models.api_key import ApiKey
from app.models.api_user import ApiUser
from app.models.enums import ApiTier


class AuthService:
    @staticmethod
    def register(
        db: Session,
        email: str,
        password: str,
        name: str,
        company: str | None = None,
        phone: str | None = None,
    ) -> ApiUser:
        existing = db.scalar(select(ApiUser).where(ApiUser.email == email))
        if existing:
            raise ApiError(status_code=409, code="EMAIL_ALREADY_REGISTERED", message="Email already exists")

        user = ApiUser(
            email=email,
            password_hash=hash_password(password),
            name=name,
            company=company,
            phone=phone,
            tier=ApiTier.free,
            monthly_quota=tier_monthly_quota(ApiTier.free) or 0,
            quota_reset_at=datetime.now(UTC),
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def login(db: Session, email: str, password: str) -> tuple[str, str, int]:
        user = db.scalar(select(ApiUser).where(ApiUser.email == email))
        if not user or not user.password_hash or not verify_password(password, user.password_hash):
            raise ApiError(status_code=401, code="INVALID_CREDENTIALS", message="Invalid email or password")

        access_token = create_access_token(str(user.id))
        refresh_token = create_refresh_token(str(user.id))
        return access_token, refresh_token, 3600

    @staticmethod
    def create_api_key(db: Session, user: ApiUser, name: str | None = None) -> tuple[str, ApiKey]:
        raw_key = generate_api_key(environment="live")
        key = ApiKey(
            user_id=user.id,
            key_prefix=key_prefix(raw_key),
            key_hash=hash_api_key(raw_key),
            name=name,
            is_active=True,
            permissions=["read"],
        )
        db.add(key)
        db.commit()
        db.refresh(key)
        return raw_key, key
