# Milki API - Full Codebase Audit Report

**Date:** March 10, 2026
**Scope:** Backend (Python/FastAPI), Frontend (Next.js/React), Tests, Config, Infrastructure
**Files Analyzed:** 50+ files across all directories

---

## Executive Summary

Milki API is a Tanzania Property Intelligence platform with a FastAPI backend, SQLAlchemy ORM, Alembic migrations, and a Next.js frontend console. The codebase has a solid architectural foundation but contains **7 critical**, **9 high**, **10 medium**, and **15+ low** severity issues that need to be addressed before any production deployment.

The most urgent issues are **hardcoded secrets**, a **missing .gitignore**, and **database files committed to the repo**.

---

## CRITICAL (Fix Immediately)

### 1. No `.gitignore` File
There is no `.gitignore` in the project root. This means `.db` files, `.env` files, cache directories, and build artifacts can all be accidentally committed.

**Action:** Create a `.gitignore` immediately (see Recommendations below).

### 2. Database Files in Repository
`milki.db` and `runcheck.db` are sitting in the project root. These contain all application data including encrypted PII, user credentials, and audit logs.

**Action:** Add `*.db` to `.gitignore`. If this repo has been pushed anywhere, consider the data compromised and rotate all secrets.

### 3. Hardcoded JWT Secret Key
In `app/config.py`, the secret key defaults to `"change_me"`. Anyone who reads the source code can forge valid JWT tokens for any user.

**Action:** Remove the default value entirely. Require `SECRET_KEY` as a mandatory environment variable. Fail startup if it's missing.

### 4. Hardcoded PII Encryption Key
In `app/config.py`, the encryption key defaults to `"0123456789abcdef0123456789abcdef"`. All encrypted owner names and NIDA data can be trivially decrypted.

**Action:** Same approach - no defaults, mandatory env var, fail on startup if missing.

### 5. Weak Encryption Key Derivation
`app/core/encryption.py` derives the Fernet key by SHA256-hashing the config key. This is non-standard and weakens the encryption if the base key is compromised.

**Action:** Use PBKDF2 or `Fernet.generate_key()` for proper key derivation.

### 6. Hardcoded Docker Credentials
`docker-compose.yml` contains plaintext Postgres credentials (`milki` / `milki_dev`).

**Action:** Move to a `.env.docker` file that is gitignored.

### 7. Frontend `.env.local` Committed
`frontend/.env.local` is in the repository. While it only contains a localhost URL now, this file should never be version-controlled.

**Action:** Add to `.gitignore`.

---

## HIGH (Fix Before Any Deployment)

### 8. API Key Hashing Uses Plain SHA256
`app/core/security.py` hashes API keys with `hashlib.sha256()`. This is fast and vulnerable to rainbow table attacks.

**Action:** Use bcrypt or Argon2 for API key hashing, similar to how passwords are handled.

### 9. No API Key Expiration Check
`authenticate_api_key()` in `app/core/security.py` never checks `key.expires_at`. Expired keys work forever.

**Action:** Add an expiration check before returning the auth context.

### 10. Password Field Not Masked in Frontend
`frontend/components/ConsoleApp.tsx` renders the password input without `type="password"`. Passwords are visible in plaintext on screen.

**Action:** Add `type="password"` to the password input element.

### 11. Hardcoded Demo Credentials in Frontend
The ConsoleApp initializes state with `demo@milki.tz` and `Password123!` as default values, visible in source code and DevTools.

**Action:** Remove hardcoded credentials. Use placeholder text instead.

### 12. Consent Validation is Trivially Bypassable
The GDPR-style `consent_confirmed` parameter is just a boolean query param. Any API key holder can pass `true` to access all owner PII.

**Action:** Implement proper consent tracking in the database with timestamps and audit trails.

### 13. In-Memory Rate Limiter is Not Thread-Safe
`app/core/rate_limiter.py` uses a `deque` without locking. Under concurrent requests (Uvicorn workers), rate limits can be bypassed.

**Action:** Switch to Redis-based rate limiting (Redis is already in your config).

### 14. Overly Permissive CORS
`app/main.py` sets `allow_methods=["*"]` and `allow_headers=["*"]` with `allow_credentials=True`. This is too open.

**Action:** Explicitly list only the methods and headers your API actually uses.

### 15. No Rate Limiting on Auth Endpoints
Login and register endpoints have no rate limiting, enabling brute-force attacks.

**Action:** Add per-IP rate limiting on `/auth/login` (e.g., 5 attempts/minute) and `/auth/register`.

### 16. No Request Timeout in Frontend API Client
`frontend/lib/api.ts` makes fetch calls with no timeout. Requests can hang indefinitely.

**Action:** Add `AbortController` with a 30-second timeout.

---

## MEDIUM (Fix Before Beta/Production)

### 17. Weak Password Requirements
`app/schemas/auth.py` only requires 8 characters minimum. No complexity rules.

**Action:** Require 12+ characters. Consider adding complexity validation or using zxcvbn-style strength checking.

