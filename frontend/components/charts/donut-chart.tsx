"use client";

type DonutChartProps = {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
};

export function DonutChart({
  value,
  max,
  size = 120,
  strokeWidth = 10,
  color = "var(--color-primary)",
  label,
}: DonutChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(value / Math.max(max, 1), 1);
  const offset = circumference * (1 - pct);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background ring */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--color-border)" strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        {/* Center text */}
        <text x={size / 2} y={size / 2 - 4} textAnchor="middle" fontSize="16" fontWeight="600" fill="var(--color-text)">
          {Math.round(pct * 100)}%
        </text>
        <text x={size / 2} y={size / 2 + 12} textAnchor="middle" fontSize="9" fill="var(--color-text-tertiary)">
          {value} / {max}
        </text>
      </svg>
      {label && <span className="text-xs text-secondary">{label}</span>}
    </div>
  );
}
