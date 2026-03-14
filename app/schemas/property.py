from typing import Literal

from pydantic import BaseModel, Field
from app.schemas.common import PaginationMeta

RegionOption = Literal["mainland", "zanzibar"]


class PropertySearchQuery(BaseModel):
    title_number: str | None = None
    region: RegionOption | None = None
    district: str | None = None
    area_name: str | None = None
    land_type: str | None = None
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=20, ge=1, le=100)


class PropertySummary(BaseModel):
    id: str
    title_number: str
    region: str
    district: str
    area_name: str | None = None
    land_type: str
    is_verified: bool
    latitude: float | None = None
    longitude: float | None = None


class PropertySearchResponse(BaseModel):
    data: list[PropertySummary]
    pagination: PaginationMeta


class VerifyPropertyRequest(BaseModel):
    title_number: str
    region: RegionOption
    include_ownership: bool = False
    include_history: bool = False


class VerifyPropertyResponse(BaseModel):
    title_number: str
    region: str
    found: bool
    verified: bool
    data_source: str | None = None
    confidence: float | None = None
    message: str
