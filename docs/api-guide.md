# Milki API Guide

## Base URL
- Local: `http://localhost:8000/v1`

## Authentication
- API keys for data endpoints: `X-API-Key: mlk_live_xxx`
- Bearer JWT for developer auth endpoints

## Implemented Endpoints
- `GET /health`
- `GET /health/ready`
- `GET /v1/property/search`
- `POST /v1/property/verify`
- `GET /v1/property/{property_id}/risk`
- `GET /v1/property/{property_id}/ownership`
- `GET /v1/property/{property_id}/ownership/history`
- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `POST /v1/auth/api-keys`
- `GET /v1/auth/usage`

## Quotas and Limits
- Free: 100/month, 10/min
- Basic: 1,000/month, 30/min
- Professional: 10,000/month, 120/min
- Enterprise: unlimited/month, 600/min

## Ownership PII Access
- Ownership endpoints require query params:
  - `consent_confirmed=true`
  - `legal_basis` in `consent|contract|legal_obligation|legitimate_interest`
- Requests are audit-logged with PDPA-relevant metadata before response.

## Seeding Zanzibar Corridor Data
Run:

```bash
make seed
```

Seeded focus areas:
- Nungwi
- Kendwa
- Paje
- Bwejuu
- Stone Town
- Kiwengwa
- Pwani Mchangani
