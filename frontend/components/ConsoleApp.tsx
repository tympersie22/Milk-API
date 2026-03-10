"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
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

function responseStatusClass(payload: ApiEnvelope | null): "ok" | "warn" | "error" | "neutral" {
  if (!payload || typeof payload.status !== "number") return "neutral";
  if (payload.status >= 200 && payload.status < 300) return "ok";
  if (payload.status >= 400 && payload.status < 500) return "warn";
  if (payload.status >= 500) return "error";
  return "neutral";
}

function responseStatusLabel(payload: ApiEnvelope | null): string {
  if (!payload) return "No Response";
  if (typeof payload.status === "number") return `HTTP ${payload.status}`;
  return "Client Error";
}

function errorHint(payload: ApiEnvelope | null): string {
  if (!payload || typeof payload.status !== "number" || payload.status < 400) return "";
  const error = ((payload.data.error as Json | undefined) || {}) as Json;
  const code = typeof error.code === "string" ? error.code : "";

  if (code === "EMAIL_ALREADY_REGISTERED") return "Email already exists. Login or use a different email.";
  if (code === "INVALID_CREDENTIALS") return "Invalid email/password. Check credentials and retry.";
  if (code === "MISSING_API_KEY") return "Generate an API key before protected API calls.";
  if (code === "MISSING_TOKEN") return "Login first to obtain a bearer token.";
  if (code === "RATE_LIMIT_EXCEEDED") return "Rate limit reached. Wait and retry.";
  if (code === "REPORT_NOT_READY") return "Report is still processing. Poll again shortly.";
  return "Request failed. Inspect payload details below.";
}

