"use client";

import { type ReactNode } from "react";
import { cn } from "../../lib/utils";

type StatCardProps = {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  trend?: string;
  trendUp?: boolean;
  className?: string;
};

export function StatCard({ label, value, icon, trend, trendUp, className }: StatCardProps) {
  return (
    <div className={cn("stat-card", className)}>
      <div className="stat-card-header">
        <span className="stat-card-label">{label}</span>
        {icon && <span className="stat-card-icon">{icon}</span>}
      </div>
      <div className="stat-card-value">{value}</div>
      {trend && (
        <span className={cn("stat-card-trend", trendUp ? "trend-up" : "trend-down")}>
          {trend}
        </span>
      )}
    </div>
  );
}
