from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
import hashlib
import secrets
from uuid import UUID
from fastapi import Depends, Header
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.exceptions import ApiError
from app.core.rate_limiter import rate_limiter
from app.db.session import get_db
from app.models.api_key import ApiKey
from app.models.api_user import ApiUser
from app.models.enums import ApiTier


settings = get_settings()
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
api_key_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRES_MINUTES = 60
REPORT_DOWNLOAD_EXPIRES_MINUTES = 15

TIER_MONTHLY_QUOTA: dict[ApiTier, int | None] = {
    ApiTier.free: 100,
    ApiTier.basic: 1000,
    ApiTier.professional: 10000,
    ApiTier.enterprise: None,
}

TIER_RATE_LIMIT_PER_MIN: dict[ApiTier, int] = {
    ApiTier.free: 10,
    ApiTier.basic: 30,
    ApiTier.professional: 120,
    ApiTier.enterprise: 600,
}


@dataclass
class AuthContext:
    api_key: ApiKey
    user: ApiUser


def generate_api_key(environment: str = "live") -> str:
    token = secrets.token_urlsafe(24).replace("-", "a").replace("_", "b")[:32]
    return f"{settings.allowed_api_key_prefix}{environment}_{token}"


def hash_api_key_legacy(api_key: str) -> str:
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


def hash_api_key(api_key: str) -> str:
    return api_key_context.hash(api_key)


def key_prefix(api_key: str) -> str:
    return api_key[:8]


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return pwd_context.verify(password, hashed_password)


def verify_api_key(api_key: str, stored_hash: str) -> bool:
    if stored_hash.startswith("$"):
        return api_key_context.verify(api_key, stored_hash)
    return secrets.compare_digest(hash_api_key_legacy(api_key), stored_hash)


def create_access_token(user_id: str, expires_delta: timedelta | None = None) -> str:
    expire = datetime.now(UTC) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRES_MINUTES))
    payload = {"sub": user_id, "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.secret_key, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    expire = datetime.now(UTC) + timedelta(days=30)
    payload = {"sub": user_id, "exp": expire, "type": "refresh"}
    return jwt.encode(payload, settings.secret_key, algorithm=JWT_ALGORITHM)


def create_report_download_token(
    report_id: str,
    user_id: str,
    format_type: str,
    expires_minutes: int = REPORT_DOWNLOAD_EXPIRES_MINUTES,
) -> tuple[str, datetime]:
    expires_at = datetime.now(UTC) + timedelta(minutes=expires_minutes)
    payload = {
        "type": "report_download",
        "rid": report_id,
        "uid": user_id,
        "fmt": format_type,
        "exp": expires_at,
    }
    token = jwt.encode(payload, settings.secret_key, algorithm=JWT_ALGORITHM)
    return token, expires_at


def verify_report_download_token(token: str, report_id: str, user_id: str, format_type: str) -> None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[JWT_ALGORITHM])
    except JWTError as exc:
        raise ApiError(status_code=401, code="INVALID_DOWNLOAD_TOKEN", message="Invalid or expired download token") from exc

    if payload.get("type") != "report_download":
        raise ApiError(status_code=401, code="INVALID_DOWNLOAD_TOKEN", message="Invalid download token type")
    if payload.get("rid") != report_id or payload.get("uid") != user_id or payload.get("fmt") != format_type:
        raise ApiError(status_code=401, code="INVALID_DOWNLOAD_TOKEN", message="Download token payload mismatch")


def parse_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise ApiError(status_code=401, code="MISSING_TOKEN", message="Authorization header is required")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise ApiError(status_code=401, code="INVALID_TOKEN", message="Bearer token is invalid")
    return token


def get_current_user(
    authorization: str | None = Header(default=None, alias="Authorization"),
    db: Session = Depends(get_db),
) -> ApiUser:
    token = parse_bearer_token(authorization)
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[JWT_ALGORITHM])
    except JWTError as exc:
        raise ApiError(status_code=401, code="INVALID_TOKEN", message="Token validation failed") from exc

    user_id = payload.get("sub")
    if not user_id:
        raise ApiError(status_code=401, code="INVALID_TOKEN", message="Token payload missing subject")

    try:
        user_uuid = UUID(user_id)
    except ValueError as exc:
        raise ApiError(status_code=401, code="INVALID_TOKEN", message="Token subject is invalid") from exc

    user = db.get(ApiUser, user_uuid)
    if not user or not user.is_active:
        raise ApiError(status_code=401, code="INVALID_TOKEN", message="User is inactive or missing")
    return user


def tier_monthly_quota(tier: ApiTier) -> int | None:
    return TIER_MONTHLY_QUOTA[tier]


def ensure_usage_window(user: ApiUser) -> None:
    now = datetime.now(UTC)
    quota_reset_at = user.quota_reset_at
    if quota_reset_at and quota_reset_at.tzinfo is None:
        quota_reset_at = quota_reset_at.replace(tzinfo=UTC)
    if quota_reset_at is None or quota_reset_at <= now:
        first_of_next_month = datetime(now.year + (1 if now.month == 12 else 0), (now.month % 12) + 1, 1, tzinfo=UTC)
        user.requests_this_month = 0
        user.quota_reset_at = first_of_next_month


def authenticate_api_key(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    db: Session = Depends(get_db),
) -> AuthContext:
    if not x_api_key:
        raise ApiError(status_code=401, code="MISSING_API_KEY", message="X-API-Key header is required")
    if not x_api_key.startswith(settings.allowed_api_key_prefix):
        raise ApiError(status_code=401, code="INVALID_API_KEY", message="API key format is invalid")

    requested_prefix = key_prefix(x_api_key)
    keys = db.scalars(
        select(ApiKey).where(ApiKey.key_prefix == requested_prefix, ApiKey.is_active.is_(True))
    ).all()
    key = next((candidate for candidate in keys if verify_api_key(x_api_key, candidate.key_hash)), None)
    if not key:
        raise ApiError(status_code=401, code="INVALID_API_KEY", message="API key not recognized")

    now = datetime.now(UTC)
    expires_at = key.expires_at
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at and expires_at <= now:
        raise ApiError(status_code=401, code="API_KEY_EXPIRED", message="API key has expired")

    user = db.get(ApiUser, key.user_id)
    if not user or not user.is_active:
        raise ApiError(status_code=401, code="INVALID_API_KEY", message="API key user is inactive")

    ensure_usage_window(user)
    tier = user.tier if isinstance(user.tier, ApiTier) else ApiTier(user.tier)

    minute_limit = TIER_RATE_LIMIT_PER_MIN[tier]
    limiter_key = f"{key.key_prefix}:{now.strftime('%Y%m%d%H%M')}"
    if not rate_limiter.allow(limiter_key, minute_limit):
        raise ApiError(status_code=429, code="RATE_LIMIT_EXCEEDED", message="Per-minute limit exceeded")

    quota = None if tier == ApiTier.enterprise else user.monthly_quota
    if quota is not None and user.requests_this_month >= quota:
        raise ApiError(status_code=429, code="MONTHLY_QUOTA_EXCEEDED", message="Monthly quota exceeded")

    user.requests_this_month += 1
    if not key.key_hash.startswith("$"):
        key.key_hash = hash_api_key(x_api_key)

    key.last_used_at = now
    db.add(user)
    db.add(key)
    db.commit()

    return AuthContext(api_key=key, user=user)
