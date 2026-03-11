export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:8000/v1";

const DEFAULT_TIMEOUT_MS = 30_000;

export type Json = Record<string, unknown>;

export type ApiEnvelope = {
  status: number | string;
  data: Json;
};

export type Region = "mainland" | "zanzibar";
export type ReportStatus = "processing" | "completed" | "failed";
export type ReportFormat = "json" | "pdf";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type ApiTier = "free" | "basic" | "professional" | "enterprise";

/* --- Auth responses (matches app/schemas/auth.py) --- */
export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
};

export type ApiKeyResponse = {
  key: string;
  prefix: string;
  name: string;
};

export type UsageResponse = {
  requests_this_month: number;
  quota: number;
  tier: ApiTier;
  reset_at: string;
};

/* --- Property responses (matches app/schemas/property.py) --- */
export type PropertySummary = {
  id: string;
  title_number: string;
  region: Region;
  district: string;
  area_name: string;
  land_type: string;
  is_verified: boolean;
};

export type PaginationMeta = {
  page: number;
  per_page: number;
  total: number;
};

export type PropertySearchResponse = {
  data: PropertySummary[];
  pagination: PaginationMeta;
};

export type VerifyResponse = {
  title_number: string;
  region: Region;
  found: boolean;
  verified: boolean;
  data_source: string;
  confidence: number;
  message: string;
};

/* --- Risk responses (matches app/schemas/risk.py) --- */
export type RiskFactor = {
  score: number;
  details: string;
};

export type RiskResponse = {
  overall_score: number;
  risk_level: RiskLevel;
  factors: Record<string, RiskFactor>;
  recommendations: string[];
  valid_until: string;
};

/* --- Report responses (matches app/schemas/reports.py) --- */
export type ReportCreateResponse = {
  report_id: string;
  status: ReportStatus;
  estimated_seconds: number;
  callback_url: string;
  processing_mode: "queued" | "inline";
};

export type ReportListItem = {
  report_id: string;
  status: ReportStatus;
  format: ReportFormat;
  title_number: string;
  property_id: string;
  region: Region;
  created_at: string;
  completed_at?: string | null;
};

export type ReportListResponse = {
  data: ReportListItem[];
  pagination: PaginationMeta;
};

export type SignedDownloadResponse = {
  download_url: string;
  expires_at: string;
  format: ReportFormat;
};

export async function apiRequest(
  path: string,
  options: RequestInit & { token?: string; apiKey?: string; timeoutMs?: number } = {}
): Promise<Response> {
  const { token, apiKey, timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;

  const headers = new Headers(fetchOptions.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (apiKey) headers.set("X-API-Key", apiKey);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Run an API call and return the envelope, handling errors gracefully */
export async function runApi(
  action: () => Promise<Response>
): Promise<ApiEnvelope | null> {
  try {
    const res = await action();
    const data = (await res.json()) as Json;
    return { status: res.status, data };
  } catch (error) {
    return {
      status: "error",
      data: { message: error instanceof Error ? error.message : "Unknown error" },
    };
  }
}

/** Check if an API response is a rate limit error */
export function isRateLimited(payload: ApiEnvelope | null): boolean {
  if (!payload) return false;
  if (payload.status === 429) return true;
  const error = (payload.data?.error as Json) || {};
  return error.code === "RATE_LIMIT_EXCEEDED";
}

/** Get retry-after seconds from a rate limit response */
export function getRetryAfter(payload: ApiEnvelope | null): number {
  if (!payload) return 60;
  const error = (payload.data?.error as Json) || {};
  const retryAfter = error.retry_after ?? payload.data?.retry_after;
  return typeof retryAfter === "number" ? retryAfter : 60;
}

export function getErrorHint(payload: ApiEnvelope | null): string {
  if (!payload || typeof payload.status !== "number" || payload.status < 400) return "";
  const error = ((payload.data.error as Json | undefined) || {}) as Json;
  const code = typeof error.code === "string" ? error.code : "";

  const hints: Record<string, string> = {
    EMAIL_ALREADY_REGISTERED: "That email is already registered. Try logging in instead.",
    INVALID_CREDENTIALS: "Invalid email or password. Please try again.",
    MISSING_API_KEY: "You need an API key first. Generate one in Settings.",
    MISSING_TOKEN: "Please log in to continue.",
    RATE_LIMIT_EXCEEDED: "Rate limit reached. Wait a moment and retry.",
    REPORT_NOT_READY: "Report is still processing. It'll be ready shortly.",
  };

  return hints[code] || "Something went wrong. Check the details below.";
}

export function statusVariant(payload: ApiEnvelope | null): "success" | "warning" | "error" | "neutral" {
  if (!payload || typeof payload.status !== "number") return "neutral";
  if (payload.status >= 200 && payload.status < 300) return "success";
  if (payload.status >= 400 && payload.status < 500) return "warning";
  if (payload.status >= 500) return "error";
  return "neutral";
}
