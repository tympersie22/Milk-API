from datetime import UTC, datetime
from io import BytesIO
from uuid import UUID

from sqlalchemy import func, select, type_coerce, Uuid as SAUuid
from sqlalchemy.orm import Session, sessionmaker

from app.core.audit import write_audit_log
from app.core.exceptions import ApiError
from app.db.session import SessionLocal
from app.models.property import Property
from app.models.report import Report
from app.schemas.ownership import OwnershipRecord
from app.schemas.reports import (
    FullPropertyReport,
    FullReportRequest,
    ReportListItem,
    ReportListQuery,
    ReportPropertySummary,
    ReportStatusResponse,
)
from app.schemas.risk import RiskResponse
from app.services.ownership_service import OwnershipService
from app.services.property_service import PropertyService
from app.services.risk_engine import RiskEngine


class ReportService:
    @staticmethod
    def resolve_property(db: Session, request: FullReportRequest) -> Property:
        if request.property_id:
            try:
                prop_id = UUID(request.property_id)
            except ValueError as exc:
                raise ApiError(status_code=400, code="INVALID_PROPERTY_ID", message="Invalid property id") from exc
            prop = db.get(Property, prop_id)
            if not prop:
                raise ApiError(status_code=404, code="PROPERTY_NOT_FOUND", message="Property not found")
            return prop

        if not request.title_number or not request.region:
            raise ApiError(
                status_code=400,
                code="MISSING_PROPERTY_IDENTIFIER",
                message="Provide property_id or title_number + region",
            )

        prop = PropertyService.verify(db, request.title_number, request.region)
        if not prop:
            raise ApiError(
                status_code=404,
                code="PROPERTY_NOT_FOUND",
                message=f"No property found with title number {request.title_number}",
            )
        return prop

    @staticmethod
    def _to_property_summary(prop: Property) -> ReportPropertySummary:
        return ReportPropertySummary(
            id=str(prop.id),
            title_number=prop.title_number,
            region=prop.region.value if hasattr(prop.region, "value") else str(prop.region),
            district=prop.district,
            ward=prop.ward,
            area_name=prop.area_name,
            street=prop.street,
            land_type=prop.land_type.value if hasattr(prop.land_type, "value") else str(prop.land_type),
            ownership_type=(prop.ownership_type.value if hasattr(prop.ownership_type, "value") else str(prop.ownership_type)),
            area_sqm=float(prop.area_sqm) if prop.area_sqm is not None else None,
            data_source=prop.data_source,
            data_confidence=float(prop.data_confidence) if prop.data_confidence is not None else None,
            is_verified=prop.is_verified,
        )

    @classmethod
    def build_report(cls, db: Session, user_id: str, request: FullReportRequest) -> FullPropertyReport:
        prop = cls.resolve_property(db, request)
        current_row = OwnershipService.get_current(db, str(prop.id))
        history_rows, _ = OwnershipService.get_history(db, str(prop.id), limit=10, offset=0)

        current_owner = OwnershipRecord(**OwnershipService.to_record(current_row)) if current_row else None
        ownership_history = [OwnershipRecord(**OwnershipService.to_record(row)) for row in history_rows]

        risk = None
        if request.include_risk:
            risk = RiskResponse(**RiskEngine.compute_from_db(db, prop.id))

        notes: list[str] = []
        region = prop.region.value if hasattr(prop.region, "value") else prop.region
        if request.include_zipa and region != "zanzibar":
            notes.append("ZIPA checks apply only to Zanzibar properties")
        if request.include_valuation:
            notes.append("Valuation module integration is pending for dynamic comparables in this build")

        return FullPropertyReport(
            generated_at=datetime.now(UTC),
            generated_by_user_id=user_id,
            property=cls._to_property_summary(prop),
            current_owner=current_owner,
            ownership_history=ownership_history,
            risk=risk,
            notes=notes,
        )

    @classmethod
    def create_report_job(cls, db: Session, user_id: str, request: FullReportRequest) -> Report:
        prop = cls.resolve_property(db, request)
        report = Report(
            user_id=UUID(user_id),
            property_id=prop.id,
            title_number=prop.title_number,
            requested_format=request.format,
            status="processing",
            include_valuation=request.include_valuation,
            include_risk=request.include_risk,
            include_comparables=request.include_comparables,
            include_zipa=request.include_zipa,
        )
        db.add(report)
        db.flush()
        return report

    @classmethod
    def process_report_job(cls, report_id: str, bind=None) -> None:
        if bind is None:
            db = SessionLocal()
        else:
            factory = sessionmaker(bind=bind, autocommit=False, autoflush=False, class_=Session)
            db = factory()

        try:
            report = db.get(Report, UUID(report_id))
            if not report:
                return

            request = FullReportRequest(
                property_id=str(report.property_id),
                include_valuation=report.include_valuation,
                include_risk=report.include_risk,
                include_comparables=report.include_comparables,
                include_zipa=report.include_zipa,
                format=report.requested_format,
            )
            full_report = cls.build_report(db, user_id=str(report.user_id), request=request)
            report.report_json = full_report.model_dump(mode="json")
            report.report_pdf = cls.render_pdf(full_report)
            report.status = "completed"
            report.error_message = None
            report.completed_at = datetime.now(UTC)

            write_audit_log(
                db=db,
                action="report.full.processed",
                request_id=None,
                user_id=str(report.user_id),
                resource_type="property",
                resource_id=str(report.property_id),
                details={"report_id": str(report.id), "status": report.status},
                data_categories=["personal", "ownership", "financial"],
                legal_basis="contract",
            )
            db.commit()
        except Exception as exc:
            db.rollback()
            failed = db.get(Report, UUID(report_id))
            if failed:
                failed.status = "failed"
                failed.error_message = str(exc)[:500]
                failed.completed_at = datetime.now(UTC)
                db.add(failed)
                db.commit()
        finally:
            db.close()

    @staticmethod
    def get_report_for_user(db: Session, report_id: str, user_id: str) -> Report:
        try:
            report_uuid = UUID(report_id)
        except ValueError as exc:
            raise ApiError(status_code=400, code="INVALID_REPORT_ID", message="Invalid report id") from exc

        report = db.scalar(select(Report).where(
            Report.id == type_coerce(report_uuid, SAUuid()),
            Report.user_id == type_coerce(UUID(user_id), SAUuid()),
        ))
        if not report:
            raise ApiError(status_code=404, code="REPORT_NOT_FOUND", message="Report not found")
        return report

    @staticmethod
    def list_reports_for_user(db: Session, user_id: str, query: ReportListQuery) -> tuple[list[Report], int]:
        stmt = (
            select(Report)
            .join(Property, Property.id == Report.property_id)
            .where(Report.user_id == type_coerce(UUID(user_id), SAUuid()))
        )

        if query.status:
            stmt = stmt.where(Report.status == query.status)
        if query.format:
            stmt = stmt.where(Report.requested_format == query.format)
        if query.region:
            stmt = stmt.where(Property.region == query.region)
        if query.title_number:
            stmt = stmt.where(Report.title_number.ilike(f"%{query.title_number}%"))

        total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        start = (query.page - 1) * query.per_page
        rows = list(
            db.scalars(stmt.order_by(Report.created_at.desc()).offset(start).limit(query.per_page)).all()
        )
        return rows, total

    @staticmethod
    def to_status_response(db: Session, report: Report) -> ReportStatusResponse:
        report_payload = FullPropertyReport(**report.report_json) if report.report_json else None
        prop = db.get(Property, report.property_id)
        region = prop.region.value if prop and hasattr(prop.region, "value") else (prop.region if prop else "mainland")
        return ReportStatusResponse(
            report_id=str(report.id),
            status=report.status,
            requested_format=report.requested_format,
            title_number=report.title_number,
            property_id=str(report.property_id),
            region=region,
            created_at=report.created_at,
            completed_at=report.completed_at,
            error_message=report.error_message,
            report=report_payload,
        )

    @staticmethod
    def to_list_item(db: Session, report: Report) -> ReportListItem:
        prop = db.get(Property, report.property_id)
        region = prop.region.value if prop and hasattr(prop.region, "value") else (prop.region if prop else "mainland")
        return ReportListItem(
            report_id=str(report.id),
            status=report.status,
            requested_format=report.requested_format,
            title_number=report.title_number,
            property_id=str(report.property_id),
            region=region,
            created_at=report.created_at,
            completed_at=report.completed_at,
        )

    @staticmethod
    def render_download(report: Report, format_type: str) -> tuple[bytes, str, str]:
        if report.status != "completed":
            raise ApiError(status_code=409, code="REPORT_NOT_READY", message="Report is still processing")

        if format_type == "pdf":
            if not report.report_pdf:
                raise ApiError(status_code=404, code="REPORT_FORMAT_UNAVAILABLE", message="PDF output not available")
            filename = f"milki-report-{report.title_number}.pdf"
            return report.report_pdf, "application/pdf", filename

        if format_type == "json":
            if not report.report_json:
                raise ApiError(status_code=404, code="REPORT_FORMAT_UNAVAILABLE", message="JSON output not available")
            payload = FullPropertyReport(**report.report_json).model_dump_json(indent=2).encode("utf-8")
            filename = f"milki-report-{report.title_number}.json"
            return payload, "application/json", filename

        raise ApiError(status_code=400, code="INVALID_FORMAT", message="format must be json or pdf")

    @classmethod
    def render_pdf(cls, report: FullPropertyReport) -> bytes:
        lines = [
            "Milki API - Full Property Report",
            f"Generated at: {report.generated_at.isoformat()}",
            f"Title: {report.property.title_number}",
            f"Region: {report.property.region}",
            f"District: {report.property.district}",
            f"Area: {report.property.area_name or '-'}",
            f"Land Type: {report.property.land_type}",
            f"Ownership Type: {report.property.ownership_type}",
            f"Data Source: {report.property.data_source}",
            f"Verified: {'yes' if report.property.is_verified else 'no'}",
            "",
            "Current Owner",
        ]

        if report.current_owner:
            lines.extend(
                [
                    f"Owner: {report.current_owner.owner_name}",
                    f"Type: {report.current_owner.owner_type}",
                    f"Nationality: {report.current_owner.owner_nationality or '-'}",
                    f"Transfer Ref: {report.current_owner.transfer_ref or '-'}",
                ]
            )
        else:
            lines.append("No current owner record")

        if report.risk:
            lines.extend(["", "Risk Summary", f"Overall Score: {report.risk.overall_score}", f"Risk Level: {report.risk.risk_level}"])
            for factor_name, factor in report.risk.factors.items():
                lines.append(f"- {factor_name}: {factor.score}")

        if report.notes:
            lines.extend(["", "Notes"])
            lines.extend(f"- {note}" for note in report.notes)

        return _simple_pdf_from_lines(lines)


