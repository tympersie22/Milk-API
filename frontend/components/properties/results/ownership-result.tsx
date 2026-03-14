"use client";

import { Card } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { IconUsers, IconShieldOff, IconAlertTriangle, IconCheck } from "../../ui/icons";
import type { OwnershipRecord } from "../../../lib/api";

type OwnershipResultProps = {
  owner: OwnershipRecord;
  propertyId: string;
};

export function OwnershipResult({ owner, propertyId }: OwnershipResultProps) {
  return (
    <Card padding="md" className="animate-slideUp">
      <div className="card-header mb-3">
        <h3 className="card-title flex items-center gap-2">
          <IconUsers size={16} /> Current Owner
        </h3>
        {owner.is_current && <Badge variant="success">Current</Badge>}
      </div>

      {/* Owner identity */}
      <div className="p-4 mb-4" style={{
        borderRadius: "var(--radius-md)",
        background: "var(--color-bg-subtle)",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}>
        {/* Avatar */}
        <div style={{
          width: 52, height: 52, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: owner.privacy_opt_out ? "var(--color-border)" : "var(--color-primary)",
          color: "white",
          fontSize: 20, fontWeight: 700, flexShrink: 0,
        }}>
          {owner.privacy_opt_out ? <IconShieldOff size={22} /> : owner.owner_name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1">
          <div className="font-medium" style={{ fontSize: 16 }}>
            {owner.owner_name}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-secondary">{formatOwnerType(owner.owner_type)}</span>
            {owner.owner_nationality && !owner.privacy_opt_out && (
              <span className="text-sm text-secondary">Nationality: {owner.owner_nationality}</span>
            )}
            {owner.privacy_opt_out && (
              <Badge variant="neutral"><IconShieldOff size={10} /> Privacy Protected</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Acquisition details */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="mb-4">
        {owner.acquired_date && (
          <DetailItem label="Acquired Date" value={formatDate(owner.acquired_date)} />
        )}
        {owner.acquisition_method && (
          <DetailItem label="Acquisition Method" value={formatMethod(owner.acquisition_method)} />
        )}
        {owner.transfer_ref && (
          <DetailItem label="Transfer Reference" value={
            <span className="font-mono text-xs">{owner.transfer_ref}</span>
          } />
        )}
      </div>

      {/* Encumbrances */}
      <div>
        <h4 className="text-sm font-medium mb-2">Encumbrances</h4>
        <div className="flex gap-2 flex-wrap">
          <EncumbranceBadge active={owner.has_mortgage} label="Mortgage" />
          <EncumbranceBadge active={owner.has_caveat} label="Caveat" />
          <EncumbranceBadge active={owner.has_lien} label="Lien" />
        </div>
        {!owner.has_mortgage && !owner.has_caveat && !owner.has_lien && (
          <p className="text-xs text-secondary mt-2" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <IconCheck size={12} /> No encumbrances found — property is clear
          </p>
        )}
      </div>
    </Card>
  );
}

function EncumbranceBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 p-2 px-3" style={{
      borderRadius: "var(--radius-sm)",
      border: `1px solid ${active ? "var(--color-danger)" : "var(--color-border)"}`,
      background: active ? "var(--color-bg-error)" : "transparent",
      fontSize: 13,
    }}>
      {active ? (
        <IconAlertTriangle size={14} style={{ color: "var(--color-danger)" }} />
      ) : (
        <IconCheck size={14} style={{ color: "var(--color-primary)" }} />
      )}
      <span style={{ fontWeight: active ? 600 : 400, color: active ? "var(--color-danger)" : undefined }}>
        {label}
      </span>
    </div>
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

function formatOwnerType(t: string): string {
  return t.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());
}

function formatMethod(m: string): string {
  return m.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());
}

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
  } catch {
    return d;
  }
}
