"use client";

import { type RiskResponse } from "../../lib/api";
import { RadarChart } from "../charts/radar-chart";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { IconAlertTriangle, IconShield } from "../ui/icons";

type RiskVisualizationProps = {
  risk: RiskResponse;
};

export function RiskVisualization({ risk }: RiskVisualizationProps) {
  const riskColor = (level: string) => {
    if (level === "low") return "success" as const;
    if (level === "medium") return "warning" as const;
    return "error" as const;
  };

  const scoreColor = (score: number) => {
    if (score <= 30) return "var(--color-primary)";
    if (score <= 60) return "var(--color-accent)";
    return "var(--color-danger)";
  };

  const factors = Object.entries(risk.factors).map(([key, value]) => ({
    label: key,
    score: value.score,
    maxScore: 100,
  }));

  return (
    <Card padding="md">
      <div className="card-header mb-3">
        <h3 className="card-title flex items-center gap-2">
          <IconAlertTriangle size={16} /> Risk Assessment
        </h3>
        <Badge variant={riskColor(risk.risk_level)}>
          {risk.risk_level.charAt(0).toUpperCase() + risk.risk_level.slice(1)} Risk
        </Badge>
      </div>

      {/* Overall Score */}
      <div className="flex items-center gap-4 mb-4 p-3" style={{
        background: "var(--color-bg-subtle)",
        borderRadius: "var(--radius-md)",
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: `3px solid ${scoreColor(risk.overall_score)}`,
          fontSize: 20, fontWeight: 700, color: scoreColor(risk.overall_score),
        }}>
          {risk.overall_score}
        </div>
        <div>
          <div className="font-medium">Overall Risk Score</div>
          <div className="text-sm text-secondary">
            {risk.overall_score <= 30 ? "Low risk — property appears safe" :
             risk.overall_score <= 60 ? "Moderate risk — some concerns identified" :
             "High risk — significant issues detected"}
          </div>
        </div>
      </div>

      {/* Radar Chart */}
      {factors.length >= 3 && (
        <div className="mb-4">
          <RadarChart
            factors={factors}
            size={280}
            color={scoreColor(risk.overall_score)}
            title="Risk Factor Distribution"
          />
        </div>
      )}

      {/* Factor Breakdown */}
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium flex items-center gap-1">
          <IconShield size={14} /> Factor Details
        </h4>
        {Object.entries(risk.factors).map(([key, factor]) => (
          <div key={key} className="flex items-center gap-3 p-2" style={{
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border)",
          }}>
            <div className="flex-1">
              <div className="text-sm font-medium">
                {key.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase())}
              </div>
              <div className="text-xs text-secondary mt-1">{factor.details}</div>
            </div>
            <div style={{
              minWidth: 44, textAlign: "center",
              fontWeight: 600, fontSize: 14,
              color: scoreColor(factor.score),
            }}>
              {factor.score}
            </div>
            {/* Mini bar */}
            <div style={{
              width: 60, height: 6,
              background: "var(--color-bg-subtle)",
              borderRadius: 3,
              overflow: "hidden",
            }}>
              <div style={{
                width: `${factor.score}%`,
                height: "100%",
                background: scoreColor(factor.score),
                borderRadius: 3,
                transition: "width 0.4s ease",
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Recommendations */}
      {risk.recommendations.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium mb-2">Recommendations</h4>
          <ul style={{ paddingLeft: 16, margin: 0 }}>
            {risk.recommendations.map((rec, i) => (
              <li key={i} className="text-sm text-secondary mb-1">{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
