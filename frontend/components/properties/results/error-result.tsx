"use client";

import { useState } from "react";
import { Card } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { IconAlertTriangle, IconX } from "../../ui/icons";
import { getErrorHint, type ApiEnvelope } from "../../../lib/api";

type ErrorResultProps = {
  title: string;
  response: ApiEnvelope;
  onDismiss: () => void;
  onRetry?: () => void;
};

export function ErrorResult({ title, response, onDismiss, onRetry }: ErrorResultProps) {
  const [showRaw, setShowRaw] = useState(false);
  const status = typeof response.status === "number" ? response.status : 0;
  const hint = getErrorHint(response);
  const errorData = response.data?.error as Record<string, unknown> | undefined;
  const message = errorData?.message || response.data?.detail || response.data?.message || "An error occurred";

  const statusLabel = () => {
    if (status === 401) return "Unauthorized";
    if (status === 403) return "Forbidden";
    if (status === 404) return "Not Found";
    if (status === 429) return "Rate Limited";
    if (status >= 500) return "Server Error";
    if (status >= 400) return "Client Error";
    return "Error";
  };

  const statusColor = () => {
    if (status === 429) return "warning" as const;
    if (status >= 500) return "error" as const;
    return "warning" as const;
  };

  return (
    <Card padding="md" className="animate-slideUp">
      <div className="card-header mb-3">
        <h3 className="card-title flex items-center gap-2">
          <IconAlertTriangle size={16} style={{ color: "var(--color-danger)" }} /> {title}
        </h3>
        <div className="flex items-center gap-2">
          <Badge variant={statusColor()}>{status} {statusLabel()}</Badge>
          <button onClick={onDismiss} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)" }}>
            <IconX size={16} />
          </button>
        </div>
      </div>

      <div className="p-4" style={{
        borderRadius: "var(--radius-md)",
        background: "var(--color-bg-error)",
        border: "1px solid var(--color-danger)",
      }}>
        <p className="text-sm font-medium mb-1" style={{ color: "var(--color-danger)" }}>
          {String(message)}
        </p>
        {hint && <p className="text-sm" style={{ opacity: 0.8 }}>{hint}</p>}
      </div>

      <div className="flex items-center gap-2 mt-3">
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>Retry</Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setShowRaw(!showRaw)}>
          {showRaw ? "Hide" : "Show"} Details
        </Button>
      </div>

      {showRaw && (
        <pre className="mt-3 p-3 text-xs" style={{
          background: "var(--color-bg-subtle)",
          borderRadius: "var(--radius-md)",
          overflow: "auto",
          maxHeight: 200,
          fontFamily: "var(--font-mono)",
          border: "1px solid var(--color-border)",
        }}>
          {JSON.stringify(response.data, null, 2)}
        </pre>
      )}
    </Card>
  );
}
