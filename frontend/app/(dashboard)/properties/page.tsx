"use client";

import { useCallback, useState } from "react";
import { useAuth } from "../../../context/auth-context";
import {
  apiRequest, runApi, isRateLimited, getRetryAfter,
  type ApiEnvelope, type Json, type Region, type ReportFormat,
  type RiskResponse, type OwnershipRecord,
} from "../../../lib/api";
import { RiskVisualization } from "../../../components/properties/risk-visualization";
import { VerificationResult } from "../../../components/properties/results/verification-result";
import { OwnershipResult } from "../../../components/properties/results/ownership-result";
import { OwnershipHistoryResult } from "../../../components/properties/results/ownership-history-result";
import { ErrorResult } from "../../../components/properties/results/error-result";
import { SearchResult } from "../../../components/properties/results/search-result";
import { PageHeader } from "../../../components/layout/page-header";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { EmptyState } from "../../../components/ui/empty-state";
import { Skeleton } from "../../../components/ui/skeleton";
import { useToast } from "../../../components/ui/toast";
import {
  IconSearch, IconShield, IconUsers, IconFileText,
  IconDownload, IconActivity, IconCheck, IconAlertTriangle,
  IconMap, IconX,
} from "../../../components/ui/icons";
import { PropertyMap } from "../../../components/properties/property-map";
import { useSearchHistory } from "../../../hooks/use-search-history";
import { IconStar, IconStarFilled, IconClock, IconTrash } from "../../../components/ui/icons";

type PropertyResult = {
  id: string;
  title_number: string;
  region: string;
  district: string;
  area_name?: string | null;
  land_type: string;
  is_verified: boolean;
  latitude?: number | null;
  longitude?: number | null;
  [key: string]: unknown;
};

