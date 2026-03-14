"use client";

import { Card } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { IconCheck, IconX, IconShield, IconAlertTriangle } from "../../ui/icons";

type VerificationData = {
  title_number: string;
  region: string;
  found: boolean;
  verified: boolean;
  data_source: string | null;
  confidence: number | null;
  message: string;
};

export function VerificationResult({ data }: { data: VerificationData }) {
  const isVerified = data.found && data.verified;
  const confidencePercent = data.confidence != null ? Math.round(data.confidence * 100) : null;

  return (
    <Card padding="md" className="animate-slideUp">
      <div className="card-header mb-3">
        <h3 className="card-title flex items-center gap-2">
          <IconShield size={16} /> Verification Result
        </h3>
        <Badge variant={isVerified ? "success" : data.found ? "warning" : "error"}>
          {isVerified ? "Verified" : data.found ? "Found — Unverified" : "Not Found"}
        </Badge>
      </div>

      {/* Status banner */}
      <div className="p-4 mb-4" style={{
        borderRadius: "var(--radius-md)",
        background: isVerified ? "var(--color-bg-success)" : data.found ? "var(--color-bg-warning)" : "var(--color-bg-error)",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: isVerified ? "var(--color-primary)" : data.found ? "var(--color-accent)" : "var(--color-danger)",
          color: "white",
          flexShrink: 0,
        }}>
          {isVerified ? <IconCheck size={22} /> : data.found ? <IconAlertTriangle size={22} /> : <IconX size={22} />}
        </div>
        <div>
          <div className="font-medium" style={{ fontSize: 15 }}>
            {isVerified ? "This property is verified" : data.found ? "Property found but not verified" : "Property not found in records"}
          </div>
          <div className="text-sm" style={{ opacity: 0.8, marginTop: 2 }}>{data.message}</div>
        </div>
      </div>

      {/* Details grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <DetailItem label="Title Number" value={data.title_number} />
        <DetailItem label="Region" value={data.region === "zanzibar" ? "Zanzibar" : "Tanzania Mainland"} />
        {data.data_source && <DetailItem label="Data Source" value={data.data_source} />}
        {confidencePercent != null && (
          <DetailItem label="Confidence" value={
            <div className="flex items-center gap-2">
              <span>{confidencePercent}%</span>
              <div style={{
                width: 60, height: 6, background: "var(--color-bg-subtle)",
                borderRadius: 3, overflow: "hidden",
              }}>
                <div style={{
                  width: `${confidencePercent}%`, height: "100%",
                  background: confidencePercent >= 80 ? "var(--color-primary)" : confidencePercent >= 50 ? "var(--color-accent)" : "var(--color-danger)",
                  borderRadius: 3,
                }} />
              </div>
            </div>
          } />
        )}
      </div>
    </Card>
  );
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-secondary" style={{ marginBottom: 2 }}>{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
