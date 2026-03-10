from datetime import UTC, date, datetime, timedelta
import hashlib
import uuid

from sqlalchemy import select

from app.data.zanzibar_seed import ZANZIBAR_CORRIDOR_PROPERTIES
from app.db.session import SessionLocal
from app.core.encryption import encrypt_text
from app.models.dispute import Dispute
from app.models.enums import DisputeStatus, LandType, OwnershipType, RegionType, RiskLevel
from app.models.ownership import Ownership
from app.models.property import Property
from app.models.risk_score import RiskScore
from app.models.valuation import PriceHistory, Valuation
from app.models.zone import Zone


def make_square_polygon(lng: float, lat: float, delta: float = 0.0025) -> str:
    return (
        f"POLYGON(({lng - delta} {lat - delta}, {lng + delta} {lat - delta}, "
        f"{lng + delta} {lat + delta}, {lng - delta} {lat + delta}, {lng - delta} {lat - delta}))"
    )


def owner_ciphertext(title: str) -> bytes:
    return encrypt_text(f"Milki Holdings {title[-4:]}")


def seed() -> None:
    db = SessionLocal()
    try:
        for item in ZANZIBAR_CORRIDOR_PROPERTIES:
            existing = db.scalar(select(Property).where(Property.title_number == item["title_number"]))
            if existing:
                continue

            lng, lat = item["centroid"]
            centroid = f"POINT({lng} {lat})"
            boundary = make_square_polygon(lng, lat)

            prop = Property(
                id=uuid.uuid4(),
                title_number=item["title_number"],
                region=RegionType(item["region"]),
                district=item["district"],
                ward=item["ward"],
                street=item["street"],
                area_name=item["area_name"],
                land_type=LandType(item["land_type"]),
                ownership_type=OwnershipType(item["ownership_type"]),
                area_sqm=item["area_sqm"],
                boundary=boundary,
                centroid=centroid,
                is_verified=True,
                last_verified_at=datetime.now(UTC),
                data_source=item["data_source"],
                data_confidence=item["data_confidence"],
                foreign_eligible=item["foreign_eligible"],
                zipa_registered=item["zipa_registered"],
                coastal_buffer_zone=item["coastal_buffer_zone"],
                heritage_zone=item["heritage_zone"],
            )
            db.add(prop)
            db.flush()

            db.add(
                Ownership(
                    property_id=prop.id,
                    owner_name_encrypted=owner_ciphertext(prop.title_number),
                    owner_nida_hash=hashlib.sha256(prop.title_number.encode("utf-8")).hexdigest(),
                    owner_type="company",
                    owner_nationality="TZA",
                    acquired_date=date(2021, 6, 1),
                    acquisition_method="purchase",
                    transfer_ref=f"TR-{prop.title_number}",
                    is_current=True,
                    has_mortgage=prop.area_name in {"Kendwa", "Paje"},
                    has_caveat=False,
                    has_lien=False,
                    encumbrance_details={"notes": "Seeded sample chain"},
                )
            )
            db.add(
                Ownership(
                    property_id=prop.id,
                    owner_name_encrypted=encrypt_text(f"Legacy Owner {prop.title_number[-3:]}"),
                    owner_nida_hash=hashlib.sha256(f"legacy-{prop.title_number}".encode("utf-8")).hexdigest(),
                    owner_type="individual",
                    owner_nationality="TZA",
                    acquired_date=date(2014, 5, 1),
                    acquisition_method="inheritance",
                    transfer_ref=f"OLD-{prop.title_number}",
                    is_current=False,
                    has_mortgage=False,
                    has_caveat=False,
                    has_lien=False,
                    encumbrance_details={"notes": "Historical ownership record"},
                )
            )

            if prop.area_name in {"Stone Town", "Paje"}:
                db.add(
                    Dispute(
                        property_id=prop.id,
                        case_number=f"LC-{prop.title_number[-4:]}",
                        court_name="Zanzibar Land Tribunal",
                        dispute_type="boundary",
                        status=DisputeStatus.hearing,
                        filed_date=date(2025, 11, 15),
                        description="Boundary overlap allegation by neighboring parcel",
                        affects_title=True,
                        blocks_transfer=prop.area_name == "Stone Town",
                    )
                )

            db.add(
                RiskScore(
                    property_id=prop.id,
                    overall_score=4.3 if prop.area_name in {"Paje", "Stone Town"} else 2.4,
                    risk_level=RiskLevel.medium if prop.area_name in {"Paje", "Stone Town"} else RiskLevel.low,
                    ownership_chain_score=2.5,
                    dispute_score=6.5 if prop.area_name in {"Paje", "Stone Town"} else 1.0,
                    encumbrance_score=3.5,
                    zone_compliance_score=2.0,
                    documentation_score=1.5,
                    data_freshness_score=1.0,
                    risk_factors={"seed": True, "area": prop.area_name},
                    recommendations=["Commission legal review before transfer"],
                    algorithm_version="v1",
                    valid_until=datetime.now(UTC) + timedelta(days=30),
                )
            )

            db.add(
                Valuation(
                    property_id=prop.id,
                    estimated_value_tzs=1_200_000_000 if prop.area_name == "Stone Town" else 780_000_000,
                    estimated_value_usd=470_000 if prop.area_name == "Stone Town" else 305_000,
                    confidence_interval_low=690_000_000,
                    confidence_interval_high=1_280_000_000,
                    confidence_pct=82.0,
                    comparables_count=14,
                    comparables={"areas": [prop.area_name]},
                    valuation_method="hybrid",
                    model_version="v1",
                )
            )
            db.add(
                PriceHistory(
                    property_id=prop.id,
                    district=prop.district,
                    area_name=prop.area_name,
                    transaction_date=date(2025, 8, 1),
                    price_tzs=760_000_000,
                    price_usd=298_000,
                    price_per_sqm_tzs=220_000,
                    area_sqm=prop.area_sqm,
                    land_type=prop.land_type,
                    source="agent_report",
                    source_ref=f"agent:{prop.area_name.lower().replace(' ', '-')}",
                    verified=True,
                )
            )

            db.add(
                Zone(
                    name=f"{prop.area_name} Mixed Zone",
                    zone_code=f"ZN-{prop.area_name[:3].upper()}",
                    region=RegionType.zanzibar,
                    district=prop.district,
                    zone_type=prop.land_type,
                    max_floors=4,
                    max_coverage_pct=55.0,
                    min_plot_size_sqm=400.0,
                    setback_front_m=6.0,
                    setback_side_m=3.0,
                    allowed_uses=["residential", "hospitality"],
                    restricted_uses=["heavy_industry"],
                    boundary=boundary,
                    gazette_ref="ZNZ/GZT/2025/44",
                    effective_date=date(2025, 1, 1),
                    data_source="zipa",
                )
            )

        db.commit()
        print("Seed complete: Zanzibar corridor records inserted")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
