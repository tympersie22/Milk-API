const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/v1";

const DEFAULT_TIMEOUT_MS = 30_000;

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

export { API_BASE };
