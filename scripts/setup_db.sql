-- Milki DB Setup: Create all missing tables for SQLite dev environment
-- Run with: sqlite3 milki.db < scripts/setup_db.sql

-- ── api_users ──
CREATE TABLE IF NOT EXISTS api_users (
    id CHAR(36) NOT NULL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    company VARCHAR(200),
    tier VARCHAR(20) NOT NULL DEFAULT 'free',
    phone VARCHAR(20),
    monthly_quota INTEGER NOT NULL DEFAULT 100,
    requests_this_month INTEGER NOT NULL DEFAULT 0,
    quota_reset_at DATETIME,
    password_hash VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT 1,
    is_verified BOOLEAN NOT NULL DEFAULT 0,
    nida_verified BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_api_users_email ON api_users(email);

-- ── api_keys ──
CREATE TABLE IF NOT EXISTS api_keys (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL REFERENCES api_users(id),
    key_prefix VARCHAR(16) NOT NULL,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT 1,
    last_used_at DATETIME,
    expires_at DATETIME,
    permissions JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS ix_api_keys_key_prefix ON api_keys(key_prefix);

-- ── ownerships ──
CREATE TABLE IF NOT EXISTS ownerships (
    id CHAR(36) NOT NULL PRIMARY KEY,
    property_id CHAR(36) NOT NULL REFERENCES properties(id),
    owner_name_encrypted BLOB NOT NULL,
    owner_nida_hash VARCHAR(64),
    owner_type VARCHAR(50) NOT NULL,
    owner_nationality VARCHAR(3),
    acquired_date DATE,
    acquisition_method VARCHAR(50),
    transfer_ref VARCHAR(100),
    is_current BOOLEAN NOT NULL DEFAULT 1,
    has_mortgage BOOLEAN NOT NULL DEFAULT 0,
    has_caveat BOOLEAN NOT NULL DEFAULT 0,
    has_lien BOOLEAN NOT NULL DEFAULT 0,
    encumbrance_details JSON,
    privacy_opt_out BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ownerships_property ON ownerships(property_id);

-- ── zones ──
CREATE TABLE IF NOT EXISTS zones (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    zone_code VARCHAR(50),
    region VARCHAR(20) NOT NULL,
    district VARCHAR(100) NOT NULL,
    zone_type VARCHAR(20) NOT NULL,
    max_floors INTEGER,
    max_coverage_pct NUMERIC(5,2),
    min_plot_size_sqm NUMERIC(12,2),
    setback_front_m NUMERIC(6,2),
    setback_side_m NUMERIC(6,2),
    allowed_uses JSON,
    restricted_uses JSON,
    boundary TEXT NOT NULL,
    gazette_ref VARCHAR(100),
    effective_date DATE,
    data_source VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_zones_region ON zones(region);

-- ── disputes ──
CREATE TABLE IF NOT EXISTS disputes (
    id CHAR(36) NOT NULL PRIMARY KEY,
    property_id CHAR(36) REFERENCES properties(id),
    case_number VARCHAR(100),
    court_name VARCHAR(200),
    dispute_type VARCHAR(100),
    status VARCHAR(20) NOT NULL,
    filed_date DATE,
    resolution_date DATE,
    description TEXT,
    affects_title BOOLEAN NOT NULL DEFAULT 1,
    blocks_transfer BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_disputes_property ON disputes(property_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);

-- ── risk_scores ──
CREATE TABLE IF NOT EXISTS risk_scores (
    id CHAR(36) NOT NULL PRIMARY KEY,
    property_id CHAR(36) NOT NULL REFERENCES properties(id),
    overall_score NUMERIC(4,2) NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    ownership_chain_score NUMERIC(4,2),
    dispute_score NUMERIC(4,2),
    encumbrance_score NUMERIC(4,2),
    zone_compliance_score NUMERIC(4,2),
    documentation_score NUMERIC(4,2),
    data_freshness_score NUMERIC(4,2),
    risk_factors JSON NOT NULL,
    recommendations JSON,
    algorithm_version VARCHAR(20) NOT NULL,
    calculated_at DATETIME NOT NULL,
    valid_until DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_risk_property ON risk_scores(property_id);
CREATE INDEX IF NOT EXISTS idx_risk_level ON risk_scores(risk_level);

-- ── valuations ──
CREATE TABLE IF NOT EXISTS valuations (
    id CHAR(36) NOT NULL PRIMARY KEY,
    property_id CHAR(36) NOT NULL REFERENCES properties(id),
    estimated_value_tzs NUMERIC(15,2),
    estimated_value_usd NUMERIC(15,2),
    confidence_interval_low NUMERIC(15,2),
    confidence_interval_high NUMERIC(15,2),
    confidence_pct NUMERIC(5,2),
    comparables_count INTEGER,
    comparables JSON,
    valuation_method VARCHAR(50),
    model_version VARCHAR(20),
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── price_history ──
CREATE TABLE IF NOT EXISTS price_history (
    id CHAR(36) NOT NULL PRIMARY KEY,
    property_id CHAR(36) REFERENCES properties(id),
    district VARCHAR(100),
    area_name VARCHAR(200),
    transaction_date DATE NOT NULL,
    price_tzs NUMERIC(15,2),
    price_usd NUMERIC(15,2),
    price_per_sqm_tzs NUMERIC(12,2),
    area_sqm NUMERIC(12,2),
    land_type VARCHAR(20),
    source VARCHAR(50) NOT NULL,
    source_ref VARCHAR(200),
    verified BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_price_district ON price_history(district, transaction_date);
CREATE INDEX IF NOT EXISTS idx_price_area ON price_history(area_name, transaction_date);

-- ── payments ──
CREATE TABLE IF NOT EXISTS payments (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL REFERENCES api_users(id),
    property_id CHAR(36) REFERENCES properties(id),
    amount_tzs NUMERIC(12,2) NOT NULL,
    amount_usd NUMERIC(12,2),
    currency VARCHAR(3) NOT NULL DEFAULT 'TZS',
    provider VARCHAR(20) NOT NULL,
    provider_ref VARCHAR(200),
    phone_number VARCHAR(20),
    service_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    initiated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    failed_at DATETIME,
    failure_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_provider_ref ON payments(provider_ref);

-- ── webhook_subscriptions ──
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL REFERENCES api_users(id),
    url VARCHAR(500) NOT NULL,
    events JSON NOT NULL,
    secret VARCHAR(64) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    failure_count INTEGER NOT NULL DEFAULT 0,
    last_triggered_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── audit_logs ──
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id CHAR(36),
    api_key_prefix VARCHAR(16),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id CHAR(36),
    ip_address VARCHAR(64),
    user_agent TEXT,
    request_id CHAR(36),
    details JSON,
    data_categories JSON,
    legal_basis VARCHAR(50),
    cross_border BOOLEAN NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);

-- ── reports ──
CREATE TABLE IF NOT EXISTS reports (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL REFERENCES api_users(id),
    property_id CHAR(36) NOT NULL REFERENCES properties(id),
    title_number VARCHAR(100) NOT NULL,
    requested_format VARCHAR(16) DEFAULT 'json',
    status VARCHAR(20) DEFAULT 'processing',
    error_message TEXT,
    include_valuation BOOLEAN DEFAULT 1,
    include_risk BOOLEAN DEFAULT 1,
    include_comparables BOOLEAN DEFAULT 1,
    include_zipa BOOLEAN DEFAULT 0,
    report_json JSON,
    report_pdf BLOB,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_property ON reports(property_id);
CREATE INDEX IF NOT EXISTS idx_reports_title ON reports(title_number);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

-- ── sync_runs ──
CREATE TABLE IF NOT EXISTS sync_runs (
    id CHAR(36) NOT NULL PRIMARY KEY,
    source VARCHAR(50) NOT NULL,
    region VARCHAR(20) NOT NULL,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at DATETIME,
    status VARCHAR(20) NOT NULL DEFAULT 'running',
    records_fetched INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    errors JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Update alembic version
UPDATE alembic_version SET version_num = '20260310_0005';

-- Verify
SELECT 'Tables created: ' || COUNT(*) FROM sqlite_master WHERE type='table';
