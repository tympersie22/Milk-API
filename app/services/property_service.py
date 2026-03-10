from datetime import UTC, datetime
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.connectors.bpra import BPRAConnector
from app.connectors.eardhi import EArdhiConnector
from app.models.enums import LandType, OwnershipType, RegionType
from app.models.property import Property
from app.schemas.property import PropertySearchQuery


class PropertyService:
    _bpra_connector = BPRAConnector()
    _eardhi_connector = EArdhiConnector()

    @staticmethod
    def _persist_connector_record(db: Session, record: dict) -> Property:
        existing = db.scalar(
            select(Property).where(Property.title_number == record["title_number"])
        )
        if existing:
            return existing

        property_obj = Property(
            title_number=record["title_number"],
            region=RegionType(record["region"]),
            district=record["district"],
            ward=record.get("ward"),
            street=record.get("street"),
            area_name=record.get("area_name"),
            land_type=LandType(record["land_type"]),
            ownership_type=OwnershipType(record["ownership_type"]),
            area_sqm=record.get("area_sqm"),
            is_verified=True,
            last_verified_at=datetime.now(UTC),
            data_source=record.get("data_source", "stub"),
            data_confidence=record.get("data_confidence", 0.8),
            foreign_eligible=record.get("foreign_eligible"),
            zipa_registered=record.get("zipa_registered"),
            coastal_buffer_zone=record.get("coastal_buffer_zone", False),
            heritage_zone=record.get("heritage_zone", False),
        )
        db.add(property_obj)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            fallback = db.scalar(
                select(Property).where(Property.title_number == record["title_number"])
            )
            if fallback:
                return fallback
            raise
        db.refresh(property_obj)
        return property_obj

    @classmethod
    def _connector_lookup(cls, title_number: str, region: str | None = None) -> dict | None:
        if region == "zanzibar":
            return cls._bpra_connector.get_property_by_title(title_number)
        if region == "mainland":
            return cls._eardhi_connector.get_property_by_title(title_number)
        if title_number.startswith("ZNZ-"):
            return cls._bpra_connector.get_property_by_title(title_number)
        return cls._eardhi_connector.get_property_by_title(title_number)

    @classmethod
    def search(cls, db: Session, query: PropertySearchQuery) -> tuple[list[Property], int]:
        stmt = select(Property)

        if query.title_number:
            stmt = stmt.where(Property.title_number == query.title_number)
        if query.region:
            try:
                region = RegionType(query.region)
            except ValueError:
                return [], 0
            stmt = stmt.where(Property.region == region)
        if query.district:
            stmt = stmt.where(Property.district == query.district)
        if query.area_name:
            stmt = stmt.where(Property.area_name.ilike(f"%{query.area_name}%"))
        if query.land_type:
            try:
                land_type = LandType(query.land_type)
            except ValueError:
                return [], 0
            stmt = stmt.where(Property.land_type == land_type)

        records = db.scalars(stmt).all()

        if not records and query.title_number:
            existing = db.scalar(
                select(Property).where(Property.title_number == query.title_number)
            )
            if existing:
                if query.region and existing.region != RegionType(query.region):
                    return [], 0
                records = [existing]
                total = len(records)
                start = (query.page - 1) * query.per_page
                end = start + query.per_page
                return records[start:end], total

            external = cls._connector_lookup(query.title_number, query.region)
            if external:
                if query.region and external.get("region") != query.region:
                    return [], 0
                records = [cls._persist_connector_record(db, external)]

        total = len(records)
        start = (query.page - 1) * query.per_page
        end = start + query.per_page
        return records[start:end], total

    @classmethod
    def verify(cls, db: Session, title_number: str, region: str) -> Property | None:
        try:
            region_enum = RegionType(region)
        except ValueError:
            return None
        stmt = select(Property).where(
            Property.title_number == title_number,
            Property.region == region_enum,
        )
        record = db.scalar(stmt)
        if record:
            return record

        external = cls._connector_lookup(title_number, region)
        if not external:
            return None
        return cls._persist_connector_record(db, external)
