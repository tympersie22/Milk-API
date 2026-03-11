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
  const barWidth = Math.min(40, (100 / data.length) * 0.6);
  const gap = (100 - barWidth * data.length) / (data.length + 1);

  return (
    <div>
      {title && <h4 className="text-sm font-medium mb-2">{title}</h4>}
      <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map(pct => {
          const y = height - 20 - (height - 30) * pct;
          return (
            <g key={pct}>
              <line x1="0" y1={y} x2="100" y2={y} stroke="var(--color-border)" strokeWidth="0.2" strokeDasharray="1,1" />
              <text x="1" y={y - 1} fontSize="3" fill="var(--color-text-tertiary)">
                {Math.round(maxValue * pct)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const barHeight = (d.value / maxValue) * (height - 30);
          const x = gap + i * (barWidth + gap);
          const y = height - 20 - barHeight;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={barColor}
                rx="1"
                opacity="0.85"
              >
                <title>{`${d.label}: ${d.value}`}</title>
              </rect>
              <text
                x={x + barWidth / 2}
                y={height - 14}
                textAnchor="middle"
                fontSize="2.5"
                fill="var(--color-text-secondary)"
              >
                {d.label}
              </text>
              {/* Value label on top */}
              <text
                x={x + barWidth / 2}
                y={y - 2}
                textAnchor="middle"
                fontSize="2.8"
                fill="var(--color-text)"
                fontWeight="500"
              >
                {d.value}
              </text>
            </g>
          );
        })}

        {/* Baseline */}
        <line x1="0" y1={height - 20} x2="100" y2={height - 20} stroke="var(--color-border)" strokeWidth="0.3" />
      </svg>
    </div>
  );
}
