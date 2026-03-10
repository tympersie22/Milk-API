from sqlalchemy import select

from app.models.property import Property
from app.services.provider_sync_service import ProviderSyncService


def test_provider_sync_populates_connector_data(db_session):
    service = ProviderSyncService()
    results = service.sync(db_session)
    providers = {r.provider for r in results}
    assert "eardhi_stub" in providers
    assert "bpra_stub" in providers
    assert all(r.processed >= r.succeeded for r in results)

    mainland = db_session.scalar(select(Property).where(Property.title_number == "MLD-DAR-0001"))
    assert mainland is not None
    assert (mainland.region.value if hasattr(mainland.region, "value") else mainland.region) == "mainland"
