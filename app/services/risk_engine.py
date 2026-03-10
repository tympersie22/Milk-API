from datetime import UTC, datetime, timedelta
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
    def compute(factors: dict[str, float]) -> dict:
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
            "recommendations": ["Run legal due diligence before transfer"],
            "valid_until": datetime.now(UTC) + timedelta(days=30),
        }
