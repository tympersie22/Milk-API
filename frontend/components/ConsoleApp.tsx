"use client";

import { FormEvent, useMemo, useState } from "react";
import { API_BASE, apiRequest } from "../lib/api";

type Json = Record<string, unknown>;
type ApiEnvelope = { status: number | string; data: Json };
type Region = "mainland" | "zanzibar";
type ReportStatus = "processing" | "completed" | "failed";
type ReportFormat = "json" | "pdf";

type ReportListItem = {
  report_id: string;
  status: ReportStatus;
  requested_format: ReportFormat;
  title_number: string;
  property_id: string;
  region: Region;
  created_at: string;
  completed_at?: string | null;
};

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
  const [reportId, setReportId] = useState("");
  const [reportStatus, setReportStatus] = useState("idle");
  const [historyStatus, setHistoryStatus] = useState<"" | ReportStatus>("");
  const [historyRegion, setHistoryRegion] = useState<"" | Region>("");
  const [historyFormat, setHistoryFormat] = useState<"" | ReportFormat>("");
  const [historyTitle, setHistoryTitle] = useState("");
  const [historyRows, setHistoryRows] = useState<ReportListItem[]>([]);

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

  async function createReportJob(format: "json" | "pdf"): Promise<string | null> {
    const data = await run(() =>
      apiRequest("/reports/full", {
        method: "POST",
        apiKey,
        timeoutMs: 60000,
        body: JSON.stringify(
          propertyId
            ? { property_id: propertyId, format, include_risk: true }
            : { title_number: titleNumber, region, format, include_risk: true }
        )
      })
    );

    const id = data && typeof data.report_id === "string" ? data.report_id : null;
    if (id) {
      setReportId(id);
      setReportStatus("processing");
    }
    return id;
  }

  async function pollReportDone(id: string): Promise<boolean> {
    for (let i = 0; i < 20; i += 1) {
      const res = await apiRequest(`/reports/${id}`, { apiKey, timeoutMs: 60000 });
      const data = (await res.json()) as Json;
      setResponse({ status: res.status, data });
      if (!res.ok) return false;
      const status = typeof data.status === "string" ? data.status : "";
      if (status === "completed") {
        setReportStatus("completed");
        return true;
      }
      if (status === "failed") {
        setReportStatus("failed");
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    setReportStatus("processing");
    return false;
  }

  async function downloadReportByFormat(id: string, format: "json" | "pdf") {
    const signed = await apiRequest(`/reports/${id}/download-url?format=${format}`, {
      apiKey,
      timeoutMs: 30000
    });
    const signedData = (await signed.json()) as Json;
    const downloadUrl = typeof signedData.download_url === "string" ? signedData.download_url : "";
    if (!signed.ok || !downloadUrl) {
      setResponse({ status: signed.status, data: signedData });
      return;
    }

    const fileRes = await fetch(downloadUrl, { cache: "no-store" });
    if (!fileRes.ok) {
      const text = await fileRes.text();
      setResponse({ status: fileRes.status, data: { message: text } });
      return;
    }
    const blob = await fileRes.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `milki-report-${titleNumber}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    setResponse({
      status: 200,
      data: {
        message: `${format.toUpperCase()} downloaded`,
        bytes: blob.size,
        report_id: id
      }
    });
  }

  async function runReportDownload(format: "json" | "pdf") {
    setLoading(true);
    try {
      const id = await createReportJob(format);
      if (!id) return;
      const done = await pollReportDone(id);
      if (!done) return;
      await downloadReportByFormat(id, format);
      await loadReportHistory();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setResponse({ status: "error", data: { message } });
    } finally {
      setLoading(false);
    }
  }

  async function onFullReportJson() {
    await runReportDownload("json");
  }

  async function onFullReportPdf() {
    await runReportDownload("pdf");
  }

  async function loadReportHistory() {
    const params = new URLSearchParams();
    if (historyStatus) params.set("status", historyStatus);
    if (historyRegion) params.set("region", historyRegion);
    if (historyFormat) params.set("format", historyFormat);
    if (historyTitle.trim()) params.set("title_number", historyTitle.trim());
    params.set("page", "1");
    params.set("per_page", "20");

    const path = `/reports${params.toString() ? `?${params.toString()}` : ""}`;
    const res = await apiRequest(path, { apiKey });
    const data = (await res.json()) as Json;
    setResponse({ status: res.status, data });
    if (!res.ok) return;

    const rows = Array.isArray(data.data) ? (data.data as ReportListItem[]) : [];
    setHistoryRows(rows);
  }

  async function redownload(reportId: string, format: ReportFormat) {
    if (!apiKey) return;
    setLoading(true);
    try {
      await downloadReportByFormat(reportId, format);
    } finally {
      setLoading(false);
    }
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
              <button disabled={!apiKey || loading} onClick={onFullReportJson}>Download JSON</button>
              <button disabled={!apiKey || loading} onClick={onFullReportPdf}>Download PDF</button>
            </div>
            <p className="token">Property ID: {propertyId || "-"}</p>
            <p className="token">Report ID: {reportId || "-"}</p>
            <p className="token">Report Status: {reportStatus}</p>
          </div>
        </article>

        <article className="panel">
          <h2>Report History</h2>
          <div className="stack">
            <div className="row wrap">
              <label className="field">
                <span>Status</span>
                <select value={historyStatus} onChange={(e) => setHistoryStatus(e.target.value as "" | ReportStatus)}>
                  <option value="">All</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </label>
              <label className="field">
                <span>Region</span>
                <select value={historyRegion} onChange={(e) => setHistoryRegion(e.target.value as "" | Region)}>
                  <option value="">All</option>
                  <option value="mainland">Mainland</option>
                  <option value="zanzibar">Zanzibar</option>
                </select>
              </label>
              <label className="field">
                <span>Format</span>
                <select value={historyFormat} onChange={(e) => setHistoryFormat(e.target.value as "" | ReportFormat)}>
                  <option value="">All</option>
                  <option value="json">JSON</option>
                  <option value="pdf">PDF</option>
                </select>
              </label>
            </div>
            <label className="field">
              <span>Title contains</span>
              <input value={historyTitle} onChange={(e) => setHistoryTitle(e.target.value)} placeholder="e.g. ZNZ-NGW" />
            </label>
            <button disabled={!apiKey || loading} onClick={loadReportHistory}>Load History</button>

            <div className="stack">
              {historyRows.length === 0 ? (
                <p className="token">No report history loaded yet.</p>
              ) : (
                historyRows.map((row) => (
                  <div key={row.report_id} className="panel" style={{ padding: "10px" }}>
                    <p className="token">Report: {row.report_id}</p>
                    <p className="token">
                      {row.title_number} | {row.region} | {row.status} | {row.requested_format}
                    </p>
                    <div className="row wrap">
                      <button disabled={row.status !== "completed" || loading} onClick={() => redownload(row.report_id, "pdf")}>
                        Re-download PDF
                      </button>
                      <button disabled={row.status !== "completed" || loading} onClick={() => redownload(row.report_id, "json")}>
                        Re-download JSON
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
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
