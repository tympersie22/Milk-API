from uuid import UUID
from sqlalchemy.orm import Session

from app.core.exceptions import ApiError
from app.models.audit_log import AuditLog


def ensure_pdpa_audit_fields(action: str, data_categories: list[str] | None, legal_basis: str | None) -> None:
    if not action.startswith("report.") and not action.startswith("ownership."):
        return
    if not data_categories:
        raise ApiError(
            status_code=500,
            code="AUDIT_MISCONFIGURED",
            message=f"Missing data_categories for sensitive action: {action}",
        )
    if not legal_basis:
        raise ApiError(
            status_code=500,
            code="AUDIT_MISCONFIGURED",
            message=f"Missing legal_basis for sensitive action: {action}",
        )


def write_audit_log(
    db: Session,
    action: str,
    request_id: str | None,
    api_key_prefix: str | None = None,
    user_id: str | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    details: dict | None = None,
    data_categories: list[str] | None = None,
    legal_basis: str | None = None,
    cross_border: bool = False,
) -> None:
    ensure_pdpa_audit_fields(action, data_categories, legal_basis)
    log = AuditLog(
        action=action,
        request_id=UUID(request_id) if request_id else None,
        api_key_prefix=api_key_prefix,
        user_id=UUID(user_id) if user_id else None,
        resource_type=resource_type,
        resource_id=UUID(resource_id) if resource_id else None,
        ip_address=ip_address,
        user_agent=user_agent,
        details=details,
        data_categories=data_categories,
        legal_basis=legal_basis,
        cross_border=cross_border,
    )
    db.add(log)
    # Do NOT commit here — the caller's transaction will commit the audit
    # log together with the main operation, ensuring atomicity.
    db.flush()