def _escape_pdf_text(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _simple_pdf_from_lines(lines: list[str]) -> bytes:
    page_width = 612
    page_height = 792
    left = 50
    top = 760
    line_height = 14
    max_lines_per_page = 48

    pages: list[list[str]] = [lines[i : i + max_lines_per_page] for i in range(0, len(lines), max_lines_per_page)]
    if not pages:
        pages = [["Milki API Report"]]

    objects: list[bytes] = [b"<< /Type /Catalog /Pages 2 0 R >>"]
    page_object_numbers = []
    content_object_numbers = []
    next_obj = 3

    for _ in pages:
        page_object_numbers.append(next_obj)
        next_obj += 1
        content_object_numbers.append(next_obj)
        next_obj += 1

    kids_refs = " ".join(f"{num} 0 R" for num in page_object_numbers)
    objects.append(f"<< /Type /Pages /Count {len(pages)} /Kids [{kids_refs}] >>".encode("utf-8"))

    font_obj_num = next_obj
    for idx, page_lines in enumerate(pages):
        content_obj_num = content_object_numbers[idx]
        content_parts = ["BT", "/F1 11 Tf", f"{left} {top} Td", f"{line_height} TL"]
        for line in page_lines:
            safe = _escape_pdf_text(line[:110])
            content_parts.append(f"({safe}) Tj")
            content_parts.append("T*")
        content_parts.append("ET")
        content_stream = "\n".join(content_parts).encode("utf-8")

        objects.append(
            (
                f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {page_width} {page_height}] "
                f"/Resources << /Font << /F1 {font_obj_num} 0 R >> >> /Contents {content_obj_num} 0 R >>"
            ).encode("utf-8")
        )
        objects.append(
            b"<< /Length " + str(len(content_stream)).encode("ascii") + b" >>\nstream\n" + content_stream + b"\nendstream"
        )

    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    buffer = BytesIO()
    buffer.write(b"%PDF-1.4\n")
    offsets = [0]

    for i, obj in enumerate(objects, start=1):
        offsets.append(buffer.tell())
        buffer.write(f"{i} 0 obj\n".encode("ascii"))
        buffer.write(obj)
        buffer.write(b"\nendobj\n")

    xref_offset = buffer.tell()
    buffer.write(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    buffer.write(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        buffer.write(f"{off:010d} 00000 n \n".encode("ascii"))

    buffer.write(("trailer\n" f"<< /Size {len(objects) + 1} /Root 1 0 R >>\n" "startxref\n" f"{xref_offset}\n" "%%EOF\n").encode("ascii"))
    return buffer.getvalue()
