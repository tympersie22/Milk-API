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
import {
  IconFileText,
  IconSearch,
  IconShield,
  IconActivity,
  IconKey,
  IconChevronRight,
} from "../../components/ui/icons";
import Link from "next/link";

export default function DashboardPage() {
  const { name, apiKey, token } = useAuth();
  const router = useRouter();
  const [recentReports, setRecentReports] = useState<ReportListItem[]>([]);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check onboarding status
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
          const reportsRes = await apiRequest("/reports?page=1&per_page=5", { apiKey, timeoutMs: 15000 });
          if (reportsRes.ok) {
            const data = await reportsRes.json();
            if (Array.isArray(data.data)) setRecentReports(data.data as ReportListItem[]);
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

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${name || "there"}`}
        description="Here's an overview of your property intelligence activity."
      />

      {/* Onboarding */}
      {showOnboarding && (
        <div className="mb-6">
          <OnboardingWizard
            onComplete={() => { setShowOnboarding(false); fetchDashboard(); }}
            onSkip={() => router.push("/properties")}
          />
        </div>
      )}

      {/* Stats — aligned to UsageResponse: requests_this_month, quota, tier, reset_at */}
      <div className="stat-grid mb-6">
        <StatCard
          label="Reports Generated"
          value={loading ? "..." : recentReports.length > 0 ? String(recentReports.length) + "+" : "0"}
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

      {/* Quick Actions */}
      <Card padding="md" className="mb-6">
        <div className="card-header">
          <h3 className="card-title">Quick Actions</h3>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Link href="/properties">
            <Button variant="outline" icon={<IconSearch size={16} />}>Search Property</Button>
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
            <Button variant="ghost" size="sm">
              View all <IconChevronRight size={14} />
            </Button>
          </Link>
        </div>

        {recentReports.length === 0 ? (
          <EmptyState
            icon={<IconFileText size={24} />}
            title="No reports yet"
            description="Search for a property and generate your first report."
            action={
              <Link href="/properties">
                <Button size="sm">Search Properties</Button>
              </Link>
            }
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
                  <td className="font-mono text-xs">{r.format.toUpperCase()}</td>
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
