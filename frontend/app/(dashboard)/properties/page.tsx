"use client";

import { useCallback, useState } from "react";
import { useAuth } from "../../../context/auth-context";
import { apiRequest, runApi, isRateLimited, getRetryAfter, type ApiEnvelope, type Json, type Region, type ReportFormat, type RiskResponse } from "../../../lib/api";
import { RiskVisualization } from "../../../components/properties/risk-visualization";
import { PageHeader } from "../../../components/layout/page-header";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Modal } from "../../../components/ui/modal";
import { CodeBlock } from "../../../components/ui/code-block";
import { EmptyState } from "../../../components/ui/empty-state";
import { Skeleton } from "../../../components/ui/skeleton";
import { useToast } from "../../../components/ui/toast";
import {
  IconSearch,
  IconShield,
  IconUsers,
  IconFileText,
  IconDownload,
  IconActivity,
  IconCheck,
  IconAlertTriangle,
  IconMap,
} from "../../../components/ui/icons";
import { PropertyMap } from "../../../components/properties/property-map";
import { useSearchHistory } from "../../../hooks/use-search-history";
import { IconStar, IconStarFilled, IconClock, IconTrash } from "../../../components/ui/icons";

type PropertyResult = {
  id: string;
  title_number: string;
  region: string;
  [key: string]: unknown;
};

