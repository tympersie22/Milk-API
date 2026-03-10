from datetime import UTC, date, datetime, timedelta
import hashlib
import uuid

from sqlalchemy import select

from app.core.encryption import encrypt_text
from app.data.mainland_seed import MAINLAND_SAMPLE_PROPERTIES
from app.data.zanzibar_seed import ZANZIBAR_CORRIDOR_PROPERTIES
from app.db.session import SessionLocal
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


def _valuation_baseline(area_name: str, region: str) -> tuple[float, float]:
    premium_areas = {"Stone Town", "Kendwa", "Nungwi", "Masaki", "Mikocheni", "Oysterbay"}
    if area_name in premium_areas:
        return 1_450_000_000, 570_000
    if region == "mainland":
        return 880_000_000, 345_000
    return 780_000_000, 305_000


def _should_seed_dispute(area_name: str) -> bool:
    return area_name in {"Stone Town", "Paje", "Kariakoo"}


def _risk_for_area(area_name: str) -> tuple[float, RiskLevel]:
    if area_name in {"Stone Town", "Paje", "Kariakoo"}:
        return 4.4, RiskLevel.medium
    return 2.3, RiskLevel.low


def seed() -> None:
    db = SessionLocal()
    inserted = 0
    updated = 0
    dataset = [*ZANZIBAR_CORRIDOR_PROPERTIES, *MAINLAND_SAMPLE_PROPERTIES]

    try:
        for item in dataset:
            lng, lat = item["centroid"]
            centroid = f"POINT({lng} {lat})"
            boundary = make_square_polygon(lng, lat)
            existing = db.scalar(select(Property).where(Property.title_number == item["title_number"]))
            if existing:
                prop = existing
                prop.region = RegionType(item["region"])
                prop.district = item["district"]
                prop.ward = item["ward"]
                prop.street = item["street"]
                prop.area_name = item["area_name"]
                prop.land_type = LandType(item["land_type"])
                prop.ownership_type = OwnershipType(item["ownership_type"])
                prop.area_sqm = item["area_sqm"]
                prop.boundary = boundary
                prop.centroid = centroid
                prop.is_verified = True
                prop.last_verified_at = datetime.now(UTC)
                prop.data_source = item["data_source"]
                prop.data_confidence = item["data_confidence"]
                prop.foreign_eligible = item["foreign_eligible"]
                prop.zipa_registered = item["zipa_registered"]
                prop.coastal_buffer_zone = item["coastal_buffer_zone"]
                prop.heritage_zone = item["heritage_zone"]
                updated += 1
            else:
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
                inserted += 1

            has_current_owner = db.scalar(
                select(Ownership.id).where(Ownership.property_id == prop.id, Ownership.is_current.is_(True))
            )
            if not has_current_owner:
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
                        has_mortgage=prop.area_name in {"Kendwa", "Paje", "Mikocheni", "Kariakoo"},
                        has_caveat=False,
                        has_lien=False,
                        encumbrance_details={"notes": "Seeded sample chain"},
                    )
                )
            has_legacy_owner = db.scalar(
                select(Ownership.id).where(
                    Ownership.property_id == prop.id,
                    Ownership.transfer_ref == f"OLD-{prop.title_number}",
                )
            )
            if not has_legacy_owner:
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

            has_dispute = db.scalar(select(Dispute.id).where(Dispute.property_id == prop.id))
            if _should_seed_dispute(prop.area_name or "") and not has_dispute:
                db.add(
                    Dispute(
                        property_id=prop.id,
                        case_number=f"LC-{prop.title_number[-4:]}",
                        court_name=(
                            "Zanzibar Land Tribunal"
                            if prop.region == RegionType.zanzibar
                            else "High Court Land Division"
                        ),
                        dispute_type="boundary",
                        status=DisputeStatus.hearing,
                        filed_date=date(2025, 11, 15),
                        description="Boundary overlap allegation by neighboring parcel",
                        affects_title=True,
                        blocks_transfer=prop.area_name == "Stone Town",
                    )
                )

            has_risk = db.scalar(select(RiskScore.id).where(RiskScore.property_id == prop.id))
            if not has_risk:
                risk_score, risk_level = _risk_for_area(prop.area_name or "")
                db.add(
                    RiskScore(
                        property_id=prop.id,
                        overall_score=risk_score,
                        risk_level=risk_level,
                        ownership_chain_score=2.5,
                        dispute_score=6.5 if risk_level == RiskLevel.medium else 1.0,
                        encumbrance_score=3.5,
                        zone_compliance_score=2.0,
                        documentation_score=1.5,
                        data_freshness_score=1.0,
                        risk_factors={"seed": True, "area": prop.area_name, "region": prop.region.value},
                        recommendations=["Commission legal review before transfer"],
                        algorithm_version="v1",
                        valid_until=datetime.now(UTC) + timedelta(days=30),
                    )
                )

            estimated_tzs, estimated_usd = _valuation_baseline(prop.area_name or "", prop.region.value)
            has_valuation = db.scalar(select(Valuation.id).where(Valuation.property_id == prop.id))
            if not has_valuation:
                db.add(
                    Valuation(
                        property_id=prop.id,
                        estimated_value_tzs=estimated_tzs,
                        estimated_value_usd=estimated_usd,
                        confidence_interval_low=estimated_tzs * 0.84,
                        confidence_interval_high=estimated_tzs * 1.16,
                        confidence_pct=82.0,
                        comparables_count=14,
                        comparables={"areas": [prop.area_name], "region": prop.region.value},
                        valuation_method="hybrid",
                        model_version="v1",
                    )
                )
            has_price_history = db.scalar(select(PriceHistory.id).where(PriceHistory.property_id == prop.id))
            if not has_price_history:
                db.add(
                    PriceHistory(
                        property_id=prop.id,
                        district=prop.district,
                        area_name=prop.area_name,
                        transaction_date=date(2025, 8, 1),
                        price_tzs=estimated_tzs * 0.92,
                        price_usd=estimated_usd * 0.92,
                        price_per_sqm_tzs=(estimated_tzs * 0.92) / float(prop.area_sqm),
                        area_sqm=prop.area_sqm,
                        land_type=prop.land_type,
                        source="agent_report",
                        source_ref=f"agent:{(prop.area_name or 'unknown').lower().replace(' ', '-')}",
                        verified=True,
                    )
                )

            has_zone = db.scalar(
                select(Zone.id).where(
                    Zone.region == prop.region,
                    Zone.district == prop.district,
                    Zone.zone_code == f"ZN-{(prop.area_name or 'GEN')[:3].upper()}",
                )
            )
            if not has_zone:
                db.add(
                    Zone(
                        name=f"{prop.area_name} Mixed Zone",
                        zone_code=f"ZN-{(prop.area_name or 'GEN')[:3].upper()}",
                        region=prop.region,
                        district=prop.district,
                        zone_type=prop.land_type,
                        max_floors=4,
                        max_coverage_pct=55.0,
                        min_plot_size_sqm=400.0,
                        setback_front_m=6.0,
                        setback_side_m=3.0,
                        allowed_uses=["residential", "hospitality", "commercial"],
                        restricted_uses=["heavy_industry"],
                        boundary=boundary,
                        gazette_ref=("ZNZ/GZT/2025/44" if prop.region == RegionType.zanzibar else "URB/GZT/2025/11"),
                        effective_date=date(2025, 1, 1),
                        data_source=("zipa" if prop.region == RegionType.zanzibar else "mlhhsd"),
                    )
                )

        db.commit()
        print(
            "Seed complete: inserted "
            f"{inserted} new properties, updated {updated} existing properties "
            "across Zanzibar + Mainland corridors"
        )
    finally:
        db.close()


if __name__ == "__main__":
    seed()
