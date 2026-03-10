const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/v1";

export async function apiRequest(
  path: string,
  options: RequestInit & { token?: string; apiKey?: string } = {}
): Promise<Response> {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
  if (options.apiKey) headers.set("X-API-Key", options.apiKey);

  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    cache: "no-store"
  });
}

export { API_BASE };
