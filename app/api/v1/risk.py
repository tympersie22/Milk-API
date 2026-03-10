from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.audit import write_audit_log
from app.core.exceptions import ApiError
from app.core.security import authenticate_api_key
from app.db.session import get_db
from app.models.property import Property
from app.schemas.risk import RiskResponse
from app.services.risk_engine import RiskEngine

router = APIRouter(prefix="/property", tags=["risk"])


@router.get("/{property_id}/risk", response_model=RiskResponse)
def get_risk(
    property_id: str,
    request: Request,
    auth=Depends(authenticate_api_key),
    db: Session = Depends(get_db),
) -> RiskResponse:
    try:
        property_uuid = UUID(property_id)
    except ValueError as exc:
        raise ApiError(status_code=400, code="INVALID_PROPERTY_ID", message="Invalid property id") from exc

    record = db.get(Property, property_uuid)
    if not record:
        raise ApiError(status_code=404, code="PROPERTY_NOT_FOUND", message="Property not found")

    result = RiskEngine.compute(
        {
            "ownership_chain": 2.0,
            "disputes": 1.0,
            "encumbrances": 3.0,
            "zone_compliance": 2.0,
            "documentation": 1.0,
            "data_freshness": 2.0,
        }
    )
    write_audit_log(
        db=db,
        action="risk.view",
        request_id=request.state.request_id,
        user_id=str(auth.user.id),
        api_key_prefix=auth.api_key.key_prefix,
        resource_type="property",
        resource_id=property_id,
        details={"risk_level": result["risk_level"], "overall_score": result["overall_score"]},
        data_categories=["ownership"],
        legal_basis="legitimate_interest",
    )
    return RiskResponse(**result)
