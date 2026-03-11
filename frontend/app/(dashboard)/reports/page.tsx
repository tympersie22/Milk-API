"use client";

import { useCallback, useState } from "react";
import { useAuth } from "../../../context/auth-context";
import { apiRequest, type Json, type Region, type ReportFormat, type ReportStatus, type ReportListItem } from "../../../lib/api";
import { PageHeader } from "../../../components/layout/page-header";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { EmptyState } from "../../../components/ui/empty-state";
import { useToast } from "../../../components/ui/toast";
import { formatDate } from "../../../lib/utils";
import { IconFileText, IconDownload, IconRefresh } from "../../../components/ui/icons";

export default function ReportsPage() {
  const { apiKey } = useAuth();
  const { toast } = useToast();

  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<"" | ReportStatus>("");
  const [filterRegion, setFilterRegion] = useState<"" | Region>("");
  const [filterFormat, setFilterFormat] = useState<"" | ReportFormat>("");
  const [filterTitle, setFilterTitle] = useState("");

  const loadReports = useCallback(async () => {
    if (!apiKey) { toast("Set up an API key in Settings first.", "error"); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterRegion) params.set("region", filterRegion);
      if (filterFormat) params.set("format", filterFormat);
      if (filterTitle.trim()) params.set("title_number", filterTitle.trim());
      params.set("page", "1");
      params.set("per_page", "50");

      const res = await apiRequest(`/reports?${params.toString()}`, { apiKey, timeoutMs: 30000 });
      const data = (await res.json()) as Json;
      if (res.ok && Array.isArray(data.data)) {
        setReports(data.data as ReportListItem[]);
        setLoaded(true);
      } else {
        toast("Failed to load reports.", "error");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load reports.", "error");
    } finally {
      setLoading(false);
    }
  }, [apiKey, filterFormat, filterRegion, filterStatus, filterTitle, toast]);

  const download = async (reportId: string, format: ReportFormat) => {
    setDownloading(reportId);
    try {
      const signed = await apiRequest(`/reports/${reportId}/download-url?format=${format}`, { apiKey, timeoutMs: 30000 });
      const signedData = (await signed.json()) as Json;
      if (!signed.ok || typeof signedData.download_url !== "string") {
        toast("Could not get download URL.", "error");
        return;
      }
      const fileRes = await fetch(signedData.download_url, { cache: "no-store" });
      if (!fileRes.ok) { toast("Download failed.", "error"); return; }
      const blob = await fileRes.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `milki-report-${reportId}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast(`${format.toUpperCase()} downloaded!`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Download failed.", "error");
    } finally {
      setDownloading(null);
    }
  };

  const statusBadge = (status: string) => {
    if (status === "completed") return <Badge variant="success">Completed</Badge>;
    if (status === "processing") return <Badge variant="warning">Processing</Badge>;
    if (status === "failed") return <Badge variant="error">Failed</Badge>;
    return <Badge variant="neutral">{status}</Badge>;
  };

  return (
    <>
      <PageHeader
        title="Reports"
        description="View and download your property intelligence reports."
        actions={
          <Button onClick={loadReports} loading={loading} icon={<IconRefresh size={16} />}>
            {loaded ? "Refresh" : "Load Reports"}
          </Button>
        }
      />

      {/* Filters */}
      <Card padding="md" className="mb-6">
        <h4 className="mb-3">Filters</h4>
        <div className="form-row">
          <label>
            Status
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as "" | ReportStatus)}>
              <option value="">All Statuses</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </label>
          <label>
            Region
            <select value={filterRegion} onChange={e => setFilterRegion(e.target.value as "" | Region)}>
              <option value="">All Regions</option>
              <option value="mainland">Mainland</option>
              <option value="zanzibar">Zanzibar</option>
            </select>
          </label>
          <label>
            Format
            <select value={filterFormat} onChange={e => setFilterFormat(e.target.value as "" | ReportFormat)}>
              <option value="">All Formats</option>
              <option value="json">JSON</option>
              <option value="pdf">PDF</option>
            </select>
          </label>
          <label>
            Title Number
            <input value={filterTitle} onChange={e => setFilterTitle(e.target.value)} placeholder="e.g. ZNZ-NGW" />
          </label>
        </div>
        <div className="mt-3">
          <Button variant="secondary" size="sm" onClick={loadReports} loading={loading}>
            Apply Filters
          </Button>
        </div>
      </Card>

      {/* Reports Table */}
      <Card padding="sm">
        {!loaded ? (
          <EmptyState
            icon={<IconFileText size={24} />}
            title="Load your reports"
            description="Click 'Load Reports' to see your report history."
          />
        ) : reports.length === 0 ? (
          <EmptyState
            icon={<IconFileText size={24} />}
            title="No reports found"
            description="No reports match your filters. Try adjusting them or generate a report from the Properties page."
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title Number</th>
                  <th>Region</th>
                  <th>Format</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(r => (
                  <tr key={r.report_id}>
                    <td>
                      <div className="font-medium">{r.title_number}</div>
                      <div className="font-mono text-xs text-tertiary mt-1">{r.report_id}</div>
                    </td>
                    <td>
                      <Badge variant={r.region === "zanzibar" ? "info" : "neutral"}>
                        {r.region === "zanzibar" ? "Zanzibar" : "Mainland"}
                      </Badge>
                    </td>
                    <td><span className="font-mono text-xs">{r.requested_format.toUpperCase()}</span></td>
                    <td>{statusBadge(r.status)}</td>
                    <td className="text-sm text-secondary">{formatDate(r.created_at)}</td>
                    <td>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={r.status !== "completed" || downloading === r.report_id}
                          loading={downloading === r.report_id}
                          onClick={() => download(r.report_id, "json")}
                          icon={<IconDownload size={14} />}
                        >
                          JSON
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={r.status !== "completed" || downloading === r.report_id}
                          loading={downloading === r.report_id}
                          onClick={() => download(r.report_id, "pdf")}
                          icon={<IconDownload size={14} />}
                        >
                          PDF
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
