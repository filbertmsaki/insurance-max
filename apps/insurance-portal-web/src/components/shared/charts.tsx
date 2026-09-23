import { useId, useState } from 'react';
import { cn } from '@/lib/utils';
import { CHART_COLORS } from './chart-colors';

const compactNumber = new Intl.NumberFormat(undefined, {
  notation: 'compact',
  maximumFractionDigits: 1,
});

function niceMax(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function shortLabel(label: string) {
  return /^\d{4}-\d{2}-\d{2}/.test(label) ? label.slice(5, 10) : label;
}

export interface TrendPoint {
  label: string;
  value: number;
  secondary?: number;
}

/**
 * Column chart with an optional overlaid line (secondary series on its own
 * scale) — mirrors the mixed bar/line charts used on Velzon dashboards.
 */
export function TrendBarChart({
  data,
  valueLabel,
  secondaryLabel,
  height = 240,
  className,
}: {
  data: TrendPoint[];
  valueLabel: string;
  secondaryLabel?: string;
  height?: number;
  className?: string;
}) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const width = 640;
  const pad = { top: 16, right: 16, bottom: 28, left: 40 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const hasSecondary =
    secondaryLabel !== undefined && data.some((d) => (d.secondary ?? 0) > 0);
  const secondaryMax = niceMax(
    Math.max(...data.map((d) => d.secondary ?? 0), 0),
  );
  const slot = innerW / Math.max(data.length, 1);
  const barW = Math.min(28, slot * 0.55);
  const labelEvery = Math.ceil(data.length / 8);

  const x = (i: number) => pad.left + slot * i + slot / 2;
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const y2 = (v: number) => pad.top + innerH - (v / secondaryMax) * innerH;

  const linePath = hasSecondary
    ? data
        .map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y2(d.secondary ?? 0)}`)
        .join(' ')
    : '';

  const hovered = hover !== null ? data[hover] : null;

  return (
    <div className={cn('relative', className)}>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ background: CHART_COLORS[0] }}
          />
          {valueLabel}
        </span>
        {hasSecondary && (
          <span className="flex items-center gap-1.5">
            <span
              className="h-0.5 w-3.5 rounded"
              style={{ background: CHART_COLORS[1] }}
            />
            {secondaryLabel}
          </span>
        )}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label={`${valueLabel} trend`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity="0.95" />
            <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity="0.7" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={pad.top + innerH * (1 - t)}
              y2={pad.top + innerH * (1 - t)}
              stroke="#e9ebec"
              strokeDasharray={t === 0 ? undefined : '3 3'}
            />
            <text
              x={pad.left - 8}
              y={pad.top + innerH * (1 - t) + 4}
              textAnchor="end"
              className="fill-slate-400 text-[11px]"
            >
              {compactNumber.format(max * t)}
            </text>
          </g>
        ))}

        {data.map((d, i) => (
          <g key={d.label + i} onMouseEnter={() => setHover(i)}>
            <rect
              x={pad.left + slot * i}
              y={pad.top}
              width={slot}
              height={innerH}
              fill={hover === i ? '#f3f6f9' : 'transparent'}
            />
            <rect
              x={x(i) - barW / 2}
              y={y(d.value)}
              width={barW}
              height={Math.max(
                pad.top + innerH - y(d.value),
                d.value > 0 ? 2 : 0,
              )}
              rx={3}
              fill={`url(#${gradientId})`}
            />
            {i % labelEvery === 0 && (
              <text
                x={x(i)}
                y={height - 8}
                textAnchor="middle"
                className="fill-slate-400 text-[11px]"
              >
                {shortLabel(d.label)}
              </text>
            )}
          </g>
        ))}

        {hasSecondary && (
          <>
            <path
              d={linePath}
              fill="none"
              stroke={CHART_COLORS[1]}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              pointerEvents="none"
            />
            {data.map((d, i) => (
              <circle
                key={d.label + i}
                cx={x(i)}
                cy={y2(d.secondary ?? 0)}
                r={hover === i ? 5 : 3}
                fill="#fff"
                stroke={CHART_COLORS[1]}
                strokeWidth={2}
                pointerEvents="none"
              />
            ))}
          </>
        )}
      </svg>

      {hovered && hover !== null && (
        <div
          className="pointer-events-none absolute top-8 z-10 -translate-x-1/2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md"
          style={{ left: `${(x(hover) / width) * 100}%` }}
        >
          <p className="mb-1 font-semibold text-slate-700">{hovered.label}</p>
          <p className="text-slate-500">
            {valueLabel}:{' '}
            <span className="font-semibold text-slate-700">
              {hovered.value.toLocaleString()}
            </span>
          </p>
          {hasSecondary && (
            <p className="text-slate-500">
              {secondaryLabel}:{' '}
              <span className="font-semibold text-slate-700">
                {(hovered.secondary ?? 0).toLocaleString()}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export interface DonutSlice {
  label: string;
  value: number;
}

/** Donut with centered total, used for status breakdowns. */
export function DonutChart({
  data,
  size = 168,
  thickness = 22,
  totalLabel = 'Total',
}: {
  data: DonutSlice[];
  size?: number;
  thickness?: number;
  totalLabel?: string;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#eff2f7"
          strokeWidth={thickness}
        />
        {total > 0 &&
          data.map((d, i) => {
            const length = (d.value / total) * circumference;
            const dash = `${Math.max(length - 1.5, 0)} ${circumference}`;
            const el = (
              <circle
                key={d.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={thickness}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
              >
                <title>{`${d.label}: ${d.value}`}</title>
              </circle>
            );
            offset += length;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold text-slate-800">
          {total.toLocaleString()}
        </span>
        <span className="text-[11px] uppercase tracking-wide text-slate-500">
          {totalLabel}
        </span>
      </div>
    </div>
  );
}
