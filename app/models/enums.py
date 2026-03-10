from enum import Enum


class RegionType(str, Enum):
    mainland = "mainland"
    zanzibar = "zanzibar"


class LandType(str, Enum):
    residential = "residential"
    commercial = "commercial"
    agricultural = "agricultural"
    industrial = "industrial"
    mixed_use = "mixed_use"
    government = "government"
    conservation = "conservation"


class OwnershipType(str, Enum):
    freehold = "freehold"
    leasehold = "leasehold"
    customary = "customary"
    granted_right_of_occupancy = "granted_right_of_occupancy"
    residential_license = "residential_license"


class RiskLevel(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class DisputeStatus(str, Enum):
    filed = "filed"
    hearing = "hearing"
    resolved = "resolved"
    appealed = "appealed"


class PaymentStatus(str, Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"
    refunded = "refunded"


class PaymentProvider(str, Enum):
    mpesa = "mpesa"
    tigo_pesa = "tigo_pesa"
    airtel_money = "airtel_money"
    halo_pesa = "halo_pesa"
    card = "card"
    bank_transfer = "bank_transfer"


class ApiTier(str, Enum):
    free = "free"
    basic = "basic"
    professional = "professional"
    enterprise = "enterprise"


class WebhookEvent(str, Enum):
    property_updated = "property.updated"
    title_transferred = "title.transferred"
    dispute_filed = "dispute.filed"
    dispute_resolved = "dispute.resolved"
    zone_changed = "zone.changed"
