from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.audit import write_audit_log
from app.core.security import authenticate_api_key
from app.db.session import get_db
from app.schemas.reports import FullPropertyReport, FullReportRequest
from app.services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("/full", response_model=FullPropertyReport)
def generate_full_report(
    payload: FullReportRequest,
    request: Request,
    auth=Depends(authenticate_api_key),
    db: Session = Depends(get_db),
):
    report = ReportService.build_report(db, user_id=str(auth.user.id), request=payload)

    write_audit_log(
        db=db,
        action="report.full.generate",
        request_id=request.state.request_id,
        user_id=str(auth.user.id),
        api_key_prefix=auth.api_key.key_prefix,
        resource_type="property",
        resource_id=report.property.id,
        details={
            "format": payload.format,
            "property_id": report.property.id,
            "title_number": report.property.title_number,
            "include_risk": payload.include_risk,
            "include_zipa": payload.include_zipa,
        },
        data_categories=["personal", "ownership", "financial"],
        legal_basis="contract",
    )

    if payload.format == "pdf":
        pdf_bytes = ReportService.render_pdf(report)
        filename = f"milki-report-{report.property.title_number}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    return report
