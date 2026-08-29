import * as React from "react";

/**
 * Circular attendance gauge (pure SVG — no client JS).
 * Color reflects whether the user is safe (>= required) or at risk.
 */
export function AttendanceRing({
  percentage,
  status,
  size = 72,
  stroke = 7,
}: {
  percentage: number | null;
  status: "safe" | "warning" | "no_data";
  size?: number;
  stroke?: number;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = percentage ?? 0;
  const offset = circumference - (Math.min(100, Math.max(0, pct)) / 100) * circumference;

  const color =
    status === "safe"
      ? "hsl(var(--success))"
      : status === "warning"
        ? "hsl(var(--warning))"
        : "hsl(var(--muted-foreground))";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--secondary))"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={status === "no_data" ? circumference : offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold">
        {percentage === null ? "—" : `${Math.round(percentage)}%`}
      </div>
    </div>
  );
}
