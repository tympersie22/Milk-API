from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.audit import write_audit_log
from app.core.exceptions import ApiError
from app.core.rate_limiter import rate_limiter
from app.core.security import (
    AuthContext,
    authenticate_api_key,
    create_report_download_token,
    verify_report_download_token,
)
from app.db.session import get_db
from app.models.report import Report
from app.schemas.common import PaginationMeta
from app.schemas.reports import (
    FullReportRequest,
    ReportCreateResponse,
    ReportFormat,
    ReportListQuery,
    ReportListResponse,
    ReportStatus,
    ReportStatusResponse,
    SignedDownloadResponse,
)
from app.services.report_queue import enqueue_report_job
from app.services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["reports"])

REPORT_RATE_LIMIT_PER_MIN = {
    "free": 5,
    "basic": 15,
    "professional": 60,
    "enterprise": 120,
}


def _enforce_report_rate_limit(auth: AuthContext, action: str) -> None:
    tier = auth.user.tier.value if hasattr(auth.user.tier, "value") else str(auth.user.tier)
    limit = REPORT_RATE_LIMIT_PER_MIN.get(tier, 5)
    minute_key = datetime.now(UTC).strftime("%Y%m%d%H%M")
    key = f"report:{action}:{auth.api_key.key_prefix}:{minute_key}"
    if not rate_limiter.allow(key, limit):
        raise ApiError(status_code=429, code="RATE_LIMIT_EXCEEDED", message="Report rate limit exceeded")


def _base_url(request: Request) -> str:
    return str(request.base_url).rstrip("/")


@router.post("/full", response_model=ReportCreateResponse)
def create_full_report(
    payload: FullReportRequest,
    request: Request,
    auth: AuthContext = Depends(authenticate_api_key),
    db: Session = Depends(get_db),
) -> ReportCreateResponse:
    _enforce_report_rate_limit(auth, "create")

    report = ReportService.create_report_job(db, user_id=str(auth.user.id), request=payload)

    write_audit_log(
        db=db,
        action="report.full.requested",
        request_id=request.state.request_id,
        user_id=str(auth.user.id),
        api_key_prefix=auth.api_key.key_prefix,
        resource_type="property",
        resource_id=str(report.property_id),
        details={
            "report_id": str(report.id),
            "format": payload.format,
            "include_risk": payload.include_risk,
            "include_zipa": payload.include_zipa,
        },
        data_categories=["personal", "ownership", "financial"],
        legal_basis="contract",
    )
    db.commit()

    mode = enqueue_report_job(str(report.id), bind=db.get_bind())

    callback_url = f"{_base_url(request)}/v1/reports/{report.id}"
    return ReportCreateResponse(
        report_id=str(report.id),
        status="processing",
        estimated_seconds=5,
        callback_url=callback_url,
        processing_mode=mode,
    )


@router.get("", response_model=ReportListResponse)
def list_reports(
    status: ReportStatus | None = Query(default=None),
    format: ReportFormat | None = Query(default=None),
    region: Literal["mainland", "zanzibar"] | None = Query(default=None),
    title_number: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    auth: AuthContext = Depends(authenticate_api_key),
    db: Session = Depends(get_db),
) -> ReportListResponse:
    _enforce_report_rate_limit(auth, "list")
    query = ReportListQuery(
        status=status,
        format=format,
        region=region,
        title_number=title_number,
        page=page,
        per_page=per_page,
    )
    rows, total = ReportService.list_reports_for_user(db, user_id=str(auth.user.id), query=query)
    return ReportListResponse(
        data=[ReportService.to_list_item(db, r) for r in rows],
        pagination=PaginationMeta(page=page, per_page=per_page, total=total),
    )


@router.get("/{report_id}", response_model=ReportStatusResponse)
def get_report_status(
    report_id: str,
    request: Request,
    auth: AuthContext = Depends(authenticate_api_key),
    db: Session = Depends(get_db),
) -> ReportStatusResponse:
    _enforce_report_rate_limit(auth, "status")
    report = ReportService.get_report_for_user(db, report_id=report_id, user_id=str(auth.user.id))

    write_audit_log(
        db=db,
        action="report.full.status",
        request_id=request.state.request_id,
        user_id=str(auth.user.id),
        api_key_prefix=auth.api_key.key_prefix,
        resource_type="property",
        resource_id=str(report.property_id),
        details={"report_id": str(report.id), "status": report.status},
        data_categories=["personal", "ownership", "financial"],
        legal_basis="contract",
    )
    db.commit()
    return ReportService.to_status_response(db, report)


@router.get("/{report_id}/download-url", response_model=SignedDownloadResponse)
def get_signed_download_url(
    report_id: str,
    request: Request,
    format: ReportFormat = Query(default="pdf"),
    auth: AuthContext = Depends(authenticate_api_key),
    db: Session = Depends(get_db),
) -> SignedDownloadResponse:
    _enforce_report_rate_limit(auth, "download_url")
    report = ReportService.get_report_for_user(db, report_id=report_id, user_id=str(auth.user.id))
    if report.status != "completed":
        raise ApiError(status_code=409, code="REPORT_NOT_READY", message="Report is still processing")

    token, expires_at = create_report_download_token(
        report_id=str(report.id),
        user_id=str(auth.user.id),
        format_type=format,
    )
    download_url = f"{_base_url(request)}/v1/reports/{report.id}/download?format={format}&token={token}"

    write_audit_log(
        db=db,
        action="report.download_url.issued",
        request_id=request.state.request_id,
        user_id=str(auth.user.id),
        api_key_prefix=auth.api_key.key_prefix,
        resource_type="property",
        resource_id=str(report.property_id),
        details={"report_id": str(report.id), "format": format},
        data_categories=["ownership"],
        legal_basis="contract",
    )
    db.commit()
    return SignedDownloadResponse(download_url=download_url, expires_at=expires_at, format=format)


@router.get("/{report_id}/download")
def download_report(
    report_id: str,
    format: ReportFormat,
    token: str,
    request: Request,
    db: Session = Depends(get_db),
):
    try:
        report_uuid = UUID(report_id)
    except ValueError as exc:
        raise ApiError(status_code=400, code="INVALID_REPORT_ID", message="Invalid report id") from exc

    report = db.get(Report, report_uuid)
    if not report:
        raise ApiError(status_code=404, code="REPORT_NOT_FOUND", message="Report not found")

    verify_report_download_token(token, report_id=report_id, user_id=str(report.user_id), format_type=format)
    payload, media_type, filename = ReportService.render_download(report, format)
    write_audit_log(
        db=db,
        action="report.download",
        request_id=request.state.request_id,
        user_id=str(report.user_id),
        resource_type="property",
        resource_id=str(report.property_id),
        details={"report_id": str(report.id), "format": format},
        data_categories=["personal", "ownership", "financial"],
        legal_basis="contract",
    )
    db.commit()
    return Response(
        content=payload,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
