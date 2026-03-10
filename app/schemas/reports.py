from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import PaginationMeta
from app.schemas.ownership import OwnershipRecord
from app.schemas.risk import RiskResponse

ReportFormat = Literal["json", "pdf"]
ReportStatus = Literal["processing", "completed", "failed"]


class FullReportRequest(BaseModel):
    property_id: str | None = None
    title_number: str | None = None
    region: Literal["mainland", "zanzibar"] | None = None
    include_valuation: bool = True
    include_risk: bool = True
    include_comparables: bool = True
    include_zipa: bool = False
    format: ReportFormat = "json"

    @model_validator(mode="after")
    def _has_identifier(self) -> "FullReportRequest":
        if not self.property_id and not self.title_number:
            raise ValueError("Either property_id or title_number is required")
        if self.title_number and not self.region:
            raise ValueError("region is required when title_number is provided")
        return self


class ReportPropertySummary(BaseModel):
    id: str
    title_number: str
    region: str
    district: str
    ward: str | None = None
    area_name: str | None = None
    street: str | None = None
    land_type: str
    ownership_type: str
    area_sqm: float | None = None
    data_source: str
    data_confidence: float | None = None
    is_verified: bool


class FullPropertyReport(BaseModel):
    generated_at: datetime
    generated_by_user_id: str
    property: ReportPropertySummary
    current_owner: OwnershipRecord | None = None
    ownership_history: list[OwnershipRecord] = Field(default_factory=list)
    risk: RiskResponse | None = None
    notes: list[str] = Field(default_factory=list)


class ReportCreateResponse(BaseModel):
    report_id: str
    status: ReportStatus
    estimated_seconds: int
    callback_url: str
    processing_mode: Literal["queued", "inline"] = "queued"


class ReportStatusResponse(BaseModel):
    report_id: str
    status: ReportStatus
    requested_format: ReportFormat
    title_number: str
    property_id: str
    region: str
    created_at: datetime
    completed_at: datetime | None = None
    error_message: str | None = None
    report: FullPropertyReport | None = None


class ReportListQuery(BaseModel):
    status: ReportStatus | None = None
    format: ReportFormat | None = None
    region: Literal["mainland", "zanzibar"] | None = None
    title_number: str | None = None
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=20, ge=1, le=100)


class ReportListItem(BaseModel):
    report_id: str
    status: ReportStatus
    requested_format: ReportFormat
    title_number: str
    property_id: str
    region: str
    created_at: datetime
    completed_at: datetime | None = None


class ReportListResponse(BaseModel):
    data: list[ReportListItem]
    pagination: PaginationMeta


class SignedDownloadResponse(BaseModel):
    download_url: str
    expires_at: datetime
    format: ReportFormat
