from app.services.risk_engine import RiskEngine


def test_risk_engine_low_band():
    result = RiskEngine.compute(
        {
            "ownership_chain": 1.0,
            "disputes": 1.0,
            "encumbrances": 1.0,
            "zone_compliance": 1.0,
            "documentation": 1.0,
            "data_freshness": 1.0,
        }
    )
    assert result["overall_score"] == 1.0
    assert result["risk_level"] == "low"


def test_risk_engine_critical_band():
    result = RiskEngine.compute(
        {
            "ownership_chain": 10.0,
            "disputes": 10.0,
            "encumbrances": 9.0,
            "zone_compliance": 8.0,
            "documentation": 8.0,
            "data_freshness": 7.0,
        }
    )
    assert result["overall_score"] > 7.5
    assert result["risk_level"] == "critical"
