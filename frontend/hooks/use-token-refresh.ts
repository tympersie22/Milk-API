"use client";

import { useCallback, useEffect, useRef } from "react";
import { apiRequest } from "../lib/api";

type TokenRefreshOptions = {
  token: string;
  refreshToken?: string;
  expiresIn?: number; // seconds
  onRefreshed: (newToken: string, newRefreshToken?: string) => void;
  onExpired: () => void;
};

/**
 * Auto-refreshes the JWT access token before it expires.
 * Schedules refresh at 80% of token lifetime.
 * Falls back to logout if refresh fails.
 */
export function useTokenRefresh({
  token,
  refreshToken,
  expiresIn = 3600,
  onRefreshed,
  onExpired,
}: TokenRefreshOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!refreshToken) {
      onExpired();
      return;
    }

    try {
      const res = await apiRequest("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
        timeoutMs: 10000,
      });

      if (res.ok) {
        const data = await res.json();
        const newToken = data.access_token as string;
        const newRefresh = (data.refresh_token as string) || refreshToken;
        attemptRef.current = 0;
        onRefreshed(newToken, newRefresh);
      } else {
        // If refresh endpoint doesn't exist (404) or is unauthorized, expire
        if (res.status === 401 || res.status === 404) {
          onExpired();
        } else {
          // Retry with backoff
          attemptRef.current += 1;
          if (attemptRef.current < 3) {
            const backoff = attemptRef.current * 5000;
            timerRef.current = setTimeout(refresh, backoff);
          } else {
            onExpired();
          }
        }
      }
    } catch {
      // Network error — retry
      attemptRef.current += 1;
      if (attemptRef.current < 3) {
        timerRef.current = setTimeout(refresh, 5000);
      } else {
        onExpired();
      }
    }
  }, [refreshToken, onRefreshed, onExpired]);

  useEffect(() => {
    if (!token) return;

    // Schedule refresh at 80% of token lifetime
    const refreshAt = expiresIn * 0.8 * 1000;
    timerRef.current = setTimeout(refresh, refreshAt);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [token, expiresIn, refresh]);
}
