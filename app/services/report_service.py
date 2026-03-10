from datetime import UTC, datetime
from io import BytesIO
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import ApiError
from app.models.property import Property
from app.schemas.ownership import OwnershipRecord
from app.schemas.reports import FullPropertyReport, FullReportRequest, ReportPropertySummary
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
                raise ApiError(
                    status_code=400,
                    code="INVALID_PROPERTY_ID",
                    message="Invalid property id",
                ) from exc
            prop = db.get(Property, prop_id)
            if not prop:
                raise ApiError(
                    status_code=404,
                    code="PROPERTY_NOT_FOUND",
                    message="Property not found",
                )
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
            ownership_type=(
                prop.ownership_type.value
                if hasattr(prop.ownership_type, "value")
                else str(prop.ownership_type)
            ),
            area_sqm=float(prop.area_sqm) if prop.area_sqm is not None else None,
            data_source=prop.data_source,
            data_confidence=float(prop.data_confidence) if prop.data_confidence is not None else None,
            is_verified=prop.is_verified,
        )

    @classmethod
    def build_report(cls, db: Session, user_id: str, request: FullReportRequest) -> FullPropertyReport:
        prop = cls.resolve_property(db, request)
        current_row = OwnershipService.get_current(db, str(prop.id))
        history_rows, _total = OwnershipService.get_history(db, str(prop.id), limit=10, offset=0)

        current_owner = (
            OwnershipRecord(**OwnershipService.to_record(current_row)) if current_row else None
        )
        ownership_history = [
            OwnershipRecord(**OwnershipService.to_record(row)) for row in history_rows
        ]

        risk = None
        if request.include_risk:
            risk = RiskResponse(**RiskEngine.compute_from_db(db, prop.id))

        notes: list[str] = []
        if request.include_zipa and (prop.region.value if hasattr(prop.region, "value") else prop.region) != "zanzibar":
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
            lines.extend(
                [
                    "",
                    "Risk Summary",
                    f"Overall Score: {report.risk.overall_score}",
                    f"Risk Level: {report.risk.risk_level}",
                ]
            )
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

    objects: list[bytes] = []

    # 1: catalog, 2: pages root
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")

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
    next_obj += 1

    for idx, page_lines in enumerate(pages):
        page_obj_num = page_object_numbers[idx]
        content_obj_num = content_object_numbers[idx]

        if idx == 0:
            y = top
        else:
            y = top

        content_parts = [
            "BT",
            "/F1 11 Tf",
            f"{left} {y} Td",
            f"{line_height} TL",
        ]
        for line in page_lines:
            safe = _escape_pdf_text(line[:110])
            content_parts.append(f"({safe}) Tj")
            content_parts.append("T*")
        content_parts.append("ET")
        content_stream = "\n".join(content_parts).encode("utf-8")

        objects.append(
            (
                f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {page_width} {page_height}] "
                f"/Resources << /Font << /F1 {font_obj_num} 0 R >> >> "
                f"/Contents {content_obj_num} 0 R >>"
            ).encode("utf-8")
        )
        objects.append(
            b"<< /Length "
            + str(len(content_stream)).encode("ascii")
            + b" >>\nstream\n"
            + content_stream
            + b"\nendstream"
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

    buffer.write(
        (
            "trailer\n"
            f"<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
            "startxref\n"
            f"{xref_offset}\n"
            "%%EOF\n"
        ).encode("ascii")
    )
    return buffer.getvalue()
