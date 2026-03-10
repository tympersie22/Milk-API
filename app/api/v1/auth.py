from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.audit import write_audit_log
from app.core.exceptions import ApiError
from app.core.rate_limiter import rate_limiter
from app.core.security import get_current_user
from app.db.session import get_db
from app.models.api_user import ApiUser
from app.schemas.auth import (
    ApiKeyCreateRequest,
    ApiKeyCreateResponse,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UsageResponse,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _enforce_auth_rate_limit(request: Request, action: str, limit: int = 5) -> None:
    key = f"auth:{action}:{_client_ip(request)}"
    if not rate_limiter.allow(key, limit):
        raise ApiError(status_code=429, code="RATE_LIMIT_EXCEEDED", message="Too many authentication attempts")


@router.post("/register", response_model=UsageResponse)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)) -> UsageResponse:
    _enforce_auth_rate_limit(request, "register")
    user = AuthService.register(
        db=db,
        email=payload.email,
        password=payload.password,
        name=payload.name,
        company=payload.company,
        phone=payload.phone,
    )
    write_audit_log(
        db=db,
        action="auth.register",
        request_id=request.state.request_id,
        user_id=str(user.id),
        data_categories=["personal"],
        legal_basis="consent",
    )
    return UsageResponse(
        requests_this_month=user.requests_this_month,
        quota=user.monthly_quota,
        tier=user.tier.value,
        reset_at=user.quota_reset_at,
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    _enforce_auth_rate_limit(request, "login")
    access_token, refresh_token, expires_in = AuthService.login(
        db=db, email=payload.email, password=payload.password
    )
    write_audit_log(
        db=db,
        action="auth.login",
        request_id=request.state.request_id,
        details={"email": payload.email},
    )
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
    )


@router.post("/api-keys", response_model=ApiKeyCreateResponse)
def create_api_key(
    payload: ApiKeyCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: ApiUser = Depends(get_current_user),
) -> ApiKeyCreateResponse:
    raw_key, key = AuthService.create_api_key(db=db, user=user, name=payload.name)
    write_audit_log(
        db=db,
        action="auth.api_key.create",
        request_id=request.state.request_id,
        user_id=str(user.id),
        details={"key_prefix": key.key_prefix, "name": key.name},
    )
    return ApiKeyCreateResponse(key=raw_key, prefix=key.key_prefix, name=key.name)


@router.get("/usage", response_model=UsageResponse)
def usage(user: ApiUser = Depends(get_current_user)) -> UsageResponse:
    return UsageResponse(
        requests_this_month=user.requests_this_month,
        quota=None if user.tier.value == "enterprise" else user.monthly_quota,
        tier=user.tier.value,
        reset_at=user.quota_reset_at,
    )
