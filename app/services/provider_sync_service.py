from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.connectors.bpra import BPRAConnector
from app.connectors.eardhi import EArdhiConnector
from app.models.sync_run import SyncRun
from app.services.property_service import PropertyService


@dataclass
class SyncResult:
    provider: str
    processed: int
    succeeded: int
    failed: int
    status: str


class ProviderSyncService:
    def __init__(self) -> None:
        self._providers = [EArdhiConnector(), BPRAConnector()]

    @staticmethod
    def _calculate_confidence(record: dict) -> float:
        base = float(record.get("data_confidence", 0.75))
        completeness_fields = ["district", "area_name", "land_type", "ownership_type", "area_sqm", "centroid"]
        completeness = sum(1 for f in completeness_fields if record.get(f) is not None) / len(completeness_fields)
        freshness_boost = 0.03 if datetime.now(UTC).hour % 2 == 0 else 0.02
        return round(min(0.99, base * 0.7 + completeness * 0.3 + freshness_boost), 2)

    def sync(self, db: Session, region: str | None = None) -> list[SyncResult]:
        results: list[SyncResult] = []
        for provider in self._providers:
            records = provider.list_properties()
            if region:
                records = [r for r in records if r.get("region") == region]

            run = SyncRun(
                provider=provider.provider_name(),
                region=region,
                status="processing",
                processed_count=len(records),
                succeeded_count=0,
                failed_count=0,
                started_at=datetime.now(UTC),
            )
            db.add(run)
            db.flush()

            succeeded = 0
            failed = 0
            error_message = None

            for record in records:
                try:
                    hydrated = dict(record)
                    hydrated["data_confidence"] = self._calculate_confidence(hydrated)
                    PropertyService.upsert_from_connector_record(db, hydrated)
                    succeeded += 1
                except Exception as exc:
                    failed += 1
                    error_message = str(exc)[:500]

            status = "completed" if failed == 0 else "completed_with_errors"
            run.status = status
            run.succeeded_count = succeeded
            run.failed_count = failed
            run.error_message = error_message
            run.completed_at = datetime.now(UTC)
            db.add(run)

            results.append(
                SyncResult(
                    provider=provider.provider_name(),
                    processed=len(records),
                    succeeded=succeeded,
                    failed=failed,
                    status=status,
                )
            )

        db.commit()
        return results

    @staticmethod
    def latest_runs(db: Session, limit: int = 30) -> list[SyncRun]:
        return list(db.scalars(select(SyncRun).order_by(SyncRun.started_at.desc()).limit(limit)).all())

    @staticmethod
    def provider_health(db: Session) -> list[dict]:
        providers = ["eardhi_stub", "bpra_stub"]
        out: list[dict] = []
        for provider in providers:
            latest = db.scalar(
                select(SyncRun)
                .where(SyncRun.provider == provider)
                .order_by(SyncRun.started_at.desc())
                .limit(1)
            )
            if not latest:
                out.append({"provider": provider, "status": "never_synced", "last_run_at": None})
                continue
            out.append(
                {
                    "provider": provider,
                    "status": latest.status,
                    "last_run_at": latest.started_at,
                    "processed": latest.processed_count,
                    "succeeded": latest.succeeded_count,
                    "failed": latest.failed_count,
                }
            )
        return out
