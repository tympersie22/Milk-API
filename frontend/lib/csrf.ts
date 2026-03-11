/**
 * CSRF Protection Utilities
 *
 * Double-submit cookie pattern:
 * 1. Generate a random token on the client
 * 2. Store it in a cookie AND send it as a header
 * 3. Server compares cookie value vs header value
 *
 * Since we use JWT + API Key auth (not cookie-based sessions),
 * our primary CSRF defense is that we never use cookie auth.
 * This module adds an extra layer of protection via:
 * - SameSite cookie attributes
 * - Origin/Referer header validation
 * - Custom header requirement (X-Requested-With)
 */

const CSRF_COOKIE_NAME = "milki_csrf";
const CSRF_HEADER_NAME = "X-CSRF-Token";

/** Generate a random CSRF token */
export function generateCSRFToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, "0")).join("");
}

/** Get or create the CSRF token */
export function getCSRFToken(): string {
  if (typeof document === "undefined") return "";

  // Check existing cookie
  const existing = document.cookie
    .split("; ")
    .find(row => row.startsWith(`${CSRF_COOKIE_NAME}=`))
    ?.split("=")[1];

  if (existing) return existing;

  // Generate new token
  const token = generateCSRFToken();
  document.cookie = `${CSRF_COOKIE_NAME}=${token}; path=/; SameSite=Strict; Secure`;
  return token;
}

/** Get headers to include with state-changing requests */
export function getCSRFHeaders(): Record<string, string> {
  return {
    [CSRF_HEADER_NAME]: getCSRFToken(),
    "X-Requested-With": "XMLHttpRequest",
  };
}

/** Validate that a request origin matches our app */
export function validateOrigin(allowedOrigins: string[]): boolean {
  if (typeof window === "undefined") return true;
  return allowedOrigins.some(
    origin => window.location.origin === origin
  );
}
