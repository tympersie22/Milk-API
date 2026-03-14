"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/auth-context";
import { apiRequest, type UsageResponse, type ReportListItem } from "../../lib/api";
import { OnboardingWizard, hasCompletedOnboarding } from "../../components/onboarding/onboarding-wizard";
import { PageHeader } from "../../components/layout/page-header";
import { StatCard } from "../../components/ui/stat-card";
import { Card } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { formatDate } from "../../lib/utils";
import { BarChart } from "../../components/charts/bar-chart";
import { LineChart } from "../../components/charts/line-chart";
import { DonutChart } from "../../components/charts/donut-chart";
import { PropertyMap } from "../../components/properties/property-map";
import {
  IconFileText,
  IconSearch,
  IconShield,
  IconActivity,
  IconKey,
  IconChevronRight,
  IconTrendingUp,
  IconMap,
  IconBarChart,
  IconColumns,
} from "../../components/ui/icons";
import Link from "next/link";

// Tanzania regional centers for density map
const TANZANIA_REGIONS = [
  { name: "Dar es Salaam", lat: -6.792, lng: 39.208 },
  { name: "Dodoma", lat: -6.173, lng: 35.742 },
  { name: "Arusha", lat: -3.387, lng: 36.683 },
  { name: "Mwanza", lat: -2.517, lng: 32.900 },
  { name: "Zanzibar", lat: -6.165, lng: 39.199 },
  { name: "Mbeya", lat: -8.900, lng: 33.450 },
  { name: "Morogoro", lat: -6.824, lng: 37.660 },
  { name: "Tanga", lat: -5.069, lng: 39.098 },
];