function ResponseModal({
  open,
  payload,
  onClose,
}: {
  open: boolean;
  payload: ApiEnvelope | null;
  onClose: () => void;
}) {
  if (!open || !payload) return null;
  const statusClass = responseStatusClass(payload);

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <section className="modal-card" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h3>API Response</h3>
          <div className={`status-pill ${statusClass}`}>{responseStatusLabel(payload)}</div>
        </header>
        {errorHint(payload) ? <p className="hint">{errorHint(payload)}</p> : null}
        <pre className="response-pre">{JSON.stringify(payload, null, 2)}</pre>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </section>
    </div>
  );
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
  const [reportStatus, setReportStatus] = useState<"idle" | ReportStatus>("idle");

  const [historyStatus, setHistoryStatus] = useState<"" | ReportStatus>("");
  const [historyRegion, setHistoryRegion] = useState<"" | Region>("");
  const [historyFormat, setHistoryFormat] = useState<"" | ReportFormat>("");
  const [historyTitle, setHistoryTitle] = useState("");
  const [historyRows, setHistoryRows] = useState<ReportListItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [response, setResponse] = useState<ApiEnvelope | null>(null);

  const ownershipUrl = useMemo(() => {
    if (!propertyId) return "";
    return `/property/${propertyId}/ownership?consent_confirmed=true&legal_basis=consent`;
  }, [propertyId]);

  const showResponse = useCallback((payload: ApiEnvelope) => {
    setModalOpen(false);
    setResponse(payload);
    requestAnimationFrame(() => setModalOpen(true));
  }, []);

  const run = useCallback(async (action: () => Promise<Response>) => {
    setLoading(true);
    try {
      const res = await action();
      const data = (await res.json()) as Json;
      const payload = { status: res.status, data };
      showResponse(payload);
      return payload;
    } catch (error) {
      const payload = {
        status: "error",
        data: { message: error instanceof Error ? error.message : "Unknown error" },
      };
      showResponse(payload);
      return null;
    } finally {
      setLoading(false);
    }
  }, [showResponse]);

  const onRegister = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    await run(() =>
      apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, name }),
      })
    );
  }, [email, name, password, run]);

  const onLogin = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    const payload = await run(() =>
      apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      })
    );
    const data = payload?.data;
    if (data && typeof data.access_token === "string") setToken(data.access_token);
  }, [email, password, run]);

  const onGenerateKey = useCallback(async () => {
    const payload = await run(() =>
      apiRequest("/auth/api-keys", {
        method: "POST",
        token,
        body: JSON.stringify({ name: "browser-console" }),
      })
    );
    const data = payload?.data;
    if (data && typeof data.key === "string") setApiKey(data.key);
  }, [run, token]);

  const onSearch = useCallback(async () => {
    const query = `/property/search?title_number=${encodeURIComponent(titleNumber)}&region=${encodeURIComponent(region)}`;
    const payload = await run(() => apiRequest(query, { apiKey }));
    const rows = (payload?.data.data as Array<{ id?: string }> | undefined) || [];
    if (rows[0]?.id) setPropertyId(rows[0].id);
  }, [apiKey, region, run, titleNumber]);

  const onVerify = useCallback(async () => {
    await run(() =>
      apiRequest("/property/verify", {
        method: "POST",
        apiKey,
        body: JSON.stringify({ title_number: titleNumber, region }),
      })
    );
  }, [apiKey, region, run, titleNumber]);

  const onRisk = useCallback(async () => {
    if (!propertyId) return;
    await run(() => apiRequest(`/property/${propertyId}/risk`, { apiKey }));
  }, [apiKey, propertyId, run]);

  const onOwnership = useCallback(async () => {
    if (!ownershipUrl) return;
    await run(() => apiRequest(ownershipUrl, { apiKey }));
  }, [apiKey, ownershipUrl, run]);

  const onOwnershipHistory = useCallback(async () => {
    if (!propertyId) return;
    await run(() =>
      apiRequest(`/property/${propertyId}/ownership/history?consent_confirmed=true&legal_basis=contract`, { apiKey })
    );
  }, [apiKey, propertyId, run]);

  const createReportJob = useCallback(async (format: ReportFormat) => {
    const payload = await run(() =>
      apiRequest("/reports/full", {
        method: "POST",
        apiKey,
        timeoutMs: 60000,
        body: JSON.stringify(
          propertyId
            ? { property_id: propertyId, format, include_risk: true }
            : { title_number: titleNumber, region, format, include_risk: true }
        ),
      })
    );

    const data = payload?.data;
    const id = data && typeof data.report_id === "string" ? data.report_id : "";
    if (id) {
      setReportId(id);
      setReportStatus("processing");
      return id;
    }
    return "";
  }, [apiKey, propertyId, region, run, titleNumber]);

  const pollReportDone = useCallback(async (id: string) => {
    for (let i = 0; i < 25; i += 1) {
      const res = await apiRequest(`/reports/${id}`, { apiKey, timeoutMs: 60000 });
      const data = (await res.json()) as Json;
      showResponse({ status: res.status, data });
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
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
    return false;
  }, [apiKey, showResponse]);

  const downloadByFormat = useCallback(async (id: string, format: ReportFormat) => {
    const signed = await apiRequest(`/reports/${id}/download-url?format=${format}`, { apiKey, timeoutMs: 30000 });
    const signedData = (await signed.json()) as Json;
    if (!signed.ok || typeof signedData.download_url !== "string") {
      showResponse({ status: signed.status, data: signedData });
      return;
    }

    const fileRes = await fetch(signedData.download_url, { cache: "no-store" });
    if (!fileRes.ok) {
      showResponse({ status: fileRes.status, data: { message: await fileRes.text() } });
      return;
    }

    const blob = await fileRes.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `milki-report-${id}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    showResponse({
      status: 200,
      data: {
        message: `${format.toUpperCase()} downloaded`,
        report_id: id,
        bytes: blob.size,
      },
    });
  }, [apiKey, showResponse]);

  const runReportDownload = useCallback(async (format: ReportFormat) => {
    setLoading(true);
    try {
      const id = await createReportJob(format);
      if (!id) return;
      const done = await pollReportDone(id);
      if (!done) return;
      await downloadByFormat(id, format);
      await loadReportHistory();
    } finally {
      setLoading(false);
    }
  }, [createReportJob, downloadByFormat, pollReportDone]);

  const loadReportHistory = useCallback(async () => {
    const params = new URLSearchParams();
    if (historyStatus) params.set("status", historyStatus);
    if (historyRegion) params.set("region", historyRegion);
    if (historyFormat) params.set("format", historyFormat);
    if (historyTitle.trim()) params.set("title_number", historyTitle.trim());
    params.set("page", "1");
    params.set("per_page", "20");

    const res = await apiRequest(`/reports?${params.toString()}`, { apiKey, timeoutMs: 30000 });
    const data = (await res.json()) as Json;
    showResponse({ status: res.status, data });
    if (!res.ok || !Array.isArray(data.data)) return;
    setHistoryRows(data.data as ReportListItem[]);
  }, [apiKey, historyFormat, historyRegion, historyStatus, historyTitle, showResponse]);

  const redownload = useCallback(async (id: string, format: ReportFormat) => {
    setLoading(true);
    try {
      await downloadByFormat(id, format);
    } finally {
      setLoading(false);
    }
  }, [downloadByFormat]);

  return (
    <>
      <main className="app-shell">
        <header className="app-hero">
          <div>
            <p className="kicker">Milki API</p>
            <h1>Property Intelligence Console</h1>
            <p className="subtitle">One modern control surface for auth, verification, risk, and report lifecycle.</p>
          </div>
          <div className="hero-tags">
            <span>{API_BASE}</span>
            <span>Tanzania Mainland + Zanzibar</span>
          </div>
        </header>

        <section className="app-grid">
          <article className="card">
            <h2>Access</h2>
            <form className="stack" onSubmit={onRegister}>
              <label className="field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
              <label className="field"><span>Email</span><input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
              <label className="field"><span>Password</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
              <div className="action-row">
                <button type="submit" disabled={loading}>Register</button>
                <button type="button" onClick={onLogin} disabled={loading}>Login</button>
              </div>
              <button type="button" onClick={onGenerateKey} disabled={!token || loading}>Generate API Key</button>
            </form>
            <p className="meta">Token: {token ? `${token.slice(0, 22)}...` : "-"}</p>
            <p className="meta">API Key: {apiKey ? `${apiKey.slice(0, 22)}...` : "-"}</p>
          </article>

          <article className="card">
            <h2>Property Ops</h2>
            <div className="stack">
              <label className="field"><span>Title Number</span><input value={titleNumber} onChange={(e) => setTitleNumber(e.target.value)} /></label>
              <label className="field">
                <span>Region</span>
                <select value={region} onChange={(e) => setRegion(e.target.value as Region)}>
                  <option value="mainland">Tanzania Mainland</option>
                  <option value="zanzibar">Zanzibar</option>
                </select>
              </label>
              <div className="action-row wrap">
                <button onClick={onSearch} disabled={!apiKey || loading}>Search</button>
                <button onClick={onVerify} disabled={!apiKey || loading}>Verify</button>
                <button onClick={onRisk} disabled={!apiKey || !propertyId || loading}>Risk</button>
                <button onClick={onOwnership} disabled={!apiKey || !propertyId || loading}>Ownership</button>
                <button onClick={onOwnershipHistory} disabled={!apiKey || !propertyId || loading}>History</button>
              </div>
              <div className="action-row wrap">
                <button onClick={() => runReportDownload("json")} disabled={!apiKey || loading}>Download JSON</button>
                <button onClick={() => runReportDownload("pdf")} disabled={!apiKey || loading}>Download PDF</button>
              </div>
            </div>
            <p className="meta">Property ID: {propertyId || "-"}</p>
            <p className="meta">Report ID: {reportId || "-"}</p>
            <p className="meta">Report Status: {reportStatus}</p>
          </article>

          <article className="card card-wide">
            <h2>Report History</h2>
            <div className="filter-grid">
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
              <label className="field">
                <span>Title contains</span>
                <input value={historyTitle} onChange={(e) => setHistoryTitle(e.target.value)} placeholder="ZNZ-NGW" />
              </label>
            </div>

            <div className="action-row">
              <button onClick={loadReportHistory} disabled={!apiKey || loading}>Load History</button>
            </div>

            <div className="history-list">
              {historyRows.length === 0 ? <p className="meta">No rows loaded yet.</p> : historyRows.map((row) => (
                <article key={row.report_id} className="history-item">
                  <div>
                    <p><strong>{row.title_number}</strong> · {row.region}</p>
                    <p className="meta small">{row.report_id}</p>
                    <p className="meta small">{row.status} · requested {row.requested_format}</p>
                  </div>
                  <div className="action-row wrap">
                    <button onClick={() => redownload(row.report_id, "json")} disabled={row.status !== "completed" || loading}>Re-download JSON</button>
                    <button onClick={() => redownload(row.report_id, "pdf")} disabled={row.status !== "completed" || loading}>Re-download PDF</button>
                  </div>
                </article>
              ))}
            </div>
          </article>
        </section>
      </main>

      <ResponseModal open={modalOpen} payload={response} onClose={() => setModalOpen(false)} />
    </>
  );
}
