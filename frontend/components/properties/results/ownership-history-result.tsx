"use client";

import { Card } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { IconActivity, IconShieldOff, IconAlertTriangle, IconCheck } from "../../ui/icons";
import type { OwnershipRecord } from "../../../lib/api";

type OwnershipHistoryResultProps = {
  history: OwnershipRecord[];
  total: number;
  propertyId: string;
};

export function OwnershipHistoryResult({ history, total, propertyId }: OwnershipHistoryResultProps) {
  return (
    <Card padding="md" className="animate-slideUp">
      <div className="card-header mb-3">
        <h3 className="card-title flex items-center gap-2">
          <IconActivity size={16} /> Ownership History
        </h3>
        <Badge variant="neutral">{total} record{total !== 1 ? "s" : ""}</Badge>
      </div>

      {history.length === 0 ? (
        <p className="text-sm text-secondary p-4" style={{ textAlign: "center" }}>
          No ownership history records found for this property.
        </p>
      ) : (
        <div className="flex flex-col" style={{ position: "relative" }}>
          {/* Timeline line */}
          <div style={{
            position: "absolute",
            left: 21,
            top: 8,
            bottom: 8,
            width: 2,
            background: "var(--color-border)",
          }} />

          {history.map((record, index) => (
            <TimelineEntry key={index} record={record} isFirst={index === 0} isLast={index === history.length - 1} />
          ))}
        </div>
      )}
    </Card>
  );
}

function TimelineEntry({
  record,
  isFirst,
  isLast,
}: {
  record: OwnershipRecord;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div className="flex gap-4" style={{ padding: "12px 0", position: "relative" }}>
      {/* Timeline dot */}
      <div style={{
        width: 42, display: "flex", justifyContent: "center", flexShrink: 0, zIndex: 1,
      }}>
        <div style={{
          width: 12, height: 12, borderRadius: "50%",
          background: record.is_current ? "var(--color-primary)" : "var(--color-border)",
          border: `2px solid ${record.is_current ? "var(--color-primary)" : "var(--color-bg)"}`,
        }} />
      </div>

      {/* Content card */}
      <div className="flex-1 p-3" style={{
        borderRadius: "var(--radius-md)",
        border: `1px solid ${record.is_current ? "var(--color-primary)" : "var(--color-border)"}`,
        background: record.is_current ? "var(--color-bg-success)" : "transparent",
      }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {record.privacy_opt_out ? (
              <>
                <IconShieldOff size={14} style={{ color: "var(--color-text-secondary)" }} />
                <span className="font-medium">{record.owner_name}</span>
                <Badge variant="neutral">Private</Badge>
              </>
            ) : (
              <span className="font-medium">{record.owner_name}</span>
            )}
            <span className="text-xs text-secondary">({formatOwnerType(record.owner_type)})</span>
          </div>
          {record.is_current && <Badge variant="success">Current</Badge>}
        </div>

        <div className="flex items-center gap-4 text-xs text-secondary flex-wrap">
          {record.acquired_date && (
            <span>Acquired: {formatDate(record.acquired_date)}</span>
          )}
          {record.acquisition_method && (
            <span>Method: {formatMethod(record.acquisition_method)}</span>
          )}
          {record.transfer_ref && (
            <span className="font-mono">Ref: {record.transfer_ref}</span>
          )}
        </div>

        {/* Encumbrance indicators */}
        {(record.has_mortgage || record.has_caveat || record.has_lien) && (
          <div className="flex gap-2 mt-2">
            {record.has_mortgage && (
              <span className="text-xs flex items-center gap-1" style={{ color: "var(--color-danger)" }}>
                <IconAlertTriangle size={10} /> Mortgage
              </span>
            )}
            {record.has_caveat && (
              <span className="text-xs flex items-center gap-1" style={{ color: "var(--color-danger)" }}>
                <IconAlertTriangle size={10} /> Caveat
              </span>
            )}
            {record.has_lien && (
              <span className="text-xs flex items-center gap-1" style={{ color: "var(--color-danger)" }}>
                <IconAlertTriangle size={10} /> Lien
              </span>
            )}
          </div>
        )}
      </div>
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
      year: "numeric", month: "short", day: "numeric",
    });
  } catch {
    return d;
  }
}
