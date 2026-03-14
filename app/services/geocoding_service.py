"""
Real-time geocoding service for Tanzania properties.

Strategy (in order):
  1. Use stored centroid from database if available
  2. Look up district/area in built-in Tanzania coordinate dictionary (instant)
  3. Call Nominatim (OpenStreetMap) API for precise geocoding (cached back to DB)

The built-in dictionary provides instant results for all major Tanzania districts.
Nominatim refines to area/ward level when the network is available.
"""

import logging
import re
import urllib.request
import urllib.parse
import json
from typing import Optional

from sqlalchemy.orm import Session

from app.models.property import Property

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "MilkiPropertyAPI/1.0 (Tanzania Property Intelligence)"

# WKT parser
_WKT_POINT = re.compile(r"POINT\(\s*([-\d.]+)\s+([-\d.]+)\s*\)", re.IGNORECASE)

# ──────────────────────────────────────────────────────────────────────
# Built-in Tanzania district/area coordinate dictionary
# lat, lng pairs for major districts, wards, and landmarks
# ──────────────────────────────────────────────────────────────────────
_TANZANIA_COORDS: dict[str, tuple[float, float]] = {
    # === DAR ES SALAAM ===
    "kinondoni": (-6.7714, 39.2455),
    "masaki": (-6.7500, 39.2800),
    "msasani": (-6.7455, 39.2643),
    "mikocheni": (-6.7620, 39.2620),
    "sinza": (-6.7850, 39.2370),
    "kijitonyama": (-6.7780, 39.2500),
    "mwananyamala": (-6.7910, 39.2640),
    "kawe": (-6.7350, 39.2380),
    "mbezi": (-6.7300, 39.1800),
    "bunju": (-6.6590, 39.1380),
    "kunduchi": (-6.6710, 39.2010),
    "ilala": (-6.8260, 39.2710),
    "kariakoo": (-6.8200, 39.2700),
    "upanga": (-6.8100, 39.2810),
    "gerezani": (-6.8250, 39.2850),
    "buguruni": (-6.8410, 39.2560),
    "vingunguti": (-6.8560, 39.2450),
    "pugu": (-6.8780, 39.1920),
    "tabata": (-6.8420, 39.2290),
    "segerea": (-6.8350, 39.2180),
    "temeke": (-6.8610, 39.2480),
    "mbagala": (-6.8800, 39.2600),
    "mbagala kuu": (-6.8850, 39.2650),
    "chang'ombe": (-6.8430, 39.2710),
    "kurasini": (-6.8520, 39.2860),
    "kigamboni": (-6.8640, 39.3130),
    "ubungo": (-6.7830, 39.2100),
    "kimara": (-6.7870, 39.1850),
    "kibamba": (-6.7550, 39.0980),
    "goba": (-6.7450, 39.1260),

    # === ZANZIBAR ===
    "mjini magharibi": (-6.1630, 39.1870),
    "stone town": (-6.1630, 39.1870),
    "stone town heritage zone": (-6.1610, 39.1880),
    "urban": (-6.1630, 39.1870),
    "north a": (-5.7269, 39.2983),
    "north b": (-5.8860, 39.2890),
    "nungwi": (-5.7269, 39.2983),
    "kendwa": (-5.7500, 39.2920),
    "matemwe": (-5.8200, 39.3520),
    "kiwengwa": (-5.9800, 39.3890),
    "paje": (-6.2730, 39.5320),
    "jambiani": (-6.3100, 39.5410),
    "south": (-6.2500, 39.4500),
    "central": (-6.0500, 39.3500),
    "west": (-6.1400, 39.1600),
    "pemba north": (-4.9700, 39.7200),
    "pemba south": (-5.2300, 39.7400),
    "wete": (-5.0580, 39.7290),
    "chake chake": (-5.2460, 39.7660),

    # === ARUSHA REGION ===
    "arusha": (-3.3869, 36.6830),
    "arusha city": (-3.3869, 36.6830),
    "arumeru": (-3.3500, 36.7500),
    "karatu": (-3.3430, 35.6720),
    "monduli": (-3.3050, 36.4500),
    "meru": (-3.3500, 36.8000),
    "longido": (-2.7300, 36.6900),
    "ngorongoro": (-3.2440, 35.4880),

    # === DODOMA REGION ===
    "dodoma": (-6.1731, 35.7516),
    "dodoma city": (-6.1731, 35.7516),
    "kondoa": (-4.8980, 35.7880),
    "bahi": (-5.9800, 35.3200),
    "chamwino": (-6.1100, 35.7700),
    "mpwapwa": (-6.3510, 36.0530),
    "kongwa": (-6.2000, 36.4200),

    # === MWANZA REGION ===
    "mwanza": (-2.5164, 32.9175),
    "mwanza city": (-2.5164, 32.9175),
    "ilemela": (-2.5000, 32.8900),
    "nyamagana": (-2.5200, 32.9200),
    "sengerema": (-2.6100, 32.4800),
    "kwimba": (-2.7800, 33.0700),
    "magu": (-2.5800, 33.4400),
    "misungwi": (-2.8400, 33.0300),
    "ukerewe": (-2.0200, 33.0100),

    # === MOROGORO REGION ===
    "morogoro": (-6.8210, 37.6610),
    "morogoro municipal": (-6.8210, 37.6610),
    "kilombero": (-7.7800, 36.6800),
    "kilombero valley": (-7.7800, 36.6800),
    "ulanga": (-8.3400, 36.7100),
    "kilosa": (-6.8300, 36.9900),
    "mvomero": (-6.3600, 37.4600),
    "ifakara": (-8.1330, 36.6830),

    # === TANGA REGION ===
    "tanga": (-5.0689, 39.0990),
    "tanga city": (-5.0689, 39.0990),
    "pangani": (-5.8330, 38.5670),
    "muheza": (-5.1700, 38.7800),
    "korogwe": (-5.1470, 38.4600),
    "lushoto": (-4.7870, 38.2900),
    "handeni": (-5.4250, 38.0130),

    # === MBEYA REGION ===
    "mbeya": (-8.9000, 33.4500),
    "mbeya city": (-8.9000, 33.4500),
    "rungwe": (-9.1330, 33.6000),
    "mbarali": (-8.6700, 34.1100),
    "chunya": (-8.5500, 33.4300),

    # === KILIMANJARO REGION ===
    "kilimanjaro": (-3.0674, 37.3556),
    "moshi": (-3.3474, 37.3413),
    "moshi municipal": (-3.3474, 37.3413),
    "hai": (-3.2300, 37.1100),
    "rombo": (-3.1200, 37.5400),
    "same": (-4.0700, 37.7200),
    "mwanga": (-3.6600, 37.6700),
    "siha": (-3.1800, 36.9200),

    # === IRINGA REGION ===
    "iringa": (-7.7700, 35.6920),
    "iringa municipal": (-7.7700, 35.6920),
    "mufindi": (-8.5700, 35.4300),
    "njombe": (-9.3400, 34.7700),

    # === KAGERA REGION ===
    "kagera": (-1.3000, 31.8000),
    "bukoba": (-1.3310, 31.8120),
    "bukoba municipal": (-1.3310, 31.8120),
    "muleba": (-1.7500, 31.6600),
    "ngara": (-2.4800, 30.6600),

    # === LINDI REGION ===
    "lindi": (-10.0034, 39.7139),
    "lindi municipal": (-10.0034, 39.7139),
    "kilwa": (-8.9200, 39.5200),
    "nachingwea": (-10.3700, 38.7700),

    # === MTWARA REGION ===
    "mtwara": (-10.2740, 40.1829),
    "mtwara municipal": (-10.2740, 40.1829),
    "newala": (-10.9500, 39.3000),
    "masasi": (-10.7230, 38.8010),

    # === RUKWA REGION ===
    "rukwa": (-8.0000, 31.5000),
    "sumbawanga": (-7.9670, 31.6190),
    "sumbawanga municipal": (-7.9670, 31.6190),

    # === SHINYANGA REGION ===
    "shinyanga": (-3.6617, 33.4210),
    "shinyanga municipal": (-3.6617, 33.4210),
    "kahama": (-3.8340, 32.6100),

    # === SINGIDA REGION ===
    "singida": (-4.8163, 34.7447),
    "singida municipal": (-4.8163, 34.7447),

    # === TABORA REGION ===
    "tabora": (-5.0242, 32.8178),
    "tabora municipal": (-5.0242, 32.8178),
    "nzega": (-4.2140, 33.1870),
    "igunga": (-4.2830, 33.8830),

    # === KIGOMA REGION ===
    "kigoma": (-4.8769, 29.6260),
    "kigoma municipal": (-4.8769, 29.6260),
    "kasulu": (-4.5770, 30.1030),

    # === SONGWE REGION ===
    "songwe": (-8.6700, 33.2700),
    "vwawa": (-9.1130, 32.9370),

    # === GEITA REGION ===
    "geita": (-2.8700, 32.2300),
    "geita town": (-2.8700, 32.2300),

    # === SIMIYU REGION ===
    "simiyu": (-2.8500, 34.1500),
    "bariadi": (-2.8000, 33.9800),

    # === KATAVI REGION ===
    "katavi": (-6.8200, 31.2700),
    "mpanda": (-6.3460, 31.0700),

    # === NJOMBE REGION ===
    "njombe town": (-9.3400, 34.7700),
    "makambako": (-8.8800, 34.8400),

    # === PWANI (COAST) REGION ===
    "pwani": (-7.3200, 38.8500),
    "bagamoyo": (-6.4330, 38.9040),
    "kibaha": (-6.7670, 38.9290),
    "rufiji": (-7.9770, 39.2670),
    "mafia": (-7.9120, 39.7650),
    "mkuranga": (-7.1450, 39.1940),

    # === MANYARA REGION ===
    "manyara": (-4.0500, 36.0500),
    "babati": (-4.2130, 35.7470),
    "mbulu": (-3.8570, 35.5360),
    "hanang": (-4.4350, 35.3940),

    # === RUVUMA REGION ===
    "ruvuma": (-10.6800, 35.7000),
    "songea": (-10.6820, 35.6470),
    "songea municipal": (-10.6820, 35.6470),
    "tunduru": (-11.0980, 37.3640),
}


