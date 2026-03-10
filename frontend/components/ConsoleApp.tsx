"use client";

import { FormEvent, useMemo, useState } from "react";
import { API_BASE, apiRequest } from "../lib/api";

type Json = Record<string, unknown>;
type ApiEnvelope = { status: number | string; data: Json };
type Region = "mainland" | "zanzibar";

function responseStatusLabel(payload: ApiEnvelope | null): string {
  if (!payload) return "No Response";
  if (typeof payload.status === "number") return `HTTP ${payload.status}`;
  return "Client Error";
}

function responseStatusClass(payload: ApiEnvelope | null): string {
  if (!payload || typeof payload.status !== "number") return "neutral";
  if (payload.status >= 200 && payload.status < 300) return "ok";
  if (payload.status >= 400 && payload.status < 500) return "warn";
  if (payload.status >= 500) return "error";
  return "neutral";
}

function getErrorHint(payload: ApiEnvelope | null): string {
  if (!payload || typeof payload.status !== "number" || payload.status < 400) return "";

  const data = payload.data || {};
  const error = (data.error as Json | undefined) || {};
  const code = typeof error.code === "string" ? error.code : "";

  if (code === "EMAIL_ALREADY_REGISTERED") {
    return "This email is already registered. Click Login instead, or use a new email.";
  }
  if (code === "INVALID_CREDENTIALS") {
    return "Invalid email or password. Confirm password or register first.";
  }
  if (code === "MISSING_TOKEN") {
    return "Please login first to get an access token.";
  }
  if (code === "MISSING_API_KEY") {
    return "Generate an API key before running property endpoints.";
  }
  if (code === "MONTHLY_QUOTA_EXCEEDED" || code === "RATE_LIMIT_EXCEEDED") {
    return "Request limit reached for this account tier. Try again later or upgrade tier.";
  }
  return "Request failed. Check the response payload below for details.";
}

export function ConsoleApp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const [token, setToken] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [titleNumber, setTitleNumber] = useState("ZNZ-NGW-0001");
  const [region, setRegion] = useState<Region>("zanzibar");
  const [propertyId, setPropertyId] = useState("");

  const [response, setResponse] = useState<ApiEnvelope | null>(null);
  const [loading, setLoading] = useState(false);

  const ownershipUrl = useMemo(() => {
    if (!propertyId) return "";
    return `/property/${propertyId}/ownership?consent_confirmed=true&legal_basis=consent`;
  }, [propertyId]);

  async function run(action: () => Promise<Response>) {
    setLoading(true);
    try {
      const res = await action();
      const data = (await res.json()) as Json;
      setResponse({ status: res.status, data });
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setResponse({ status: "error", data: { message } });
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function onRegister(e: FormEvent) {
    e.preventDefault();
    await run(() =>
      apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, name })
      })
    );
  }

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    const data = await run(() =>
      apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      })
    );
    if (data && typeof data.access_token === "string") setToken(data.access_token);
  }

  async function onGenerateKey() {
    const data = await run(() =>
      apiRequest("/auth/api-keys", {
        method: "POST",
        token,
        body: JSON.stringify({ name: "browser-console" })
      })
    );
    if (data && typeof data.key === "string") setApiKey(data.key);
  }

  async function onSearch() {
    const query = `/property/search?title_number=${encodeURIComponent(titleNumber)}&region=${encodeURIComponent(region)}`;
    const data = await run(() => apiRequest(query, { apiKey }));
    const row = (data?.data as Array<{ id?: string }> | undefined)?.[0];
    if (row?.id) setPropertyId(row.id);
  }

  async function onVerify() {
    await run(() =>
      apiRequest("/property/verify", {
        method: "POST",
        apiKey,
        body: JSON.stringify({ title_number: titleNumber, region })
      })
    );
  }

  async function onRisk() {
    if (!propertyId) return;
    await run(() => apiRequest(`/property/${propertyId}/risk`, { apiKey }));
  }

  async function onOwnership() {
    if (!ownershipUrl) return;
    await run(() => apiRequest(ownershipUrl, { apiKey }));
  }

  async function onOwnershipHistory() {
    if (!propertyId) return;
    await run(() =>
      apiRequest(
        `/property/${propertyId}/ownership/history?consent_confirmed=true&legal_basis=contract`,
        { apiKey }
      )
    );
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-top">
          <p className="eyebrow">Milki API</p>
          <span className="chip">Tanzania Property Intelligence</span>
        </div>
        <h1>Developer Console</h1>
        <p className="lead">Auth, key issuance, property checks, verification, risk and ownership in one workflow.</p>
        <div className="hero-meta">
          <span>Base URL: {API_BASE}</span>
          <span>Regions: Tanzania Mainland, Zanzibar</span>
        </div>
      </section>

      <section className="grid">
        <article className="panel">
          <h2>Auth</h2>
          <form onSubmit={onRegister} className="stack">
            <label className="field">
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
            </label>
            <label className="field">
              <span>Email</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
              />
            </label>
            <div className="row">
              <button disabled={loading} type="submit">Register</button>
              <button disabled={loading} onClick={onLogin} type="button">Login</button>
            </div>
            <button disabled={!token || loading} onClick={onGenerateKey} type="button">Generate API Key</button>
          </form>
          <p className="token">Token: {token ? `${token.slice(0, 20)}...` : "-"}</p>
          <p className="token">API Key: {apiKey ? `${apiKey.slice(0, 20)}...` : "-"}</p>
        </article>

        <article className="panel">
          <h2>Property Flows</h2>
          <div className="stack">
            <label className="field">
              <span>Title Number</span>
              <input
                value={titleNumber}
                onChange={(e) => setTitleNumber(e.target.value)}
                placeholder="Title Number"
              />
            </label>
            <label className="field">
              <span>Region</span>
              <select value={region} onChange={(e) => setRegion(e.target.value as Region)}>
                <option value="mainland">Tanzania Mainland</option>
                <option value="zanzibar">Zanzibar</option>
              </select>
            </label>
            <div className="row wrap">
              <button disabled={!apiKey || loading} onClick={onSearch}>Search</button>
              <button disabled={!apiKey || loading} onClick={onVerify}>Verify</button>
              <button disabled={!apiKey || !propertyId || loading} onClick={onRisk}>Risk</button>
              <button disabled={!apiKey || !propertyId || loading} onClick={onOwnership}>Ownership</button>
              <button disabled={!apiKey || !propertyId || loading} onClick={onOwnershipHistory}>History</button>
            </div>
            <p className="token">Property ID: {propertyId || "-"}</p>
          </div>
        </article>
      </section>

      <section className="panel response">
        <div className="response-head">
          <h2>Response</h2>
          <div className={`status-pill ${responseStatusClass(response)}`}>{responseStatusLabel(response)}</div>
        </div>
        {getErrorHint(response) ? <p className="hint">{getErrorHint(response)}</p> : null}
        <pre>{JSON.stringify(response, null, 2)}</pre>
      </section>
    </main>
  );
}
