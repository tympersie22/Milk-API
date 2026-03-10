from datetime import datetime

from pydantic import BaseModel


class SyncRunItem(BaseModel):
    id: str
    provider: str
    region: str | None = None
    status: str
    processed_count: int
    succeeded_count: int
    failed_count: int
    started_at: datetime
    completed_at: datetime | None = None
    error_message: str | None = None


class SyncRunListResponse(BaseModel):
    data: list[SyncRunItem]


class ProviderHealthItem(BaseModel):
    provider: str
    status: str
    last_run_at: datetime | None = None
    processed: int | None = None
    succeeded: int | None = None
    failed: int | None = None


class ProviderHealthResponse(BaseModel):
    data: list[ProviderHealthItem]


class SyncTriggerResponse(BaseModel):
    results: list[dict]
