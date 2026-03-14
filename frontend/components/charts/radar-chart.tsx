"use client";

type RadarChartProps = {
  factors: { label: string; score: number; maxScore?: number }[];
  size?: number;
  color?: string;
  title?: string;
};

/**
 * Renders a radar (spider) chart for 3+ factors.
 * Falls back to horizontal bar visualization for 1-2 factors.
 */
export function RadarChart({ factors, size = 250, color = "var(--color-primary)", title }: RadarChartProps) {
  if (factors.length === 0) return null;

  // Fallback: horizontal bars for fewer than 3 factors
  if (factors.length < 3) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {title && <h4 className="text-sm font-medium mb-2">{title}</h4>}
        <div style={{ width: "100%", maxWidth: size, display: "flex", flexDirection: "column", gap: 10 }}>
          {factors.map((f, i) => {
            const max = f.maxScore || 10;
            const pct = Math.min((f.score / max) * 100, 100);
            return (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span className="text-xs font-medium">
                    {f.label.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase())}
                  </span>
                  <span className="text-xs" style={{ color }}>{f.score}</span>
                </div>
                <div style={{
                  width: "100%", height: 8,
                  background: "var(--color-bg-subtle)",
                  borderRadius: 4,
                  overflow: "hidden",
                }}>
                  <div style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: color,
                    borderRadius: 4,
                    transition: "width 0.4s ease",
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const center = size / 2;
  const radius = size * 0.38;
  const n = factors.length;
  const angleStep = (2 * Math.PI) / n;

  const getPoint = (i: number, r: number) => ({
    x: center + r * Math.sin(i * angleStep),
    y: center - r * Math.cos(i * angleStep),
  });

  // Build the data polygon
  const dataPoints = factors.map((f, i) => {
    const max = f.maxScore || 10;
    const pct = Math.min(f.score / max, 1);
    return getPoint(i, radius * pct);
  });
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {title && <h4 className="text-sm font-medium mb-2">{title}</h4>}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Grid rings */}
        {rings.map(pct => {
          const ringPoints = Array.from({ length: n }, (_, i) => getPoint(i, radius * pct));
          const ringPath = ringPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
          return (
            <path key={pct} d={ringPath} fill="none" stroke="var(--color-border)" strokeWidth="0.5" opacity="0.6" />
          );
        })}

        {/* Axis lines */}
        {Array.from({ length: n }, (_, i) => {
          const end = getPoint(i, radius);
          return (
            <line key={i} x1={center} y1={center} x2={end.x} y2={end.y}
              stroke="var(--color-border)" strokeWidth="0.5" opacity="0.4" />
          );
        })}

        {/* Data polygon */}
        <path d={dataPath} fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.5" />

        {/* Data points */}
        {dataPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} opacity="0.8">
            <title>{`${factors[i].label}: ${factors[i].score}`}</title>
          </circle>
        ))}

        {/* Labels */}
        {factors.map((f, i) => {
          const labelR = radius + 18;
          const pt = getPoint(i, labelR);
          const anchor = pt.x < center - 5 ? "end" : pt.x > center + 5 ? "start" : "middle";
          return (
            <text
              key={i}
              x={pt.x}
              y={pt.y}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize="10"
              fill="var(--color-text-secondary)"
            >
              {f.label.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase())}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