// Types for inline result panels (replaces the old JSON modal)
type ResultPanel =
  | { type: "verification"; data: { title_number: string; region: string; found: boolean; verified: boolean; data_source: string | null; confidence: number | null; message: string } }
  | { type: "ownership"; data: OwnershipRecord; propertyId: string }
  | { type: "history"; data: OwnershipRecord[]; total: number; propertyId: string }
  | { type: "error"; title: string; response: ApiEnvelope; retryFn?: () => void };

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

  // Inline result panels — shown below the property card, no more JSON modal
  const [resultPanels, setResultPanels] = useState<ResultPanel[]>([]);

  const addPanel = (panel: ResultPanel) => {
    setResultPanels(prev => {
      // Replace existing panel of same type or add new
      const filtered = prev.filter(p => p.type !== panel.type);
      return [panel, ...filtered];
    });
  };

  const removePanel = (type: string) => {
    setResultPanels(prev => prev.filter(p => p.type !== type));
  };

  const showError = (title: string, response: ApiEnvelope, retryFn?: () => void) => {
    addPanel({ type: "error", title, response, retryFn });
  };

  const withLoading = async (action: string, fn: () => Promise<void>) => {
    if (!apiKey) { toast("Generate an API key in Settings first.", "error"); return; }
    setLoading(true);
    setActiveAction(action);
    try { await fn(); }
    catch (e) { toast(e instanceof Error ? e.message : "Request failed", "error"); }
    finally { setLoading(false); setActiveAction(""); }
  };

  const checkRateLimit = (payload: ApiEnvelope | null): boolean => {
    if (isRateLimited(payload)) {
      const secs = getRetryAfter(payload);
      toast(`Rate limit reached. Please wait ${secs}s before trying again.`, "error");
      return true;
    }
    return false;
  };

  // --- Search ---
  const onSearch = () => withLoading("search", async () => {
    const q = `/property/search?title_number=${encodeURIComponent(titleNumber)}&region=${encodeURIComponent(region)}`;
    const payload = await runApi(() => apiRequest(q, { apiKey }));
    if (checkRateLimit(payload)) return;

    if (payload && typeof payload.status === "number" && payload.status >= 400) {
      showError("Property Search", payload, onSearch);
      return;
    }

    if (payload && typeof payload.status === "number" && payload.status < 300) {
      const rows = (payload.data.data as PropertyResult[]) || [];
      if (rows[0]?.id) {
        setProperty(rows[0]);
        addSearch(titleNumber, region, rows[0].id);
        toast("Property found!", "success");
        removePanel("error");
      } else {
        setProperty(null);
        addSearch(titleNumber, region);
        toast("No matching property found.", "info");
      }
    }
  });

  // --- Verify ---
  const onVerify = () => withLoading("verify", async () => {
    const payload = await runApi(() =>
      apiRequest("/property/verify", {
        method: "POST",
        apiKey,
        body: JSON.stringify({ title_number: titleNumber, region }),
      })
    );

    if (payload && typeof payload.status === "number" && payload.status >= 400) {
      showError("Property Verification", payload, onVerify);
      return;
    }

    if (payload && typeof payload.status === "number" && payload.status < 300) {
      const d = payload.data as Record<string, unknown>;
      addPanel({
        type: "verification",
        data: {
          title_number: String(d.title_number || titleNumber),
          region: String(d.region || region),
          found: Boolean(d.found),
          verified: Boolean(d.verified),
          data_source: d.data_source ? String(d.data_source) : null,
          confidence: typeof d.confidence === "number" ? d.confidence : null,
          message: String(d.message || ""),
        },
      });
      if (d.verified) toast("Property verified successfully.", "success");
    }
  });

  // --- Risk ---
  const onRisk = () => withLoading("risk", async () => {
    if (!property?.id) return;
    const payload = await runApi(() => apiRequest(`/property/${property.id}/risk`, { apiKey }));

    if (payload && typeof payload.status === "number" && payload.status >= 400) {
      showError("Risk Assessment", payload, onRisk);
      return;
    }

    if (payload && typeof payload.status === "number" && payload.status < 300) {
      setRiskData(payload.data as unknown as RiskResponse);
    }
  });

  // --- Ownership ---
  const onOwnership = () => withLoading("ownership", async () => {
    if (!property?.id) return;
    const payload = await runApi(() =>
      apiRequest(`/property/${property.id}/ownership?consent_confirmed=true&legal_basis=consent`, { apiKey })
    );

    if (payload && typeof payload.status === "number" && payload.status >= 400) {
      showError("Ownership Details", payload, onOwnership);
      return;
    }

    if (payload && typeof payload.status === "number" && payload.status < 300) {
      const d = payload.data as Record<string, unknown>;
      const owner = (d.current_owner || d) as OwnershipRecord;
      addPanel({
        type: "ownership",
        data: {
          owner_name: String(owner.owner_name || "Unknown"),
          owner_type: String(owner.owner_type || "unknown"),
          owner_nationality: owner.owner_nationality ? String(owner.owner_nationality) : null,
          acquired_date: owner.acquired_date ? String(owner.acquired_date) : null,
          acquisition_method: owner.acquisition_method ? String(owner.acquisition_method) : null,
          transfer_ref: owner.transfer_ref ? String(owner.transfer_ref) : null,
          is_current: Boolean(owner.is_current),
          has_mortgage: Boolean(owner.has_mortgage),
          has_caveat: Boolean(owner.has_caveat),
          has_lien: Boolean(owner.has_lien),
          encumbrance_details: (owner.encumbrance_details as Record<string, unknown>) || null,
          privacy_opt_out: Boolean(owner.privacy_opt_out),
        },
        propertyId: property.id,
      });
    }
  });

  // --- Ownership History ---
  const onHistory = () => withLoading("history", async () => {
    if (!property?.id) return;
    const payload = await runApi(() =>
      apiRequest(`/property/${property.id}/ownership/history?consent_confirmed=true&legal_basis=contract`, { apiKey })
    );

    if (payload && typeof payload.status === "number" && payload.status >= 400) {
      showError("Ownership History", payload, onHistory);
      return;
    }

    if (payload && typeof payload.status === "number" && payload.status < 300) {
      const d = payload.data as Record<string, unknown>;
      const historyRecords = (Array.isArray(d.history) ? d.history : []) as OwnershipRecord[];
      const total = typeof d.total === "number" ? d.total : historyRecords.length;
      addPanel({
        type: "history",
        data: historyRecords,
        total,
        propertyId: property.id,
      });
    }
  });

  // --- Report ---
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
      if (payload) showError("Report Generation", payload);
      return;
    }

    toast("Report submitted. Polling for completion...", "info");

    for (let i = 0; i < 25; i++) {
      const poll = await runApi(() => apiRequest(`/reports/${reportId}`, { apiKey, timeoutMs: 60000 }));
      const status = poll?.data?.status;
      if (status === "completed") {
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
        if (!signed.ok) showError("Report Download", { status: signed.status, data: signedData });
        return;
      }
      if (status === "failed") {
        toast("Report generation failed.", "error");
        if (poll) showError("Report Failed", poll);
        return;
      }
      await new Promise(r => setTimeout(r, 800));
    }
    toast("Report timed out. Check Reports page later.", "error");
  });

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

      {/* Property Card — shown when a property is found */}
      {property && (
        <div className="mb-6 animate-slideUp">
          <SearchResult property={property as PropertyResult} />
        </div>
      )}

      {/* Map — shown immediately after search result with real coordinates */}
      {property && property.latitude && property.longitude && (
        <Card padding="md" className="mb-6 animate-slideUp">
          <div className="card-header">
            <h3 className="card-title flex items-center gap-2"><IconMap size={16} /> Property Location</h3>
            <div className="flex items-center gap-2">
              <Badge variant="info" style={{ fontSize: 10, padding: "2px 6px" }}>
                Live Geocoded
              </Badge>
              <span className="text-xs text-secondary">
                {property.latitude.toFixed(4)}, {property.longitude.toFixed(4)}
              </span>
            </div>
          </div>
          <PropertyMap
            markers={[{
              lat: property.latitude,
              lng: property.longitude,
              title: property.title_number,
              popup: `<strong>${property.title_number}</strong><br/>${property.district}, ${property.region}<br/><em>${property.area_name || ""}</em>`,
            }]}
            center={[property.latitude, property.longitude]}
            zoom={15}
            height="400px"
          />
          <div className="text-xs text-secondary mt-2" style={{ textAlign: "center" }}>
            Location based on {property.area_name ? `${property.area_name}, ` : ""}{property.district}, {property.region}
          </div>
        </Card>
      )}

      {/* Analysis Tools */}
      {property && (
        <Card padding="md" className="mb-6">
          <h4 className="card-title mb-3">Analysis Tools</h4>
          <div className="flex gap-2 flex-wrap mb-4">
            <Button
              variant="outline" size="sm"
              onClick={onRisk}
              loading={loading && activeAction === "risk"}
              disabled={loading}
              icon={<IconAlertTriangle size={14} />}
            >
              Risk Assessment
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={onOwnership}
              loading={loading && activeAction === "ownership"}
              disabled={loading}
              icon={<IconUsers size={14} />}
            >
              Ownership
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={onHistory}
              loading={loading && activeAction === "history"}
              disabled={loading}
              icon={<IconActivity size={14} />}
            >
              Ownership History
            </Button>
          </div>

          <h4 className="card-title mb-3">Generate Report</h4>
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
              variant="secondary" size="sm"
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

      {/* ====== Rich Result Panels (replaces JSON modal) ====== */}
      <div className="flex flex-col gap-4 mb-6">
        {resultPanels.map((panel) => {
          switch (panel.type) {
            case "verification":
              return (
                <div key="verification" style={{ position: "relative" }}>
                  <button
                    onClick={() => removePanel("verification")}
                    style={{
                      position: "absolute", top: 12, right: 12, zIndex: 1,
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--color-text-secondary)",
                    }}
                    title="Dismiss"
                  >
                    <IconX size={16} />
                  </button>
                  <VerificationResult data={panel.data} />
                </div>
              );
            case "ownership":
              return (
                <div key="ownership" style={{ position: "relative" }}>
                  <button
                    onClick={() => removePanel("ownership")}
                    style={{
                      position: "absolute", top: 12, right: 12, zIndex: 1,
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--color-text-secondary)",
                    }}
                    title="Dismiss"
                  >
                    <IconX size={16} />
                  </button>
                  <OwnershipResult owner={panel.data} propertyId={panel.propertyId} />
                </div>
              );
            case "history":
              return (
                <div key="history" style={{ position: "relative" }}>
                  <button
                    onClick={() => removePanel("history")}
                    style={{
                      position: "absolute", top: 12, right: 12, zIndex: 1,
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--color-text-secondary)",
                    }}
                    title="Dismiss"
                  >
                    <IconX size={16} />
                  </button>
                  <OwnershipHistoryResult
                    history={panel.data}
                    total={panel.total}
                    propertyId={panel.propertyId}
                  />
                </div>
              );
            case "error":
              return (
                <ErrorResult
                  key={`error-${panel.title}`}
                  title={panel.title}
                  response={panel.response}
                  onDismiss={() => removePanel("error")}
                  onRetry={panel.retryFn}
                />
              );
            default:
              return null;
          }
        })}
      </div>

      {/* Risk Visualization */}
      {riskData && (
        <div className="mb-6 animate-slideUp" style={{ position: "relative" }}>
          <button
            onClick={() => setRiskData(null)}
            style={{
              position: "absolute", top: 12, right: 12, zIndex: 1,
              background: "none", border: "none", cursor: "pointer",
              color: "var(--color-text-secondary)",
            }}
            title="Dismiss"
          >
            <IconX size={16} />
          </button>
          <RiskVisualization risk={riskData} />
        </div>
      )}

      {!property && loading && (
        <Card padding="lg">
          <div className="flex flex-col gap-3">
            <Skeleton width="45%" height="24px" />
            <Skeleton width="100%" height="16px" />
            <Skeleton width="100%" height="16px" />
          </div>
        </Card>
      )}

      {!property && !loading && resultPanels.length === 0 && (
        <Card padding="lg">
          <EmptyState
            icon={<IconSearch size={24} />}
            title="No property selected"
            description="Search for a property above to see details, run risk analysis, and generate reports."
          />
        </Card>
      )}
    </>
  );
}
