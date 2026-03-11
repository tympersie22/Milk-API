export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/v1";

const DEFAULT_TIMEOUT_MS = 30_000;

export type Json = Record<string, unknown>;

export type ApiEnvelope = {
  status: number | string;
  data: Json;
};

export type Region = "mainland" | "zanzibar";
export type ReportStatus = "processing" | "completed" | "failed";
export type ReportFormat = "json" | "pdf";

export type ReportListItem = {
  report_id: string;
  status: ReportStatus;
  requested_format: ReportFormat;
  title_number: string;
  property_id: string;
  region: Region;
  created_at: string;
  completed_at?: string | null;
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
