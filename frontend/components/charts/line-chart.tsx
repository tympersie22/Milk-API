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

  // Use a proper pixel-based viewBox so text renders at readable sizes
  const svgW = 500;
  const svgH = height;
  const padding = { top: 20, right: 20, bottom: 35, left: 45 };
  const chartW = svgW - padding.left - padding.right;
  const chartH = svgH - padding.top - padding.bottom;

  const points = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1)) * chartW,
    y: padding.top + chartH - (d.value / maxValue) * chartH,
    ...d,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

  // Y-axis tick values
  const rawMax = Math.max(...data.map(d => d.value), 1);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(pct => Math.round(rawMax * pct));

  return (
    <div>
      {title && <h4 className="text-sm font-medium mb-2">{title}</h4>}
      <svg
        width="100%"
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ overflow: "visible" }}
      >
        {/* Grid lines + Y-axis labels */}
        {yTicks.map((val, idx) => {
          const pct = val / (rawMax || 1);
          const y = padding.top + chartH - chartH * pct;
          return (
            <g key={idx}>
              <line
                x1={padding.left} y1={y} x2={svgW - padding.right} y2={y}
                stroke="var(--color-border)" strokeWidth="0.5" strokeDasharray="4,3"
              />
              <text
                x={padding.left - 8} y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="var(--color-text-tertiary)"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaD} fill={fillColor} opacity="0.25" />

        {/* Line */}
        <path d={pathD} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* Data points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3.5" fill="white" stroke={lineColor} strokeWidth="2">
              <title>{`${p.label}: ${p.value}`}</title>
            </circle>
            {/* X-axis labels — show first, last, and every Nth */}
            {(i === 0 || i === data.length - 1 || i % Math.ceil(data.length / 6) === 0) && (
              <text
                x={p.x}
                y={svgH - 8}
                textAnchor="middle"
                fontSize="11"
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
          x2={svgW - padding.right} y2={padding.top + chartH}
          stroke="var(--color-border)" strokeWidth="1"
        />
      </svg>
    </div>
  );
}
