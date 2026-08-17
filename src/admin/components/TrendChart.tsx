import { useState } from "react";
import type { SeriesPoint } from "../api";
import { fullDay, shortDay } from "../format";
import { axisTicks, niceMax, useMeasuredWidth, xAt } from "./chart-utils";

const HEIGHT = 260;
const PAD = { top: 16, right: 16, bottom: 26, left: 44 };

const SERIES = [
  { key: "views", label: "Page views", color: "var(--color-chart-views)" },
  { key: "visitors", label: "Visitors", color: "var(--color-chart-visitors)" },
] as const;

/**
 * Traffic over time — two series on one axis (never two scales), 2px lines with
 * a 10% wash under the leading series, a crosshair tooltip on hover or arrow
 * keys, and a table view for anyone who cannot read the marks.
 */
export function TrendChart({ series }: { series: SeriesPoint[] }) {
  const [wrapRef, width] = useMeasuredWidth<HTMLDivElement>();
  const [cursor, setCursor] = useState<number | null>(null);

  const plotWidth = Math.max(1, width - PAD.left - PAD.right);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const max = niceMax(Math.max(...series.flatMap((p) => [p.views, p.visitors]), 0));

  const x = (i: number) => xAt(i, series.length, PAD.left, plotWidth);
  const y = (value: number) => PAD.top + plotHeight - (value / max) * plotHeight;

  const line = (key: "views" | "visitors") =>
    series.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p[key])}`).join(" ");

  const area = `${line("views")} L ${x(series.length - 1)} ${PAD.top + plotHeight} L ${x(0)} ${
    PAD.top + plotHeight
  } Z`;

  const totals = series.reduce(
    (acc, p) => ({ views: acc.views + p.views, visitors: acc.visitors + p.visitors }),
    { views: 0, visitors: 0 },
  );

  function moveCursor(step: number) {
    setCursor((current) => {
      const next = (current ?? series.length - 1) + step;
      return Math.min(series.length - 1, Math.max(0, next));
    });
  }

  const active = cursor === null ? null : series[cursor];
  // Flip the tooltip to the left of the crosshair near the right edge.
  const tooltipRight = cursor !== null && x(cursor) > PAD.left + plotWidth * 0.6;

  return (
    <figure className="rounded border border-border bg-surface p-5">
      <figcaption className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-body text-xs uppercase tracking-widest text-bone-muted">
          Traffic over time
        </h3>
        <ul className="flex gap-4">
          {SERIES.map((s) => (
            <li key={s.key} className="flex items-center gap-2 font-body text-xs text-bone-muted">
              <span
                aria-hidden="true"
                className="inline-block h-0.5 w-4 rounded-full"
                style={{ background: s.color }}
              />
              {s.label}
            </li>
          ))}
        </ul>
      </figcaption>

      <div ref={wrapRef} className="relative">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          tabIndex={0}
          aria-label={`Page views and visitors per day over ${series.length} days. ${totals.views.toLocaleString()} views from ${totals.visitors.toLocaleString()} visitors in total. Use arrow keys to read individual days, or open the table below.`}
          className="touch-none rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onPointerMove={(e) => {
            const bounds = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - bounds.left - PAD.left) / plotWidth;
            const index = Math.round(ratio * (series.length - 1));
            setCursor(Math.min(series.length - 1, Math.max(0, index)));
          }}
          onPointerLeave={() => setCursor(null)}
          onBlur={() => setCursor(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") moveCursor(-1);
            else if (e.key === "ArrowRight") moveCursor(1);
            else if (e.key === "Escape") setCursor(null);
            else return;
            e.preventDefault();
          }}
        >
          {axisTicks(max).map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={PAD.left + plotWidth}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--color-border)"
                strokeWidth={1}
                opacity={0.45}
              />
              <text
                x={PAD.left - 8}
                y={y(tick) + 4}
                textAnchor="end"
                className="fill-bone-muted font-body text-[10px] tabular-nums"
              >
                {Math.round(tick).toLocaleString()}
              </text>
            </g>
          ))}

          <path d={area} fill="var(--color-chart-views)" opacity={0.1} />

          {SERIES.map((s) => (
            <path
              key={s.key}
              d={line(s.key)}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {cursor !== null && (
            <g>
              <line
                x1={x(cursor)}
                x2={x(cursor)}
                y1={PAD.top}
                y2={PAD.top + plotHeight}
                stroke="var(--color-border-strong)"
                strokeWidth={1}
              />
              {SERIES.map((s) => (
                <circle
                  key={s.key}
                  cx={x(cursor)}
                  cy={y(series[cursor][s.key])}
                  r={4}
                  fill={s.color}
                  stroke="var(--color-surface)"
                  strokeWidth={2}
                />
              ))}
            </g>
          )}

          {series.length > 0 &&
            [0, Math.floor((series.length - 1) / 2), series.length - 1]
              .filter((i, idx, all) => all.indexOf(i) === idx)
              .map((i) => (
                <text
                  key={i}
                  x={x(i)}
                  y={HEIGHT - 6}
                  textAnchor={i === 0 ? "start" : i === series.length - 1 ? "end" : "middle"}
                  className="fill-bone-muted font-body text-[10px]"
                >
                  {shortDay(series[i].day)}
                </text>
              ))}
        </svg>

        {active && (
          <div
            className="pointer-events-none absolute top-2 rounded border border-border bg-ground/95 px-3 py-2 font-body text-xs text-bone shadow-lg"
            style={
              tooltipRight
                ? { right: Math.max(8, width - x(cursor!) + 12) }
                : { left: Math.min(width - 150, x(cursor!) + 12) }
            }
            role="status"
            aria-live="polite"
          >
            <p className="text-bone-muted">{fullDay(active.day)}</p>
            {SERIES.map((s) => (
              <p key={s.key} className="mt-1 flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-block h-0.5 w-3 rounded-full"
                  style={{ background: s.color }}
                />
                {s.label}: <span className="tabular-nums">{active[s.key].toLocaleString()}</span>
              </p>
            ))}
            {active.submissions > 0 && (
              <p className="mt-1 text-bone-muted">
                Inquiries: <span className="tabular-nums">{active.submissions}</span>
              </p>
            )}
          </div>
        )}
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer font-body text-xs text-bone-muted hover:text-bone">
          View as table
        </summary>
        <div className="mt-3 max-h-64 overflow-auto">
          <table className="w-full font-body text-xs">
            <thead className="sticky top-0 bg-surface text-left text-bone-muted">
              <tr>
                <th scope="col" className="py-1 pr-4 font-normal">Day</th>
                <th scope="col" className="py-1 pr-4 text-right font-normal">Views</th>
                <th scope="col" className="py-1 pr-4 text-right font-normal">Visitors</th>
                <th scope="col" className="py-1 text-right font-normal">Inquiries</th>
              </tr>
            </thead>
            <tbody className="text-bone">
              {series.map((point) => (
                <tr key={point.day} className="border-t border-border/50">
                  <th scope="row" className="py-1 pr-4 text-left font-normal text-bone-muted">
                    {point.day}
                  </th>
                  <td className="py-1 pr-4 text-right tabular-nums">{point.views}</td>
                  <td className="py-1 pr-4 text-right tabular-nums">{point.visitors}</td>
                  <td className="py-1 text-right tabular-nums">{point.submissions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
