# Provider Sync Roadmap (Engineering Division)

## Objective
Replace static-only stubs with ingestion-ready provider abstraction while keeping API contracts stable.

## Implemented Scaffold
- Provider abstraction in connectors (`list_properties`, `provider_name`).
- `ProviderSyncService` to sync BPRA/e-Ardhi records with confidence scoring.
- `scripts/sync_providers.py` operational entrypoint.
- Upsert hook exposed in `PropertyService` for provider data writes.

## Next Engineering Iterations
1. Incremental sync using source cursors/checkpoints.
2. Provider-specific normalization/mapping rules.
3. Dispute/ownership reconciliation from independent feeds.
4. Confidence versioning and explainability fields.
5. Schedule sync via worker/Celery with retries and dead-letter queue.

## Operational Guardrails
- Persist sync runs (`sync_runs` table) for observability.
- Emit metrics: processed, inserted, updated, failed.
- Enforce idempotency key per provider + title + source timestamp.