def _parse_centroid(centroid: str | None) -> tuple[float | None, float | None]:
    """Extract (latitude, longitude) from a WKT POINT string."""
    if not centroid:
        return None, None
    m = _WKT_POINT.match(centroid)
    if m:
        return float(m.group(2)), float(m.group(1))
    return None, None


def _lookup_local(district: str, area_name: str | None, region: str) -> Optional[tuple[float, float]]:
    """Look up coordinates in the built-in dictionary. Tries area first, then district."""
    # Normalize strings for matching
    area_key = (area_name or "").strip().lower()
    district_key = district.strip().lower()

    # Try area_name first (more specific)
    if area_key and area_key in _TANZANIA_COORDS:
        return _TANZANIA_COORDS[area_key]

    # Try district
    if district_key in _TANZANIA_COORDS:
        return _TANZANIA_COORDS[district_key]

    # Try district + " municipal"
    if f"{district_key} municipal" in _TANZANIA_COORDS:
        return _TANZANIA_COORDS[f"{district_key} municipal"]

    # Try district + " city"
    if f"{district_key} city" in _TANZANIA_COORDS:
        return _TANZANIA_COORDS[f"{district_key} city"]

    return None


class GeocodingService:
    """Geocodes property locations using local dictionary + Nominatim (OpenStreetMap)."""

    @staticmethod
    def geocode_nominatim(query: str, country_code: str = "tz") -> Optional[tuple[float, float]]:
        """
        Geocode a free-text query via Nominatim API.
        Returns (latitude, longitude) or None.
        """
        params = urllib.parse.urlencode({
            "q": query,
            "format": "json",
            "limit": 1,
            "countrycodes": country_code,
        })
        url = f"{NOMINATIM_URL}?{params}"

        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if data and len(data) > 0:
                    lat = float(data[0]["lat"])
                    lng = float(data[0]["lon"])
                    logger.info(f"Nominatim geocoded '{query}' -> ({lat}, {lng})")
                    return lat, lng
                logger.warning(f"No Nominatim results for '{query}'")
                return None
        except Exception as e:
            logger.warning(f"Nominatim request failed for '{query}': {e}")
            return None

    @staticmethod
    def geocode_property(prop: Property) -> Optional[tuple[float, float]]:
        """
        Geocode a property from its location fields.

        Strategy:
          1. Try built-in dictionary (instant, works offline)
          2. Try Nominatim API (precise, needs network)
          3. Fall back to dictionary district-level coords
        """
        region_name = prop.region.value if hasattr(prop.region, "value") else str(prop.region)
        region_label = "Zanzibar" if "zanzibar" in region_name.lower() else "Tanzania Mainland"
        district = prop.district or ""
        area = prop.area_name or ""

        # 1. Try local dictionary first (instant)
        local_result = _lookup_local(district, area, region_name)

        # 2. Try Nominatim for more precise location
        queries = []
        if area and district:
            queries.append(f"{area}, {district}, {region_label}, Tanzania")
        if district:
            queries.append(f"{district}, {region_label}, Tanzania")

        for query in queries:
            nominatim_result = GeocodingService.geocode_nominatim(query)
            if nominatim_result:
                return nominatim_result

        # 3. Fall back to local dictionary result
        if local_result:
            logger.info(
                f"Using local coords for {prop.title_number}: "
                f"district={district}, area={area} -> {local_result}"
            )
            return local_result

        return None

    @staticmethod
    def geocode_and_cache(db: Session, prop: Property) -> tuple[float | None, float | None]:
        """
        Returns (lat, lng) for a property:
          1. If centroid already exists in DB, parse and return it
          2. Otherwise geocode and save to DB for future use
        """
        # Check existing centroid first
        lat, lng = _parse_centroid(getattr(prop, "centroid", None))
        if lat is not None and lng is not None:
            return lat, lng

        # Geocode from location fields
        result = GeocodingService.geocode_property(prop)
        if result:
            lat, lng = result
            # Cache result as WKT in the centroid column
            wkt = f"POINT({lng} {lat})"
            prop.centroid = wkt
            try:
                db.add(prop)
                db.commit()
                logger.info(f"Cached geocoded centroid for {prop.title_number}: {wkt}")
            except Exception as e:
                db.rollback()
                logger.error(f"Failed to cache centroid for {prop.title_number}: {e}")
            return lat, lng

        return None, None
