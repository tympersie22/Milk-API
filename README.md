# Milki API

Milki API is a Tanzania-focused property intelligence API that layers analytics on top of e-Ardhi and BPRA data sources.

## Current Build Scope

- PostgreSQL-first schema with enum types and PostGIS columns via Alembic migration
- Domain models for properties, ownership, zones, disputes, risk, valuation, users/keys, payments, webhooks, audit logs
- API key auth + JWT auth endpoints
- Usage quotas and per-minute rate limiting by tier
- PDPA-style audit logging on protected endpoints
- Zanzibar BPRA and mainland e-Ardhi connectors (stubbed)
- Seed script with realistic Zanzibar corridor sample data

## Quickstart

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

## Seed Data

```bash
make seed
```

Seed areas:
- Nungwi
- Kendwa
- Paje
- Bwejuu
- Stone Town
- Kiwengwa
- Pwani Mchangani

## Test

```bash
pytest
```
