from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=2, max_length=200)
    company: str | None = None
    phone: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    token_type: str = "bearer"


class ApiKeyCreateRequest(BaseModel):
    name: str | None = None


class ApiKeyCreateResponse(BaseModel):
    key: str
    prefix: str
    name: str | None = None


class UsageResponse(BaseModel):
    requests_this_month: int
    quota: int | None
    tier: str
    reset_at: datetime | None
