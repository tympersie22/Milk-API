from datetime import date
from pydantic import BaseModel


class OwnershipRecord(BaseModel):
    owner_name: str
    owner_type: str
    owner_nationality: str | None = None
    acquired_date: date | None = None
    acquisition_method: str | None = None
    transfer_ref: str | None = None
    is_current: bool
    has_mortgage: bool
    has_caveat: bool
    has_lien: bool
    encumbrance_details: dict | None = None


class OwnershipResponse(BaseModel):
    property_id: str
    current_owner: OwnershipRecord


class OwnershipHistoryResponse(BaseModel):
    property_id: str
    history: list[OwnershipRecord]
