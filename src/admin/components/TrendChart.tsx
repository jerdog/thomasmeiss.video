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
 *
 * Pre-launch history imported from Cloudflare rides the same axis as a dashed,
 * de-emphasised line: it is the same measure (page views) from a different
 * instrument, so it takes the views hue rather than a third identity colour,
 * and the dash — not the colour — is what marks it as imported.
 */
export function TrendChart({
  series,
  trackingStartDay,
}: {
  series: SeriesPoint[];
  trackingStartDay: string | null;
}) {
  const [wrapRef, width] = useMeasuredWidth<HTMLDivElement>();
  const [cursor, setCursor] = useState<number | null>(null);

  // Where imported history stops. A plain loop rather than findLastIndex, which
  // is past this project's ES2022 lib target.
  let boundary = -1;
  for (let i = series.length - 1; i >= 0; i--) {
    if ((series[i].importedViews ?? 0) > 0) {
      boundary = i;
      break;
    }
  }
  const hasImported = boundary >= 0;

  // Days before tracking began hold zeroes that were never measured, so the
  // tracked lines start where the record does rather than running along the
  // baseline through a period this site could not see.
  // series.length when no day in range is tracked, so every index compares as
  // untracked rather than -1 making all of them look tracked.
  const firstTracked = trackingStartDay
    ? series.findIndex((point) => point.day >= trackingStartDay)
    : 0;
  const trackedFrom = firstTracked < 0 ? series.length : firstTracked;
  const tracked = series.slice(trackedFrom);

  const plotWidth = Math.max(1, width - PAD.left - PAD.right);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const max = niceMax(
    Math.max(
      ...series.flatMap((p) => [p.views, p.visitors, p.importedViews ?? 0]),
      0,
    ),
  );

  const x = (i: number) => xAt(i, series.length, PAD.left, plotWidth);
  const y = (value: number) => PAD.top + plotHeight - (value / max) * plotHeight;

  const line = (key: "views" | "visitors") =>
    tracked
      .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i + trackedFrom)} ${y(p[key])}`)
      .join(" ");

  /**
   * Imported views, broken into contiguous runs. A day Cloudflare has no record
   * for is a hole in the record, not a day of zero traffic, so the line stops
   * rather than dipping to the baseline and back.
   */
  const importedSegments: string[] = [];
  let current: string[] = [];
  for (const [i, point] of series.entries()) {
    if (point.importedViews === null || i > boundary) {
      if (current.length > 1) importedSegments.push(current.join(" "));
      current = [];
      continue;
    }
    current.push(`${current.length === 0 ? "M" : "L"} ${x(i)} ${y(point.importedViews)}`);
  }
  if (current.length > 1) importedSegments.push(current.join(" "));

  const area =
    tracked.length > 0
      ? `${line("views")} L ${x(series.length - 1)} ${PAD.top + plotHeight} L ${x(trackedFrom)} ${
          PAD.top + plotHeight
        } Z`
      : "";

  const totals = series.reduce(
    (acc, p) => ({
      views: acc.views + p.views,
      visitors: acc.visitors + p.visitors,
      importedViews: acc.importedViews + (p.importedViews ?? 0),
    }),
    { views: 0, visitors: 0, importedViews: 0 },
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
        <ul className="flex flex-wrap gap-4">
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
          {hasImported && (
            <li className="flex items-center gap-2 font-body text-xs text-bone-muted">
              <svg aria-hidden="true" width="16" height="2" className="shrink-0">
                <line
                  x1="0"
                  y1="1"
                  x2="16"
                  y2="1"
                  stroke="var(--color-chart-views)"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                  opacity={0.75}
                />
              </svg>
              Imported
            </li>
          )}
        </ul>
      </figcaption>

      <div ref={wrapRef} className="relative">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          tabIndex={0}
          aria-label={`Page views and visitors per day over ${series.length} days. ${totals.views.toLocaleString()} views from ${totals.visitors.toLocaleString()} visitors in total.${
            hasImported
              ? ` A dashed line covers the earlier days, imported from Cloudflare Web Analytics, totalling ${totals.importedViews.toLocaleString()} views; visitors were not tracked then.`
              : ""
          } Use arrow keys to read individual days, or open the table below.`}
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

          {hasImported && (
            <g>
              {importedSegments.map((segment) => (
                <path
                  key={segment}
                  d={segment}
                  fill="none"
                  stroke="var(--color-chart-views)"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  strokeLinecap="round"
                  opacity={0.75}
                />
              ))}
              {boundary < series.length - 1 && (
                <line
                  x1={x(boundary)}
                  x2={x(boundary)}
                  y1={PAD.top}
                  y2={PAD.top + plotHeight}
                  stroke="var(--color-border-strong)"
                  strokeWidth={1}
                  strokeDasharray="2 3"
                />
              )}
            </g>
          )}

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
              {cursor >= trackedFrom &&
                SERIES.map((s) => (
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
              {series[cursor].importedViews !== null && cursor <= boundary && (
                <circle
                  cx={x(cursor)}
                  cy={y(series[cursor].importedViews ?? 0)}
                  r={4}
                  fill="var(--color-chart-views)"
                  fillOpacity={0.75}
                  stroke="var(--color-surface)"
                  strokeWidth={2}
                />
              )}
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
            {cursor! >= trackedFrom ? (
              SERIES.map((s) => (
                <p key={s.key} className="mt-1 flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block h-0.5 w-3 rounded-full"
                    style={{ background: s.color }}
                  />
                  {s.label}: <span className="tabular-nums">{active[s.key].toLocaleString()}</span>
                </p>
              ))
            ) : (
              <p className="mt-1 text-bone-muted">Not tracked yet</p>
            )}
            {(active.importedViews ?? 0) > 0 && (
              <p className="mt-1 flex items-center gap-2">
                <svg aria-hidden="true" width="12" height="2" className="shrink-0">
                  <line
                    x1="0"
                    y1="1"
                    x2="12"
                    y2="1"
                    stroke="var(--color-chart-views)"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                    opacity={0.75}
                  />
                </svg>
                Imported: <span className="tabular-nums">{active.importedViews?.toLocaleString()}</span>
              </p>
            )}
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
                <th scope="col" className="py-1 pr-4 text-right font-normal">Inquiries</th>
                {hasImported && (
                  <th scope="col" className="py-1 text-right font-normal">Imported</th>
                )}
              </tr>
            </thead>
            <tbody className="text-bone">
              {series.map((point, i) => (
                <tr key={point.day} className="border-t border-border/50">
                  <th scope="row" className="py-1 pr-4 text-left font-normal text-bone-muted">
                    {point.day}
                  </th>
                  <td className="py-1 pr-4 text-right tabular-nums">
                    {i >= trackedFrom ? point.views : "—"}
                  </td>
                  <td className="py-1 pr-4 text-right tabular-nums">
                    {i >= trackedFrom ? point.visitors : "—"}
                  </td>
                  <td className="py-1 pr-4 text-right tabular-nums">
                    {i >= trackedFrom ? point.submissions : "—"}
                  </td>
                  {hasImported && (
                    <td className="py-1 text-right tabular-nums">
                      {point.importedViews ?? "—"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {hasImported && (
        <p className="mt-3 border-t border-border pt-3 font-body text-xs leading-relaxed text-bone-muted">
          The dashed line is daily page views imported from Cloudflare Web Analytics
          {boundary >= 0 && ` up to ${fullDay(series[boundary].day)}`}, before this site
          tracked its own. Cloudflare reported daily totals only, so unique visitors and
          inquiries do not exist for those days — the figures above cover tracked data only.
        </p>
      )}
    </figure>
  );
}
