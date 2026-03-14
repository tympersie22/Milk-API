import logging
import re

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
from app.services.geocoding_service import GeocodingService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/property", tags=["property"])

# Regex patterns for parsing centroid stored as WKT or simple "lat,lng" text
_WKT_POINT = re.compile(r"POINT\(\s*([-\d.]+)\s+([-\d.]+)\s*\)", re.IGNORECASE)
_SIMPLE_PAIR = re.compile(r"^\s*([-\d.]+)\s*,\s*([-\d.]+)\s*$")


def _parse_centroid(centroid: str | None) -> tuple[float | None, float | None]:
    """Extract (latitude, longitude) from a centroid string.

    Supports:
      - WKT: "POINT(lng lat)"
      - Simple pair: "lat,lng"
    Returns (None, None) if unparseable.
    """
    if not centroid:
        return None, None
    m = _WKT_POINT.match(centroid)
    if m:
        # WKT stores as POINT(lng lat)
        return float(m.group(2)), float(m.group(1))
    m = _SIMPLE_PAIR.match(centroid)
    if m:
        # Simple "lat,lng" format
        return float(m.group(1)), float(m.group(2))
    return None, None


@router.get("/search", response_model=PropertySearchResponse)
def search_properties(
    request: Request,
    query: PropertySearchQuery = Depends(),
    auth=Depends(authenticate_api_key),
    db: Session = Depends(get_db),
) -> PropertySearchResponse:
    records, total = PropertyService.search(db, query)
    items = []
    for p in records:
        # Try to get coordinates: first from stored centroid, then real-time geocoding
        lat, lng = GeocodingService.geocode_and_cache(db, p)
        items.append(
            PropertySummary(
                id=str(p.id),
                title_number=p.title_number,
                region=p.region.value if hasattr(p.region, "value") else p.region,
                district=p.district,
                area_name=p.area_name,
                land_type=p.land_type.value if hasattr(p.land_type, "value") else p.land_type,
                is_verified=p.is_verified,
                latitude=lat,
                longitude=lng,
            )
        )
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
