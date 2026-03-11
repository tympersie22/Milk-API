"use client";

import { useCallback, useState } from "react";
import { useAuth } from "../../../context/auth-context";
import { apiRequest, type Json, type Region, type ReportFormat, type ReportStatus, type ReportListItem, type PaginationMeta } from "../../../lib/api";
import { PageHeader } from "../../../components/layout/page-header";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { EmptyState } from "../../../components/ui/empty-state";
import { useToast } from "../../../components/ui/toast";
import { formatDate } from "../../../lib/utils";
import { IconFileText, IconDownload, IconRefresh, IconBarChart } from "../../../components/ui/icons";
import { exportReportsCSV } from "../../../lib/csv-export";
import { Skeleton } from "../../../components/ui/skeleton";

export default function ReportsPage() {
  const { apiKey } = useAuth();
  const { toast } = useToast();

  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<"" | ReportStatus>("");
  const [filterRegion, setFilterRegion] = useState<"" | Region>("");
  const [filterFormat, setFilterFormat] = useState<"" | ReportFormat>("");
  const [filterTitle, setFilterTitle] = useState("");

  const loadReports = useCallback(async (targetPage = page) => {
    if (!apiKey) { toast("Set up an API key in Settings first.", "error"); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterRegion) params.set("region", filterRegion);
      if (filterFormat) params.set("format", filterFormat);
      if (filterTitle.trim()) params.set("title_number", filterTitle.trim());
      params.set("page", String(targetPage));
      params.set("per_page", String(perPage));

      const res = await apiRequest(`/reports?${params.toString()}`, { apiKey, timeoutMs: 30000 });
      const data = (await res.json()) as Json;
      if (res.ok && Array.isArray(data.data)) {
        setReports(data.data as ReportListItem[]);
        if (data.pagination) setPagination(data.pagination as PaginationMeta);
        setPage(targetPage);
        setLoaded(true);
      } else {
        toast("Failed to load reports.", "error");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load reports.", "error");
    } finally {
      setLoading(false);
    }
  }, [apiKey, filterFormat, filterRegion, filterStatus, filterTitle, page, toast]);

  const totalPages = pagination ? Math.ceil(pagination.total / perPage) : 1;

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages) return;
    loadReports(p);
  };

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
          <div className="flex gap-2">
            {loaded && reports.length > 0 && (
              <Button variant="secondary" onClick={() => exportReportsCSV(reports)} icon={<IconDownload size={16} />}>
                Export CSV
              </Button>
            )}
            <Button onClick={() => loadReports()} loading={loading} icon={<IconRefresh size={16} />}>
              {loaded ? "Refresh" : "Load Reports"}
            </Button>
          </div>
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
          <Button variant="secondary" size="sm" onClick={() => loadReports()} loading={loading}>
            Apply Filters
          </Button>
        </div>
      </Card>

      {/* Reports Table */}
      <Card padding="sm">
        {loading && !loaded ? (
          <div className="p-4">
            <div className="flex flex-col gap-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={idx} width="100%" height="52px" />
              ))}
            </div>
          </div>
        ) : !loaded ? (
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
          <>
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
                      <td><span className="font-mono text-xs">{r.format.toUpperCase()}</span></td>
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

            {/* Pagination */}
            {pagination && totalPages > 1 && (
              <div className="flex items-center justify-between p-4" style={{ borderTop: "1px solid var(--color-border)" }}>
                <span className="text-sm text-secondary">
                  Showing {(page - 1) * perPage + 1}{"\u2013"}{Math.min(page * perPage, pagination.total)} of {pagination.total}
                </span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={page <= 1 || loading} onClick={() => goToPage(page - 1)}>
                    Previous
                  </Button>
                  <span className="flex items-center text-sm px-3">
                    Page {page} of {totalPages}
                  </span>
                  <Button variant="secondary" size="sm" disabled={page >= totalPages || loading} onClick={() => goToPage(page + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
