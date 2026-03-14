"""
Property identification endpoint.

Accepts GPS coordinates (from EXIF, map pin, or manual entry) and an optional
AI-generated image description to find nearby properties and rank them by
confidence. This is the "point-and-identify" beta feature.
"""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.audit import write_audit_log
from app.core.security import authenticate_api_key
from app.db.session import get_db
from app.schemas.identify import IdentifyCandidate, IdentifyRequest, IdentifyResponse
from app.services.geo_service import GeoService

router = APIRouter(prefix="/property", tags=["identify"])

# Land type keywords that might appear in an AI image description
_LAND_TYPE_KEYWORDS: dict[str, list[str]] = {
    "residential": ["house", "home", "apartment", "dwelling", "residential", "villa", "bungalow"],
    "commercial": ["shop", "store", "office", "mall", "commercial", "business", "market"],
    "agricultural": ["farm", "crop", "field", "agricultural", "plantation", "garden", "shamba"],
    "industrial": ["factory", "warehouse", "industrial", "plant", "workshop", "manufacturing"],
    "mixed_use": ["mixed", "multi-purpose"],
    "government": ["government", "public", "municipal", "court", "school", "hospital"],
    "conservation": ["park", "reserve", "forest", "conservation", "wildlife", "protected"],
}


def _infer_land_type(description: str | None) -> str | None:
    """Try to infer a land type from an AI-generated image description."""
    if not description:
        return None
    desc_lower = description.lower()
    for land_type, keywords in _LAND_TYPE_KEYWORDS.items():
        if any(kw in desc_lower for kw in keywords):
            return land_type
    return None


@router.post("/identify", response_model=IdentifyResponse)
def identify_property(
    request: Request,
    payload: IdentifyRequest,
    auth=Depends(authenticate_api_key),
    db: Session = Depends(get_db),
) -> IdentifyResponse:
    """
    Identify a property from GPS coordinates and optional image description.

    Returns nearby property candidates sorted by confidence.
    """
    nearby = GeoService.find_nearby(
        db,
        latitude=payload.latitude,
        longitude=payload.longitude,
        radius_meters=payload.radius_meters,
        limit=20,
    )

    inferred_land_type = _infer_land_type(payload.image_description)

    candidates: list[IdentifyCandidate] = []
    for prop, distance in nearby:
        land_type_value = prop.land_type.value if hasattr(prop.land_type, "value") else str(prop.land_type)
        land_type_match = inferred_land_type is not None and land_type_value == inferred_land_type

        confidence = GeoService.compute_confidence(
            distance_meters=distance,
            radius_meters=payload.radius_meters,
            land_type_match=land_type_match,
            is_verified=prop.is_verified,
        )

        reasons: list[str] = []
        if distance < 20:
            reasons.append("Very close to search point")
        elif distance < 50:
            reasons.append("Near search point")
        else:
            reasons.append(f"{distance:.0f}m from search point")
        if land_type_match:
            reasons.append(f"Land type matches image ({land_type_value})")
        if prop.is_verified:
            reasons.append("Verified property record")

        # Check owner privacy (look for privacy_opt_out in encumbrance details or a flag)
        # For now, we mark anonymous if ownership data isn't available
        owner_anonymous = False

        candidates.append(
            IdentifyCandidate(
                property_id=str(prop.id),
                title_number=prop.title_number,
                region=prop.region.value if hasattr(prop.region, "value") else str(prop.region),
                district=prop.district,
                area_name=prop.area_name,
                land_type=land_type_value,
                is_verified=prop.is_verified,
                distance_meters=round(distance, 1),
                confidence=confidence,
                match_reasons=reasons,
                owner_anonymous=owner_anonymous,
            )
        )

    # Sort by confidence descending
    candidates.sort(key=lambda c: c.confidence, reverse=True)

    write_audit_log(
        db=db,
        action="property.identify",
        request_id=request.state.request_id,
        user_id=str(auth.user.id),
        api_key_prefix=auth.api_key.key_prefix,
        details={
            "latitude": payload.latitude,
            "longitude": payload.longitude,
            "radius_meters": payload.radius_meters,
            "has_image_description": payload.image_description is not None,
            "candidates_found": len(candidates),
        },
        data_categories=["geolocation"],
        legal_basis="legitimate_interest",
    )

    return IdentifyResponse(
        candidates=candidates,
        total_searched=len(nearby),
        search_center={"lat": payload.latitude, "lng": payload.longitude},
        radius_meters=payload.radius_meters,
    )