### 18. No HTTPS Enforcement
No HSTS headers, no HTTPS redirect in the application.

**Action:** Add security headers middleware (HSTS, X-Content-Type-Options, X-Frame-Options).

### 19. Audit Logs in Separate Transactions
`app/core/audit.py` commits audit logs in their own transaction. If the main operation succeeds but audit fails, actions go unlogged.

**Action:** Write audit logs within the same transaction as the operation.

### 20. No Pagination on Ownership History
The ownership history endpoint returns all records with no pagination. A property with thousands of ownership changes would blow up memory.

**Action:** Add `limit`/`offset` parameters.

### 21. Webhook Secrets Stored in Plaintext
`app/models/webhook.py` stores webhook secrets as plain strings. Database compromise exposes all webhook signing secrets.

**Action:** Encrypt webhook secrets using the same Fernet encryption as PII.

### 22. Risk Engine Returns Hardcoded Scores
`app/api/v1/risk.py` passes hardcoded factor values (2.0, 1.0, 3.0...) to the risk engine. Every property gets the same risk score.

**Action:** Compute actual risk factors from property, ownership, dispute, and zone data.

### 23. Health Endpoint Lies About Service Status
`app/api/health.py` returns `"db": "ok", "redis": "ok"` without actually checking connectivity.

**Action:** Add real connectivity checks (try a simple query/ping).

### 24. Missing Frontend Type Safety
The ConsoleApp uses generic `Record<string, unknown>` for all API responses. No specific interfaces for login, property search, etc.

**Action:** Define TypeScript interfaces for each API endpoint response.

### 25. Test Coverage is Minimal
Only ~151 lines of tests total. No frontend tests. No error path testing. No concurrent request tests.

**Action:** Aim for 70%+ code coverage. Add negative test cases and edge cases.

### 26. Webhook URLs Not Validated for SSRF
No validation that webhook URLs don't point to private IP ranges (127.0.0.1, 192.168.*, 10.*, etc.).

**Action:** Validate webhook URLs against private IP ranges before storing or triggering.

---

## LOW (Fix for Production Readiness)

- **Missing logging throughout** - No structured logging for auth failures, rate limit hits, PII access, or errors
- **No database connection pooling config** - `create_engine()` uses defaults; add `pool_size`, `max_overflow`, `pool_timeout`
- **No request body size limits** - Large payloads could cause DoS
- **JWT access token TTL is 60 min** - Consider 15-30 min for sensitive operations
- **API key generation reduces entropy** - Replacing `-` and `_` characters in the token is unnecessary
- **Inconsistent timestamp handling** - Mix of `server_default=func.now()` and Python defaults across models
- **Missing `nullable=False`** on several foreign key columns
- **Soft delete exists but is never used** in queries (`deleted_at` on Property model)
- **Test fixtures use fixed emails** - Could conflict in parallel test runs
- **No Error Boundary** in the React frontend - component errors crash the whole app
- **Response data displayed unsanitized** - JWT tokens and API keys shown in plaintext in the console UI
- **No client-side rate limiting** - Users can spam API requests rapidly
- **Missing accessibility attributes** - No `aria-label`, `required`, or `autocomplete` on form inputs
- **No `Cache-Control` headers** on sensitive API responses
- **`X-Request-ID` accepts client values** - Should always generate server-side

---

## Recommended `.gitignore` (Create This Now)

```
# Environment
.env
.env.local
.env.*.local
.env.docker

# Databases
*.db
*.sqlite
*.sqlite3

# Python
__pycache__/
*.py[cod]
*.egg-info/
.venv/
venv/
dist/
build/

# Node
node_modules/
.next/

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Caches
.pytest_cache/
.ruff_cache/
.mypy_cache/
```

---

## Recommended Priority Order

**Phase 1 - Today (Security Emergencies):**
1. Create `.gitignore` with the template above
2. Remove `milki.db` and `runcheck.db` from version control
3. Remove default values from `SECRET_KEY` and `PII_ENCRYPTION_KEY` in config
4. Add `type="password"` to the frontend password field
5. Remove hardcoded demo credentials from ConsoleApp
6. Move Docker credentials to an env file

**Phase 2 - This Week (High Priority):**
7. Switch API key hashing from SHA256 to bcrypt
8. Add API key expiration checking
9. Implement Redis-based rate limiting
10. Add rate limiting on auth endpoints
11. Tighten CORS configuration
12. Add request timeout to frontend API client

**Phase 3 - Before Beta (Medium Priority):**
13. Strengthen password requirements
14. Add security headers (HSTS, etc.)
15. Make audit logging transactional
16. Add pagination to ownership history
17. Encrypt webhook secrets
18. Implement real health checks
19. Add SSRF validation for webhook URLs
20. Wire up actual risk factor computation

**Phase 4 - Production Readiness (Low Priority):**
21. Add structured logging
22. Configure database connection pooling
23. Add request size limits
24. Expand test coverage to 70%+
25. Add frontend error boundaries and type safety
26. Add accessibility attributes to forms
