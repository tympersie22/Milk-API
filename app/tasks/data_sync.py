from sqlalchemy.orm import Session

from app.services.provider_sync_service import ProviderSyncService



def run_provider_sync(db: Session, region: str | None = None) -> list[dict]:
    service = ProviderSyncService()
    results = service.sync(db, region=region)
    return [
        {
            "provider": r.provider,
            "processed": r.processed,
            "succeeded": r.succeeded,
            "failed": r.failed,
            "status": r.status,
        }
        for r in results
    ]
