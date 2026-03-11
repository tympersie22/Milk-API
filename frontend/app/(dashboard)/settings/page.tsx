"use client";

import { useState } from "react";
import { useAuth } from "../../../context/auth-context";
import { apiRequest, type Json } from "../../../lib/api";
import { PageHeader } from "../../../components/layout/page-header";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { useToast } from "../../../components/ui/toast";
import { copyToClipboard, truncate } from "../../../lib/utils";
import { IconKey, IconCopy, IconRefresh, IconShield, IconActivity } from "../../../components/ui/icons";
import { API_BASE } from "../../../lib/api";

export default function SettingsPage() {
  const { token, apiKey, email, name, generateApiKey, setApiKey } = useAuth();
  const { toast } = useToast();

  const [generating, setGenerating] = useState(false);
  const [usage, setUsage] = useState<Json | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  const onGenerateKey = async () => {
    setGenerating(true);
    const result = await generateApiKey();
    setGenerating(false);
    if (result.ok) {
      toast("API key generated successfully!", "success");
    } else {
      toast(result.error || "Failed to generate key.", "error");
    }
  };

  const onCopyKey = async () => {
    if (!apiKey) return;
    const ok = await copyToClipboard(apiKey);
    toast(ok ? "API key copied to clipboard." : "Failed to copy.", ok ? "success" : "error");
  };

  const onCopyToken = async () => {
    if (!token) return;
    const ok = await copyToClipboard(token);
    toast(ok ? "Token copied to clipboard." : "Failed to copy.", ok ? "success" : "error");
  };

  const loadUsage = async () => {
    setLoadingUsage(true);
    try {
      const res = await apiRequest("/auth/usage", { token, timeoutMs: 15000 });
      if (res.ok) {
        const data = (await res.json()) as Json;
        setUsage(data);
      } else {
        toast("Failed to load usage data.", "error");
      }
    } catch {
      toast("Could not fetch usage.", "error");
    } finally {
      setLoadingUsage(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your API keys, view usage, and configure your account."
      />

      {/* Account Info */}
      <Card padding="md" className="mb-6">
        <h3 className="card-title mb-4">Account</h3>
        <div className="form-row">
          <div className="form-group">
            <span className="form-group-label">Name</span>
            <p className="font-medium">{name || "—"}</p>
          </div>
          <div className="form-group">
            <span className="form-group-label">Email</span>
            <p className="font-medium">{email || "—"}</p>
          </div>
          <div className="form-group">
            <span className="form-group-label">API Base URL</span>
            <p className="font-mono text-sm">{API_BASE}</p>
          </div>
        </div>
      </Card>

      {/* API Key Management */}
      <Card padding="md" className="mb-6">
        <div className="card-header">
          <h3 className="card-title">API Key</h3>
          <Button
            size="sm"
            onClick={onGenerateKey}
            loading={generating}
            icon={<IconKey size={14} />}
          >
            {apiKey ? "Regenerate Key" : "Generate Key"}
          </Button>
        </div>

        {apiKey ? (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            background: "var(--color-bg-subtle)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border)",
          }}>
            <IconKey size={16} style={{ color: "var(--color-primary)", flexShrink: 0 }} />
            <code className="font-mono text-sm flex-1 min-w-0 truncate">{truncate(apiKey, 40)}</code>
            <Button variant="ghost" size="sm" onClick={onCopyKey} icon={<IconCopy size={14} />}>Copy</Button>
          </div>
        ) : (
          <p className="text-sm text-secondary">No API key generated yet. Click the button above to create one.</p>
        )}

        {token && (
          <div className="mt-4">
            <span className="form-group-label mb-2" style={{ display: "block" }}>Bearer Token</span>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              background: "var(--color-bg-subtle)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
            }}>
              <IconShield size={16} style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }} />
              <code className="font-mono text-sm flex-1 min-w-0 truncate">{truncate(token, 40)}</code>
              <Button variant="ghost" size="sm" onClick={onCopyToken} icon={<IconCopy size={14} />}>Copy</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Usage Stats */}
      <Card padding="md">
        <div className="card-header">
          <h3 className="card-title">Usage & Quotas</h3>
          <Button variant="secondary" size="sm" onClick={loadUsage} loading={loadingUsage} icon={<IconRefresh size={14} />}>
            Load Usage
          </Button>
        </div>

        {usage ? (
          <div className="form-row">
            <div className="form-group">
              <span className="form-group-label">Tier</span>
              <Badge variant="info">{String(usage.tier || "—")}</Badge>
            </div>
            <div className="form-group">
              <span className="form-group-label">Requests Used</span>
              <p className="font-semibold">{String(usage.requests_used ?? "—")}</p>
            </div>
            <div className="form-group">
              <span className="form-group-label">Monthly Limit</span>
              <p className="font-semibold">{String(usage.monthly_limit ?? "—")}</p>
            </div>
            <div className="form-group">
              <span className="form-group-label">Rate Limit</span>
              <p className="font-semibold">{String(usage.rate_limit_per_min ?? "—")} req/min</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-secondary">Click "Load Usage" to view your current quota and usage statistics.</p>
        )}
      </Card>
    </>
  );
}