export default function DashboardPage() {
  const { name, apiKey, token } = useAuth();
  const router = useRouter();
  const [recentReports, setRecentReports] = useState<ReportListItem[]>([]);
  const [allReports, setAllReports] = useState<ReportListItem[]>([]);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!hasCompletedOnboarding() && !apiKey) {
      setShowOnboarding(true);
    }
  }, [apiKey]);

  const fetchDashboard = useCallback(async () => {
    if (!token && !apiKey) return;
    setLoading(true);
    try {
      if (token) {
        try {
          const usageRes = await apiRequest("/auth/usage", { token, timeoutMs: 15000 });
          if (usageRes.ok) {
            const data = (await usageRes.json()) as UsageResponse;
            setUsage(data);
          }
        } catch { /* usage endpoint might not be available */ }
      }

      if (apiKey) {
        try {
          // Single request — derive recent reports from the full set to avoid 429 rate limits
          const allRes = await apiRequest("/reports?page=1&per_page=100", { apiKey, timeoutMs: 15000 });
          if (allRes.ok) {
            const data = await allRes.json();
            if (Array.isArray(data.data)) {
              // Normalise: backend sends requested_format; older caches may have format
              const reports = (data.data as Record<string, unknown>[]).map(r => ({
                ...r,
                requested_format: r.requested_format ?? r.format ?? "json",
              })) as ReportListItem[];
              setAllReports(reports);
              setRecentReports(reports.slice(0, 5));
            }
          }
        } catch { /* reports endpoint might not be available */ }
      }
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }, [apiKey, token]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const statusBadge = (status: string) => {
    if (status === "completed") return <Badge variant="success">Completed</Badge>;
    if (status === "processing") return <Badge variant="warning">Processing</Badge>;
    if (status === "failed") return <Badge variant="error">Failed</Badge>;
    return <Badge variant="neutral">{status}</Badge>;
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  // --- Chart Data ---
  const reportsByMonth = (() => {
    const months: { label: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "short" });
      const count = allReports.filter(r => r.created_at?.startsWith(key)).length;
      months.push({ label, value: count });
    }
    return months;
  })();

  const reportsByStatus = (() => {
    const statuses = ["completed", "processing", "failed"];
    return statuses.map(s => ({
      label: s.charAt(0).toUpperCase() + s.slice(1),
      value: allReports.filter(r => r.status === s).length,
    })).filter(d => d.value > 0);
  })();

  const reportsByRegion = [
    { label: "Mainland", value: allReports.filter(r => r.region === "mainland").length },
    { label: "Zanzibar", value: allReports.filter(r => r.region === "zanzibar").length },
  ];

  const densityMarkers = TANZANIA_REGIONS.map(region => {
    const count = allReports.filter(r => {
      const tn = r.title_number?.toLowerCase() || "";
      const rn = region.name.toLowerCase();
      if (rn === "zanzibar") return r.region === "zanzibar";
      return tn.includes(rn.slice(0, 3));
    }).length;
    return {
      lat: region.lat,
      lng: region.lng,
      title: region.name,
      popup: `<strong>${region.name}</strong><br/>${count} report${count !== 1 ? "s" : ""}`,
    };
  });

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${name || "there"}`}
        description="Here's an overview of your property intelligence activity."
      />

      {showOnboarding && (
        <div className="mb-6">
          <OnboardingWizard
            onComplete={() => { setShowOnboarding(false); fetchDashboard(); }}
            onSkip={() => router.push("/properties")}
          />
        </div>
      )}

      {/* Stats */}
      <div className="stat-grid mb-6">
        <StatCard
          label="Reports Generated"
          value={loading ? "..." : allReports.length > 0 ? String(allReports.length) : "0"}
          icon={<IconFileText size={18} />}
        />
        <StatCard
          label="API Requests"
          value={loading ? "..." : usage ? String(usage.requests_this_month) : "0"}
          icon={<IconActivity size={18} />}
          trend={usage ? `/ ${usage.quota} quota` : undefined}
        />
        <StatCard
          label="API Tier"
          value={loading ? "..." : usage?.tier ? usage.tier.charAt(0).toUpperCase() + usage.tier.slice(1) : "Free"}
          icon={<IconShield size={18} />}
        />
        <StatCard
          label="API Key"
          value={apiKey ? "Active" : "Not Set"}
          icon={<IconKey size={18} />}
        />
      </div>

      {/* Charts Row */}
      {allReports.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="mb-6">
          <Card padding="md">
            <div className="card-header mb-2">
              <h3 className="card-title flex items-center gap-2"><IconTrendingUp size={16} /> Reports Over Time</h3>
            </div>
            <LineChart data={reportsByMonth} height={180} />
          </Card>
          <Card padding="md">
            <div className="card-header mb-2">
              <h3 className="card-title flex items-center gap-2"><IconBarChart size={16} /> Report Status</h3>
            </div>
            <BarChart data={reportsByStatus} height={180} />
          </Card>
        </div>
      )}

      {/* Usage + Region Row */}
      {(usage || allReports.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="mb-6">
          {usage && (
            <Card padding="md">
              <div className="card-header mb-3">
                <h3 className="card-title flex items-center gap-2"><IconActivity size={16} /> API Usage</h3>
              </div>
              <div className="flex items-center justify-around">
                <DonutChart
                  value={usage.requests_this_month}
                  max={usage.quota || 100}
                  label="Requests Used"
                />
                <div className="flex flex-col gap-2">
                  <div>
                    <span className="text-xs text-secondary">Tier</span>
                    <p className="font-medium">{usage.tier.charAt(0).toUpperCase() + usage.tier.slice(1)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-secondary">Resets</span>
                    <p className="text-sm">{formatDate(usage.reset_at)}</p>
                  </div>
                </div>
              </div>
            </Card>
          )}
          {allReports.length > 0 && (
            <Card padding="md">
              <div className="card-header mb-2">
                <h3 className="card-title flex items-center gap-2"><IconMap size={16} /> Regional Distribution</h3>
              </div>
              <BarChart data={reportsByRegion} height={160} barColor="var(--color-info)" />
            </Card>
          )}
        </div>
      )}

      {/* Regional Density Map */}
      {allReports.length > 0 && (
        <Card padding="md" className="mb-6">
          <div className="card-header mb-2">
            <h3 className="card-title flex items-center gap-2"><IconMap size={16} /> Property Report Density</h3>
          </div>
          <PropertyMap markers={densityMarkers} height="280px" zoom={5} />
        </Card>
      )}

      {/* Quick Actions */}
      <Card padding="md" className="mb-6">
        <div className="card-header">
          <h3 className="card-title">Quick Actions</h3>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Link href="/properties">
            <Button variant="outline" icon={<IconSearch size={16} />}>Search Property</Button>
          </Link>
          <Link href="/compare">
            <Button variant="outline" icon={<IconColumns size={16} />}>Compare Properties</Button>
          </Link>
          <Link href="/reports">
            <Button variant="outline" icon={<IconFileText size={16} />}>View Reports</Button>
          </Link>
          <Link href="/settings">
            <Button variant="outline" icon={<IconKey size={16} />}>Manage API Keys</Button>
          </Link>
        </div>
      </Card>

      {/* Recent Reports */}
      <Card padding="md">
        <div className="card-header">
          <h3 className="card-title">Recent Reports</h3>
          <Link href="/reports">
            <Button variant="ghost" size="sm">View all <IconChevronRight size={14} /></Button>
          </Link>
        </div>

        {recentReports.length === 0 ? (
          <EmptyState
            icon={<IconFileText size={24} />}
            title="No reports yet"
            description="Search for a property and generate your first report."
            action={<Link href="/properties"><Button size="sm">Search Properties</Button></Link>}
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Title Number</th>
                <th>Region</th>
                <th>Format</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {recentReports.map(r => (
                <tr key={r.report_id}>
                  <td className="font-medium">{r.title_number}</td>
                  <td>
                    <Badge variant={r.region === "zanzibar" ? "info" : "neutral"}>
                      {r.region === "zanzibar" ? "Zanzibar" : "Mainland"}
                    </Badge>
                  </td>
                  <td className="font-mono text-xs">{(r.requested_format || "json").toUpperCase()}</td>
                  <td>{statusBadge(r.status)}</td>
                  <td className="text-sm text-secondary">{formatDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