export default function PropertiesPage() {
  const { apiKey } = useAuth();
  const { toast } = useToast();
  const { history, favorites, addSearch, toggleFavorite, removeItem, clearHistory } = useSearchHistory();
  const [showHistory, setShowHistory] = useState(false);

  const [titleNumber, setTitleNumber] = useState("ZNZ-NGW-0001");
  const [region, setRegion] = useState<Region>("zanzibar");
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState("");

  const [property, setProperty] = useState<PropertyResult | null>(null);
  const [riskData, setRiskData] = useState<RiskResponse | null>(null);
  const [responseModal, setResponseModal] = useState(false);
  const [lastResponse, setLastResponse] = useState<ApiEnvelope | null>(null);
  const [lastResponseTitle, setLastResponseTitle] = useState("");

  const showResult = (title: string, payload: ApiEnvelope | null) => {
    if (!payload) return;
    setLastResponse(payload);
    setLastResponseTitle(title);
    setResponseModal(true);
  };

  const withLoading = async (action: string, fn: () => Promise<void>) => {
    if (!apiKey) { toast("Generate an API key in Settings first.", "error"); return; }
    setLoading(true);
    setActiveAction(action);
    try { await fn(); }
    catch (e) { toast(e instanceof Error ? e.message : "Request failed", "error"); }
    finally { setLoading(false); setActiveAction(""); }
  };

  /** Check rate limit on every response and show user-friendly message */
  const checkRateLimit = (payload: ApiEnvelope | null): boolean => {
    if (isRateLimited(payload)) {
      const secs = getRetryAfter(payload);
      toast(`Rate limit reached. Please wait ${secs}s before trying again.`, "error");
      return true;
    }
    return false;
  };

  const onSearch = () => withLoading("search", async () => {
    const q = `/property/search?title_number=${encodeURIComponent(titleNumber)}&region=${encodeURIComponent(region)}`;
    const payload = await runApi(() => apiRequest(q, { apiKey }));
    if (checkRateLimit(payload)) return;
    if (payload && typeof payload.status === "number" && payload.status < 300) {
      const rows = (payload.data.data as PropertyResult[]) || [];
      if (rows[0]?.id) {
        setProperty(rows[0]);
        addSearch(titleNumber, region, rows[0].id);
        toast("Property found!", "success");
      } else {
        setProperty(null);
        addSearch(titleNumber, region);
        toast("No matching property found.", "info");
      }
    }
    showResult("Property Search", payload);
  });

  const onVerify = () => withLoading("verify", async () => {
    const payload = await runApi(() =>
      apiRequest("/property/verify", {
        method: "POST",
        apiKey,
        body: JSON.stringify({ title_number: titleNumber, region }),
      })
    );
    showResult("Property Verification", payload);
    if (payload && typeof payload.status === "number" && payload.status < 300) {
      toast("Property verified successfully.", "success");
    }
  });

  const onRisk = () => withLoading("risk", async () => {
    if (!property?.id) return;
    const payload = await runApi(() => apiRequest(`/property/${property.id}/risk`, { apiKey }));
    if (payload && typeof payload.status === "number" && payload.status < 300) {
      setRiskData(payload.data as unknown as RiskResponse);
    }
    showResult("Risk Assessment", payload);
  });

  const onOwnership = () => withLoading("ownership", async () => {
    if (!property?.id) return;
    const payload = await runApi(() =>
      apiRequest(`/property/${property.id}/ownership?consent_confirmed=true&legal_basis=consent`, { apiKey })
    );
    showResult("Ownership Details", payload);
  });

  const onHistory = () => withLoading("history", async () => {
    if (!property?.id) return;
    const payload = await runApi(() =>
      apiRequest(`/property/${property.id}/ownership/history?consent_confirmed=true&legal_basis=contract`, { apiKey })
    );
    showResult("Ownership History", payload);
  });

  const onReport = (format: ReportFormat) => withLoading("report-" + format, async () => {
    const body = property?.id
      ? { property_id: property.id, format, include_risk: true }
      : { title_number: titleNumber, region, format, include_risk: true };

    const payload = await runApi(() =>
      apiRequest("/reports/full", {
        method: "POST",
        apiKey,
        timeoutMs: 60000,
        body: JSON.stringify(body),
      })
    );

    const reportId = payload?.data?.report_id;
    if (typeof reportId !== "string") {
      showResult("Report Generation", payload);
      return;
    }

    toast("Report submitted. Polling for completion...", "info");

    // Poll for completion
    for (let i = 0; i < 25; i++) {
      const poll = await runApi(() => apiRequest(`/reports/${reportId}`, { apiKey, timeoutMs: 60000 }));
      const status = poll?.data?.status;
      if (status === "completed") {
        // Download
        const signed = await apiRequest(`/reports/${reportId}/download-url?format=${format}`, { apiKey, timeoutMs: 30000 });
        const signedData = (await signed.json()) as Json;
        if (signed.ok && typeof signedData.download_url === "string") {
          const fileRes = await fetch(signedData.download_url, { cache: "no-store" });
          if (fileRes.ok) {
            const blob = await fileRes.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `milki-report-${reportId}.${format}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            toast(`${format.toUpperCase()} report downloaded!`, "success");
            return;
          }
        }
        showResult("Report Download", { status: signed.status, data: signedData });
        return;
      }
      if (status === "failed") {
        toast("Report generation failed.", "error");
        showResult("Report Failed", poll);
        return;
      }
      await new Promise(r => setTimeout(r, 800));
    }
    toast("Report timed out. Check Reports page later.", "error");
  });

  const responseStatus = () => {
    if (!lastResponse || typeof lastResponse.status !== "number") return "neutral" as const;
    if (lastResponse.status < 300) return "success" as const;
    if (lastResponse.status < 500) return "warning" as const;
    return "error" as const;
  };

  return (
    <>
      <PageHeader
        title="Properties"
        description="Search, verify, and analyze property data across Tanzania."
      />

      {/* Search Section */}
      <Card padding="md" className="mb-6">
        <h3 className="card-title mb-4">Property Search</h3>
        <div className="form-row mb-4">
          <label>
            Title Number
            <input
              value={titleNumber}
              onChange={e => setTitleNumber(e.target.value)}
              placeholder="e.g. ZNZ-NGW-0001"
            />
          </label>
          <label>
            Region
            <select value={region} onChange={e => setRegion(e.target.value as Region)}>
              <option value="mainland">Tanzania Mainland</option>
              <option value="zanzibar">Zanzibar</option>
            </select>
          </label>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={onSearch}
            loading={loading && activeAction === "search"}
            disabled={loading || !titleNumber}
            icon={<IconSearch size={16} />}
          >
            Search
          </Button>
          <Button
            variant="secondary"
            onClick={onVerify}
            loading={loading && activeAction === "verify"}
            disabled={loading || !titleNumber}
            icon={<IconCheck size={16} />}
          >
            Verify
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)} icon={<IconClock size={14} />}>
          {showHistory ? "Hide History" : "History"} ({history.length})
        </Button>
      </Card>

      {/* Search History & Favorites */}
      {showHistory && (
        <Card padding="md" className="mb-6 animate-slideUp">
          <div className="card-header">
            <h3 className="card-title flex items-center gap-2">
              <IconClock size={16} /> Search History
            </h3>
            {history.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearHistory}>Clear All</Button>
            )}
          </div>

          {favorites.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                <IconStarFilled size={14} style={{ color: "var(--color-accent)" }} /> Favorites
              </h4>
              <div className="flex flex-col gap-1">
                {favorites.map(item => (
                  <div key={item.id} className="flex items-center gap-2 p-2" style={{ borderRadius: "var(--radius-sm)", background: "var(--color-accent-light)" }}>
                    <button onClick={() => toggleFavorite(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-accent)" }}>
                      <IconStarFilled size={14} />
                    </button>
                    <button
                      className="flex-1 text-left text-sm"
                      style={{ background: "none", border: "none", cursor: "pointer" }}
                      onClick={() => { setTitleNumber(item.title_number); setRegion(item.region as Region); }}
                    >
                      <span className="font-medium">{item.title_number}</span>
                      <span className="text-tertiary ml-2">{item.region}</span>
                    </button>
                    <button onClick={() => removeItem(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)" }}>
                      <IconTrash size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {history.length === 0 ? (
            <p className="text-sm text-secondary">No search history yet. Your searches will appear here.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {history.filter(h => !h.favorited).slice(0, 15).map(item => (
                <div key={item.id} className="flex items-center gap-2 p-2" style={{ borderRadius: "var(--radius-sm)" }}>
                  <button onClick={() => toggleFavorite(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)" }}>
                    <IconStar size={14} />
                  </button>
                  <button
                    className="flex-1 text-left text-sm"
                    style={{ background: "none", border: "none", cursor: "pointer" }}
                    onClick={() => { setTitleNumber(item.title_number); setRegion(item.region as Region); }}
                  >
                    <span className="font-medium">{item.title_number}</span>
                    <span className="text-tertiary ml-2">{item.region}</span>
                    <span className="text-tertiary ml-2 text-xs">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </span>
                  </button>
                  <button onClick={() => removeItem(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)" }}>
                    <IconTrash size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Property Result */}
      {property && (
        <Card padding="md" className="mb-6 animate-slideUp">
          <div className="card-header">
            <div>
              <h3 className="card-title">{property.title_number}</h3>
              <p className="text-sm text-secondary mt-1">Property ID: <span className="font-mono text-xs">{property.id}</span></p>
            </div>
            <Badge variant={property.region === "zanzibar" ? "info" : "neutral"}>
              {property.region === "zanzibar" ? "Zanzibar" : "Mainland"}
            </Badge>
          </div>

          <hr className="divider" />

          <h4 className="mb-3">Analysis Tools</h4>
          <div className="flex gap-2 flex-wrap mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={onRisk}
              loading={loading && activeAction === "risk"}
              disabled={loading}
              icon={<IconAlertTriangle size={14} />}
            >
              Risk Assessment
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onOwnership}
              loading={loading && activeAction === "ownership"}
              disabled={loading}
              icon={<IconUsers size={14} />}
            >
              Ownership
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onHistory}
              loading={loading && activeAction === "history"}
              disabled={loading}
              icon={<IconActivity size={14} />}
            >
              Ownership History
            </Button>
          </div>

          <h4 className="mb-3">Generate Report</h4>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => onReport("json")}
              loading={loading && activeAction === "report-json"}
              disabled={loading}
              icon={<IconDownload size={14} />}
            >
              Download JSON
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onReport("pdf")}
              loading={loading && activeAction === "report-pdf"}
              disabled={loading}
              icon={<IconFileText size={14} />}
            >
              Download PDF
            </Button>
          </div>
        </Card>
      )}

      {/* Risk Visualization */}
      {riskData && (
        <div className="mb-6 animate-slideUp">
          <RiskVisualization risk={riskData} />
        </div>
      )}

      {/* Map */}
      <Card padding="md" className="mb-6">
        <div className="card-header">
          <h3 className="card-title flex items-center gap-2"><IconMap size={16} /> Location</h3>
        </div>
        <PropertyMap
          markers={property ? [{
            lat: (property as Record<string, unknown>).latitude as number || -6.165,
            lng: (property as Record<string, unknown>).longitude as number || 39.199,
            title: property.title_number,
            popup: `<strong>${property.title_number}</strong><br/>${property.region}`,
          }] : []}
          height="300px"
        />
      </Card>

      {!property && loading && (
        <Card padding="lg">
          <div className="flex flex-col gap-3">
            <Skeleton width="45%" height="24px" />
            <Skeleton width="100%" height="16px" />
            <Skeleton width="100%" height="16px" />
          </div>
        </Card>
      )}

      {!property && !loading && (
        <Card padding="lg">
          <EmptyState
            icon={<IconSearch size={24} />}
            title="No property selected"
            description="Search for a property above to see details, run risk analysis, and generate reports."
          />
        </Card>
      )}

      {/* Response Modal */}
      <Modal
        open={responseModal}
        onClose={() => setResponseModal(false)}
        title={lastResponseTitle}
        wide
        actions={
          <div className="flex gap-2 justify-between items-center w-full">
            <Badge variant={responseStatus()}>
              {typeof lastResponse?.status === "number" ? `HTTP ${lastResponse.status}` : "Error"}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => setResponseModal(false)}>Close</Button>
          </div>
        }
      >
        <CodeBlock maxHeight="50vh">
          {JSON.stringify(lastResponse, null, 2)}
        </CodeBlock>
      </Modal>
    </>
  );
}
