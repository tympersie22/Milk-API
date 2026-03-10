from datetime import datetime
from pydantic import BaseModel


class RiskFactor(BaseModel):
    score: float
    details: str


class RiskResponse(BaseModel):
    overall_score: float
    risk_level: str
    factors: dict[str, RiskFactor]
    recommendations: list[str]
    valid_until: datetime
