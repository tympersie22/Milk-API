from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select, type_coerce, Uuid as SAUuid
from sqlalchemy.orm import Session

from app.models.dispute import Dispute
from app.models.enums import DisputeStatus
from app.models.ownership import Ownership
from app.models.property import Property
from app.schemas.risk import RiskFactor


WEIGHTS = {
    "ownership_chain": 0.25,
    "disputes": 0.25,
    "encumbrances": 0.20,
    "zone_compliance": 0.15,
    "documentation": 0.10,
    "data_freshness": 0.05,
}


class RiskEngine:
    @staticmethod
    def compute_from_db(db: Session, property_id: UUID) -> dict:
        """Compute risk factors from actual database records."""
        prop = db.get(Property, property_id)
        pid = type_coerce(property_id, SAUuid())  # ensure correct binding on SQLite
        factors = {}
        recommendations: list[str] = []

        # --- Ownership chain risk (0-10) ---
        ownership_count = db.scalar(
            select(func.count()).select_from(
                select(Ownership).where(Ownership.property_id == pid).subquery()
            )
        ) or 0
        if ownership_count == 0:
            factors["ownership_chain"] = 8.0
            recommendations.append("No ownership records found — verify title provenance")
        elif ownership_count == 1:
            factors["ownership_chain"] = 1.0
        elif ownership_count <= 3:
            factors["ownership_chain"] = 2.5
        elif ownership_count <= 6:
            factors["ownership_chain"] = 5.0
        else:
            factors["ownership_chain"] = 7.0
            recommendations.append("Frequent ownership changes detected — investigate transfer history")

        # --- Dispute risk (0-10) ---
        active_disputes = db.scalar(
            select(func.count()).select_from(
                select(Dispute).where(
                    Dispute.property_id == pid,
                    Dispute.status.in_([DisputeStatus.filed, DisputeStatus.hearing, DisputeStatus.appealed]),
                ).subquery()
            )
        ) or 0
        blocking_disputes = db.scalar(
            select(func.count()).select_from(
                select(Dispute).where(
                    Dispute.property_id == pid,
                    Dispute.blocks_transfer.is_(True),
                    Dispute.status.in_([DisputeStatus.filed, DisputeStatus.hearing, DisputeStatus.appealed]),
                ).subquery()
            )
        ) or 0

        if blocking_disputes > 0:
            factors["disputes"] = 10.0
            recommendations.append("Active transfer-blocking dispute(s) — do NOT proceed without legal review")
        elif active_disputes > 0:
            factors["disputes"] = min(active_disputes * 4.0, 9.0)
            recommendations.append("Active dispute(s) on record — obtain legal opinion before transfer")
        else:
            factors["disputes"] = 0.5

        # --- Encumbrance risk (0-10) ---
        current_owner = db.scalar(
            select(Ownership).where(
                Ownership.property_id == pid, Ownership.is_current.is_(True)
            )
        )
        encumbrance_score = 0.0
        if current_owner:
            if current_owner.has_mortgage:
                encumbrance_score += 4.0
                recommendations.append("Active mortgage — obtain discharge or consent before transfer")
            if current_owner.has_caveat:
                encumbrance_score += 3.0
                recommendations.append("Caveat registered — requires removal or court order")
            if current_owner.has_lien:
                encumbrance_score += 3.0
                recommendations.append("Lien on property — settle obligation before transfer")
        factors["encumbrances"] = min(encumbrance_score, 10.0)

        # --- Zone compliance risk (0-10) ---
        zone_score = 2.0  # baseline unknown
        if prop:
            if prop.coastal_buffer_zone:
                zone_score += 3.0
                recommendations.append("Property in coastal buffer zone — development restrictions apply")
            if prop.heritage_zone:
                zone_score += 3.0
                recommendations.append("Property in heritage zone — special approvals required")
            if prop.foreign_eligible is False:
                zone_score += 2.0
        factors["zone_compliance"] = min(zone_score, 10.0)

        # --- Documentation risk (0-10) ---
        doc_score = 5.0  # assume medium if we can't tell
        if prop:
            if prop.is_verified:
                doc_score = 1.0
            elif prop.survey_plan_ref:
                doc_score = 3.0
            if prop.data_confidence is not None:
                # data_confidence is 0.00 - 1.00; invert to risk
                doc_score = round((1.0 - float(prop.data_confidence)) * 10.0, 1)
        factors["documentation"] = min(doc_score, 10.0)

        # --- Data freshness risk (0-10) ---
        freshness_score = 5.0
        if prop and prop.last_verified_at:
            days_since = (datetime.now(UTC) - prop.last_verified_at.replace(tzinfo=UTC)).days
            if days_since <= 30:
                freshness_score = 1.0
            elif days_since <= 90:
                freshness_score = 3.0
            elif days_since <= 365:
                freshness_score = 5.0
            else:
                freshness_score = 8.0
                recommendations.append("Data not verified in over a year — request fresh verification")
        else:
            freshness_score = 7.0
            recommendations.append("No verification date on record — consider requesting verification")
        factors["data_freshness"] = freshness_score

        if not recommendations:
            recommendations.append("Run standard legal due diligence before transfer")

        return RiskEngine._score(factors, recommendations)

    @staticmethod
    def compute(factors: dict[str, float]) -> dict:
        """Fallback: compute from pre-supplied factor values."""
        return RiskEngine._score(factors, ["Run legal due diligence before transfer"])

    @staticmethod
    def _score(factors: dict[str, float], recommendations: list[str]) -> dict:
        score = 0.0
        for name, weight in WEIGHTS.items():
            score += factors.get(name, 0.0) * weight

        if score <= 2.5:
            level = "low"
        elif score <= 5.0:
            level = "medium"
        elif score <= 7.5:
            level = "high"
        else:
            level = "critical"

        return {
            "overall_score": round(score, 2),
            "risk_level": level,
            "factors": {
                k: RiskFactor(score=v, details=f"{k} risk component") for k, v in factors.items()
            },
            "recommendations": recommendations,
            "valid_until": datetime.now(UTC) + timedelta(days=30),
        }
