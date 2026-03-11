"use client";

type LineChartProps = {
  data: { label: string; value: number }[];
  height?: number;
  lineColor?: string;
  fillColor?: string;
  title?: string;
};

export function LineChart({
  data,
  height = 180,
  lineColor = "var(--color-primary)",
  fillColor = "var(--color-primary-light)",
  title,
}: LineChartProps) {
  if (data.length < 2) return null;

  const maxValue = Math.max(...data.map(d => d.value), 1) * 1.1;
  const padding = { top: 10, right: 5, bottom: 25, left: 5 };
  const chartW = 100 - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const points = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1)) * chartW,
    y: padding.top + chartH - (d.value / maxValue) * chartH,
    ...d,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

  return (
    <div>
      {title && <h4 className="text-sm font-medium mb-2">{title}</h4>}
      <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map(pct => {
          const y = padding.top + chartH - chartH * pct;
          return (
            <line key={pct} x1={padding.left} y1={y} x2={100 - padding.right} y2={y}
              stroke="var(--color-border)" strokeWidth="0.15" strokeDasharray="1,1" />
          );
        })}

        {/* Area fill */}
        <path d={areaD} fill={fillColor} opacity="0.3" />

        {/* Line */}
        <path d={pathD} fill="none" stroke={lineColor} strokeWidth="0.6" strokeLinejoin="round" />

        {/* Data points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="1" fill={lineColor}>
              <title>{`${p.label}: ${p.value}`}</title>
            </circle>
            {/* X-axis labels */}
            {(i === 0 || i === data.length - 1 || i % Math.ceil(data.length / 6) === 0) && (
              <text
                x={p.x}
                y={height - 8}
                textAnchor="middle"
                fontSize="2.5"
                fill="var(--color-text-tertiary)"
              >
                {p.label}
              </text>
            )}
          </g>
        ))}

        {/* Baseline */}
        <line
          x1={padding.left} y1={padding.top + chartH}
          x2={100 - padding.right} y2={padding.top + chartH}
          stroke="var(--color-border)" strokeWidth="0.2"
        />
      </svg>
    </div>
  );
}
