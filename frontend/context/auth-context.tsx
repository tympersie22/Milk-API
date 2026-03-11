"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiRequest, type Json } from "../lib/api";

type AuthState = {
  token: string;
  apiKey: string;
  email: string;
  name: string;
  isAuthenticated: boolean;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  generateApiKey: () => Promise<{ ok: boolean; key?: string; error?: string }>;
  logout: () => void;
  setApiKey: (key: string) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "milki_auth";

function loadPersistedAuth(): Partial<AuthState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function persistAuth(state: Partial<AuthState>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked — ignore */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: "",
    apiKey: "",
    email: "",
    name: "",
    isAuthenticated: false,
  });

  // Hydrate from localStorage on mount
  useEffect(() => {
    const persisted = loadPersistedAuth();
    if (persisted.token) {
      setState({
        token: persisted.token || "",
        apiKey: persisted.apiKey || "",
        email: persisted.email || "",
        name: persisted.name || "",
        isAuthenticated: true,
      });
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as Json;
      if (!res.ok) {
        const err = (data.error as Json)?.message || data.detail || "Login failed";
        return { ok: false, error: String(err) };
      }
      const token = String(data.access_token || "");

      // Try to get user name from login response, or fall back to fetching usage/profile
      let userName = String(data.name || data.user_name || "");

      // If login response doesn't include name, try fetching usage endpoint which may have it
      if (!userName && token) {
        try {
          const usageRes = await apiRequest("/auth/usage", { token, timeoutMs: 10000 });
          if (usageRes.ok) {
            const usageData = (await usageRes.json()) as Json;
            userName = String(usageData.name || usageData.user_name || usageData.email || "");
          }
        } catch {
          /* best-effort — not critical */
        }
      }

      // Still no name? Use the part before @ in the email
      if (!userName) {
        userName = email.split("@")[0];
      }

      const newState: AuthState = {
        token,
        apiKey: state.apiKey,
        email,
        name: userName || state.name,
        isAuthenticated: true,
      };
      setState(newState);
      persistAuth(newState);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Network error" };
    }
  }, [state.apiKey, state.name]);

  const register = useCallback(async (regName: string, email: string, password: string) => {
    try {
      const res = await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name: regName, email, password }),
      });
      const data = (await res.json()) as Json;
      if (!res.ok) {
        const err = (data.error as Json)?.message || data.detail || "Registration failed";
        return { ok: false, error: String(err) };
      }
      // Persist the name so it's available immediately after login redirect
      setState(prev => {
        const next = { ...prev, name: regName, email };
        persistAuth(next);
        return next;
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Network error" };
    }
  }, []);

  const generateApiKey = useCallback(async () => {
    try {
      const res = await apiRequest("/auth/api-keys", {
        method: "POST",
        token: state.token,
        body: JSON.stringify({ name: "dashboard-key" }),
      });
      const data = (await res.json()) as Json;
      if (!res.ok) {
        const err = (data.error as Json)?.message || data.detail || "Failed to generate key";
        return { ok: false, error: String(err) };
      }
      const key = String(data.key || "");
      const newState = { ...state, apiKey: key };
      setState(newState);
      persistAuth(newState);
      return { ok: true, key };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Network error" };
    }
  }, [state]);

  const logout = useCallback(() => {
    const empty: AuthState = { token: "", apiKey: "", email: "", name: "", isAuthenticated: false };
    setState(empty);
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
  }, []);

  const setApiKey = useCallback((key: string) => {
    setState(prev => {
      const next = { ...prev, apiKey: key };
      persistAuth(next);
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, generateApiKey, logout, setApiKey }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
