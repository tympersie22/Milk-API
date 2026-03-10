from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.audit import write_audit_log
from app.core.security import authenticate_api_key
from app.db.session import get_db
from app.schemas.property import (
    PropertySearchQuery,
    PropertySearchResponse,
    PropertySummary,
    VerifyPropertyRequest,
    VerifyPropertyResponse,
)
from app.schemas.common import PaginationMeta
from app.services.property_service import PropertyService

router = APIRouter(prefix="/property", tags=["property"])


@router.get("/search", response_model=PropertySearchResponse)
def search_properties(
    request: Request,
    query: PropertySearchQuery = Depends(),
    auth=Depends(authenticate_api_key),
    db: Session = Depends(get_db),
) -> PropertySearchResponse:
    records, total = PropertyService.search(db, query)
    items = [
        PropertySummary(
            id=str(p.id),
            title_number=p.title_number,
            region=p.region.value if hasattr(p.region, "value") else p.region,
            district=p.district,
            area_name=p.area_name,
            land_type=p.land_type.value if hasattr(p.land_type, "value") else p.land_type,
            is_verified=p.is_verified,
        )
        for p in records
    ]
    write_audit_log(
        db=db,
        action="property.search",
        request_id=request.state.request_id,
        user_id=str(auth.user.id),
        api_key_prefix=auth.api_key.key_prefix,
        details={"query": query.model_dump(exclude_none=True), "count": len(items)},
        data_categories=["ownership"],
        legal_basis="legitimate_interest",
    )
    return PropertySearchResponse(
        data=items,
        pagination=PaginationMeta(page=query.page, per_page=query.per_page, total=total),
    )


@router.post("/verify", response_model=VerifyPropertyResponse)
def verify_property(
    request: Request,
    payload: VerifyPropertyRequest,
    auth=Depends(authenticate_api_key),
    db: Session = Depends(get_db),
) -> VerifyPropertyResponse:
    record = PropertyService.verify(db, payload.title_number, payload.region)
    found = record is not None
    write_audit_log(
        db=db,
        action="property.verify",
        request_id=request.state.request_id,
        user_id=str(auth.user.id),
        api_key_prefix=auth.api_key.key_prefix,
        details={"title_number": payload.title_number, "region": payload.region, "found": found},
        data_categories=["ownership"],
        legal_basis="contract",
    )
    if not record:
        return VerifyPropertyResponse(
            title_number=payload.title_number,
            region=payload.region,
            found=False,
            verified=False,
            data_source=None,
            confidence=None,
            message="Title not found in current index",
        )

    return VerifyPropertyResponse(
        title_number=record.title_number,
        region=record.region,
        found=True,
        verified=record.is_verified,
        data_source=record.data_source,
        confidence=float(record.data_confidence) if record.data_confidence is not None else None,
        message="Title record found",
    )
