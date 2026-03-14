"""
Geospatial property lookup service.

Uses PostGIS ST_DWithin for spatial queries when available,
falls back to Haversine distance calculation for SQLite.
"""

import math
from sqlalchemy import select, func, text, literal_column
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.property import Property

settings = get_settings()
_is_postgres = not settings.database_url.startswith("sqlite")


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return the distance in meters between two WGS84 points."""
    R = 6371000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


class GeoService:
    """Find properties near a given lat/lng."""

    @staticmethod
    def find_nearby(
        db: Session,
        latitude: float,
        longitude: float,
        radius_meters: float = 100,
        limit: int = 20,
    ) -> list[tuple[Property, float]]:
        """
        Return properties whose centroid is within `radius_meters` of the query point.
        Each result is a (Property, distance_meters) tuple, sorted by distance ascending.
        """
        if _is_postgres:
            return GeoService._postgis_nearby(db, latitude, longitude, radius_meters, limit)
        return GeoService._sqlite_nearby(db, latitude, longitude, radius_meters, limit)

    @staticmethod
    def _postgis_nearby(
        db: Session,
        latitude: float,
        longitude: float,
        radius_meters: float,
        limit: int,
    ) -> list[tuple[Property, float]]:
        """PostGIS spatial query using ST_DWithin (geography cast for meter units)."""
        query_point = func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326)

        stmt = (
            select(
                Property,
                func.ST_Distance(
                    func.Geography(Property.centroid),
                    func.Geography(query_point),
                ).label("distance_m"),
            )
            .where(Property.centroid.isnot(None))
            .where(Property.deleted_at.is_(None))
            .where(
                func.ST_DWithin(
                    func.Geography(Property.centroid),
                    func.Geography(query_point),
                    radius_meters,
                )
            )
            .order_by(literal_column("distance_m"))
            .limit(limit)
        )

        rows = db.execute(stmt).all()
        return [(row[0], float(row[1])) for row in rows]

    @staticmethod
    def _sqlite_nearby(
        db: Session,
        latitude: float,
        longitude: float,
        radius_meters: float,
        limit: int,
    ) -> list[tuple[Property, float]]:
        """
        SQLite fallback: load properties with centroids and filter in Python.
        Centroids are stored as WKT 'POINT(lng lat)' text.
        """
        stmt = (
            select(Property)
            .where(Property.centroid.isnot(None))
            .where(Property.deleted_at.is_(None))
        )
        properties = db.scalars(stmt).all()

        results: list[tuple[Property, float]] = []
        for prop in properties:
            centroid = prop.centroid
            if not centroid or not isinstance(centroid, str):
                continue

            # Parse WKT: "POINT(lng lat)"
            try:
                coords = centroid.replace("POINT(", "").replace(")", "").strip()
                lng_str, lat_str = coords.split()
                plng, plat = float(lng_str), float(lat_str)
            except (ValueError, AttributeError):
                continue

            dist = _haversine(latitude, longitude, plat, plng)
            if dist <= radius_meters:
                results.append((prop, dist))

        results.sort(key=lambda x: x[1])
        return results[:limit]

    @staticmethod
    def compute_confidence(
        distance_meters: float,
        radius_meters: float,
        land_type_match: bool = False,
        is_verified: bool = False,
    ) -> float:
        """
        Compute a 0–1 confidence score for a candidate match.

        Factors:
        - Proximity: closer = higher confidence (exponential decay)
        - Land type match from image analysis: +0.15
        - Verified property: +0.1
        """
        # Proximity score: 1.0 at center, decays to ~0.3 at edge
        proximity = max(0, 1.0 - (distance_meters / radius_meters) ** 0.5)

        score = proximity * 0.75  # base weight

        if land_type_match:
            score += 0.15
        if is_verified:
            score += 0.10

        return round(min(score, 1.0), 3)
