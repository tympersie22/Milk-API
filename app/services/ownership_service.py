from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.encryption import decrypt_text
from app.models.ownership import Ownership


class OwnershipService:
    @staticmethod
    def get_current(db: Session, property_id: str) -> Ownership | None:
        stmt = select(Ownership).where(
            Ownership.property_id == UUID(property_id), Ownership.is_current.is_(True)
        )
        return db.scalar(stmt)

    @staticmethod
    def get_history(db: Session, property_id: str) -> list[Ownership]:
        stmt = select(Ownership).where(Ownership.property_id == UUID(property_id)).order_by(
            Ownership.acquired_date.desc()
        )
        return list(db.scalars(stmt).all())

    @staticmethod
    def to_record(row: Ownership) -> dict:
        return {
            "owner_name": decrypt_text(row.owner_name_encrypted),
            "owner_type": row.owner_type,
            "owner_nationality": row.owner_nationality,
            "acquired_date": row.acquired_date,
            "acquisition_method": row.acquisition_method,
            "transfer_ref": row.transfer_ref,
            "is_current": row.is_current,
            "has_mortgage": row.has_mortgage,
            "has_caveat": row.has_caveat,
            "has_lien": row.has_lien,
            "encumbrance_details": row.encumbrance_details,
        }
