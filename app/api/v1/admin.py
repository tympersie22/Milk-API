from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.audit import write_audit_log
from app.core.exceptions import ApiError
from app.core.security import get_current_user
from app.db.session import get_db
from app.models.api_user import ApiUser
from app.schemas.admin import ProviderHealthResponse, SyncRunItem, SyncRunListResponse, SyncTriggerResponse
from app.services.provider_sync_service import ProviderSyncService
from app.tasks.data_sync import run_provider_sync

router = APIRouter(prefix="/admin", tags=["admin"])



def _require_admin(user: ApiUser) -> None:
    tier = user.tier.value if hasattr(user.tier, "value") else str(user.tier)
    if tier != "enterprise":
        raise ApiError(status_code=403, code="FORBIDDEN", message="Enterprise tier required")


@router.post("/sync/run", response_model=SyncTriggerResponse)
def trigger_sync(
    request: Request,
    region: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: ApiUser = Depends(get_current_user),
) -> SyncTriggerResponse:
    _require_admin(user)
    if region not in (None, "mainland", "zanzibar"):
        raise ApiError(status_code=400, code="INVALID_REGION", message="region must be mainland or zanzibar")

    results = run_provider_sync(db, region=region)
    write_audit_log(
        db=db,
        action="admin.sync.trigger",
        request_id=request.state.request_id,
        user_id=str(user.id),
        details={"region": region, "results": results},
        data_categories=["ownership"],
        legal_basis="legitimate_interest",
    )
    db.commit()
    return SyncTriggerResponse(results=results)


@router.get("/sync/runs", response_model=SyncRunListResponse)
def list_sync_runs(
    db: Session = Depends(get_db),
    user: ApiUser = Depends(get_current_user),
) -> SyncRunListResponse:
    _require_admin(user)
    rows = ProviderSyncService.latest_runs(db, limit=50)
    return SyncRunListResponse(
        data=[
            SyncRunItem(
                id=str(r.id),
                provider=r.provider,
                region=r.region,
                status=r.status,
                processed_count=r.processed_count,
                succeeded_count=r.succeeded_count,
                failed_count=r.failed_count,
                started_at=r.started_at,
                completed_at=r.completed_at,
                error_message=r.error_message,
            )
            for r in rows
        ]
    )


@router.get("/sync/health", response_model=ProviderHealthResponse)
def sync_health(
    db: Session = Depends(get_db),
    user: ApiUser = Depends(get_current_user),
) -> ProviderHealthResponse:
    _require_admin(user)
    return ProviderHealthResponse(data=ProviderSyncService.provider_health(db))
