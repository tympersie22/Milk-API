"use client";

type BarChartProps = {
  data: { label: string; value: number }[];
  height?: number;
  barColor?: string;
  title?: string;
};

export function BarChart({ data, height = 200, barColor = "var(--color-primary)", title }: BarChartProps) {
  if (data.length === 0) return null;

  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <div>
      {title && <h4 className="text-sm font-medium mb-2">{title}</h4>}
      <div style={{ height, display: "flex", alignItems: "flex-end", gap: 8, padding: "8px 0" }}>
        {data.map((d, i) => {
          const barPct = Math.max((d.value / maxValue) * 100, 2);
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
              {/* Value label */}
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)", marginBottom: 4 }}>
                {d.value}
              </span>
              {/* Bar */}
              <div
                style={{
                  width: "100%",
                  maxWidth: 48,
                  height: `${barPct}%`,
                  minHeight: 4,
                  background: barColor,
                  borderRadius: "6px 6px 2px 2px",
                  transition: "height 0.4s ease",
                  opacity: 0.85,
                }}
                title={`${d.label}: ${d.value}`}
              />
              {/* Label */}
              <span style={{
                fontSize: 11,
                color: "var(--color-text-secondary)",
                marginTop: 6,
                textAlign: "center",
                lineHeight: 1.2,
                maxWidth: 60,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
      {/* Y-axis scale indicator */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 10,
        color: "var(--color-text-tertiary)",
        paddingTop: 4,
        borderTop: "1px solid var(--color-border)",
      }}>
        <span>0</span>
        <span>{maxValue}</span>
      </div>
    </div>
  );
}
