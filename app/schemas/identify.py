"""Schemas for the property identification (image + coordinates) feature."""

from pydantic import BaseModel, Field


class IdentifyRequest(BaseModel):
    """Identify a property from coordinates and/or an uploaded image."""

    latitude: float = Field(..., ge=-90, le=90, description="Latitude (WGS 84)")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude (WGS 84)")
    radius_meters: float = Field(
        default=100, ge=10, le=5000, description="Search radius in meters"
    )
    image_description: str | None = Field(
        default=None,
        description="AI-generated description of uploaded image (land type, features, etc.)",
    )


class IdentifyCandidate(BaseModel):
    """A property that might match the user's photo / coordinates."""

    property_id: str
    title_number: str
    region: str
    district: str
    area_name: str | None = None
    land_type: str
    is_verified: bool
    distance_meters: float = Field(description="Distance from query point to property centroid")
    confidence: float = Field(
        ge=0, le=1, description="0–1 confidence that this is the correct match"
    )
    match_reasons: list[str] = Field(
        default_factory=list,
        description="Why this property was matched (e.g. 'closest centroid', 'land type match')",
    )
    owner_anonymous: bool = Field(
        default=False,
        description="True if the owner has opted out of public display",
    )


class IdentifyResponse(BaseModel):
    """Result of property identification."""

    candidates: list[IdentifyCandidate]
    total_searched: int = Field(description="Properties within the search radius")
    search_center: dict = Field(description="{ lat, lng } of the search origin")
    radius_meters: float
