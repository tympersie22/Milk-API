from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.audit import write_audit_log
from app.core.exceptions import ApiError
from app.core.security import authenticate_api_key
from app.db.session import get_db
from app.models.property import Property
from app.schemas.ownership import OwnershipHistoryResponse, OwnershipResponse
from app.services.ownership_service import OwnershipService

router = APIRouter(prefix="/property", tags=["ownership"])

ALLOWED_LEGAL_BASIS = {"consent", "contract", "legal_obligation", "legitimate_interest"}


def _validate_pii_access(consent_confirmed: bool, legal_basis: str) -> None:
    if not consent_confirmed:
        raise ApiError(
            status_code=400,
            code="CONSENT_REQUIRED",
            message="Explicit consent confirmation is required for ownership PII access",
        )
    if legal_basis not in ALLOWED_LEGAL_BASIS:
        raise ApiError(
            status_code=400,
            code="INVALID_LEGAL_BASIS",
            message="legal_basis must be one of consent, contract, legal_obligation, legitimate_interest",
        )


@router.get("/{property_id}/ownership", response_model=OwnershipResponse)
def get_current_ownership(
    property_id: str,
    request: Request,
    consent_confirmed: bool = Query(default=False),
    legal_basis: str = Query(default="consent"),
    auth=Depends(authenticate_api_key),
    db: Session = Depends(get_db),
) -> OwnershipResponse:
    _validate_pii_access(consent_confirmed, legal_basis)
    try:
        property_uuid = UUID(property_id)
    except ValueError as exc:
        raise ApiError(status_code=400, code="INVALID_PROPERTY_ID", message="Invalid property id") from exc

    prop = db.get(Property, property_uuid)
    if not prop:
        raise ApiError(status_code=404, code="PROPERTY_NOT_FOUND", message="Property not found")

    try:
        current = OwnershipService.get_current(db, property_id)
    except ValueError as exc:
        raise ApiError(status_code=400, code="INVALID_PROPERTY_ID", message="Invalid property id") from exc
    if not current:
        raise ApiError(status_code=404, code="OWNERSHIP_NOT_FOUND", message="No current owner on record")

    record = OwnershipService.to_record(current)
    write_audit_log(
        db=db,
        action="ownership.view",
        request_id=request.state.request_id,
        user_id=str(auth.user.id),
        api_key_prefix=auth.api_key.key_prefix,
        resource_type="property",
        resource_id=property_id,
        details={"consent_confirmed": consent_confirmed},
        data_categories=["personal", "ownership"],
        legal_basis=legal_basis,
    )
    return OwnershipResponse(property_id=property_id, current_owner=record)


@router.get("/{property_id}/ownership/history", response_model=OwnershipHistoryResponse)
def get_ownership_history(
    property_id: str,
    request: Request,
    consent_confirmed: bool = Query(default=False),
    legal_basis: str = Query(default="consent"),
    auth=Depends(authenticate_api_key),
    db: Session = Depends(get_db),
) -> OwnershipHistoryResponse:
    _validate_pii_access(consent_confirmed, legal_basis)
    try:
        property_uuid = UUID(property_id)
    except ValueError as exc:
        raise ApiError(status_code=400, code="INVALID_PROPERTY_ID", message="Invalid property id") from exc

    prop = db.get(Property, property_uuid)
    if not prop:
        raise ApiError(status_code=404, code="PROPERTY_NOT_FOUND", message="Property not found")

    try:
        rows = OwnershipService.get_history(db, property_id)
    except ValueError as exc:
        raise ApiError(status_code=400, code="INVALID_PROPERTY_ID", message="Invalid property id") from exc
    if not rows:
        raise ApiError(status_code=404, code="OWNERSHIP_NOT_FOUND", message="No ownership history on record")

    records = [OwnershipService.to_record(row) for row in rows]
    write_audit_log(
        db=db,
        action="ownership.history.view",
        request_id=request.state.request_id,
        user_id=str(auth.user.id),
        api_key_prefix=auth.api_key.key_prefix,
        resource_type="property",
        resource_id=property_id,
        details={"consent_confirmed": consent_confirmed, "count": len(records)},
        data_categories=["personal", "ownership"],
        legal_basis=legal_basis,
    )
    return OwnershipHistoryResponse(property_id=property_id, history=records)
