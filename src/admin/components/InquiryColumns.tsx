import { useState } from "react";
import type { SeriesPoint } from "../api";
import { fullDay, shortDay } from "../format";
import { axisTicks, niceMax, useMeasuredWidth } from "./chart-utils";

const HEIGHT = 150;
const PAD = { top: 12, right: 16, bottom: 26, left: 44 };
const MAX_BAR = 24;
const GAP = 2; // surface gap between adjacent columns

/**
 * Contact submissions per day. One series, so no legend — the caption names it.
 * Columns are capped at 24px and separated by a 2px gap in the surface colour.
 */
export function InquiryColumns({ series }: { series: SeriesPoint[] }) {
  const [wrapRef, width] = useMeasuredWidth<HTMLDivElement>();
  const [hovered, setHovered] = useState<number | null>(null);

  const plotWidth = Math.max(1, width - PAD.left - PAD.right);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const total = series.reduce((sum, point) => sum + point.submissions, 0);
  const max = niceMax(Math.max(...series.map((p) => p.submissions), 0), 2);

  const slot = plotWidth / series.length;
  const barWidth = Math.max(1, Math.min(MAX_BAR, slot - GAP));
  const baseline = PAD.top + plotHeight;

  const barX = (i: number) => PAD.left + slot * i + (slot - barWidth) / 2;
  const barHeight = (value: number) => (value / max) * plotHeight;

  const active = hovered === null ? null : series[hovered];

  return (
    <figure className="rounded border border-border bg-surface p-5">
      <figcaption className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-body text-xs uppercase tracking-widest text-bone-muted">
          Inquiries per day
        </h3>
        <p className="font-body text-xs text-bone-muted">
          <span className="tabular-nums text-bone">{total.toLocaleString()}</span> in range
        </p>
      </figcaption>

      <div ref={wrapRef} className="relative">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Contact submissions per day: ${total} in the selected range. Individual days are listed in the table below.`}
          onPointerLeave={() => setHovered(null)}
        >
          {axisTicks(max, 2).map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={PAD.left + plotWidth}
                y1={baseline - barHeight(tick)}
                y2={baseline - barHeight(tick)}
                stroke="var(--color-border)"
                strokeWidth={1}
                opacity={0.45}
              />
              <text
                x={PAD.left - 8}
                y={baseline - barHeight(tick) + 4}
                textAnchor="end"
                className="fill-bone-muted font-body text-[10px] tabular-nums"
              >
                {Math.round(tick)}
              </text>
            </g>
          ))}

          {series.map((point, i) => (
            <g key={point.day}>
              {/* Hit target spans the whole slot — the bar itself is too thin to hover. */}
              <rect
                x={PAD.left + slot * i}
                y={PAD.top}
                width={slot}
                height={plotHeight}
                fill="transparent"
                onPointerEnter={() => setHovered(i)}
              />
              {point.submissions > 0 && (
                <path
                  d={columnPath(
                    barX(i),
                    baseline - barHeight(point.submissions),
                    barWidth,
                    barHeight(point.submissions),
                  )}
                  fill="var(--color-chart-views)"
                  opacity={hovered === null || hovered === i ? 1 : 0.55}
                  pointerEvents="none"
                />
              )}
            </g>
          ))}

          <line
            x1={PAD.left}
            x2={PAD.left + plotWidth}
            y1={baseline}
            y2={baseline}
            stroke="var(--color-border)"
            strokeWidth={1}
          />

          {[0, series.length - 1]
            .filter((i, idx, all) => i >= 0 && all.indexOf(i) === idx)
            .map((i) => (
              <text
                key={i}
                x={i === 0 ? PAD.left : PAD.left + plotWidth}
                y={HEIGHT - 6}
                textAnchor={i === 0 ? "start" : "end"}
                className="fill-bone-muted font-body text-[10px]"
              >
                {shortDay(series[i].day)}
              </text>
            ))}
        </svg>

        {active && (
          <div
            className="pointer-events-none absolute top-0 rounded border border-border bg-ground/95 px-3 py-2 font-body text-xs text-bone shadow-lg"
            style={{
              left: Math.min(Math.max(0, barX(hovered!) - 60), Math.max(0, width - 170)),
            }}
            role="status"
            aria-live="polite"
          >
            <p className="text-bone-muted">{fullDay(active.day)}</p>
            <p className="mt-1 tabular-nums">
              {active.submissions} {active.submissions === 1 ? "inquiry" : "inquiries"}
            </p>
          </div>
        )}
      </div>
    </figure>
  );
}

/** Column with a 4px rounded cap and square corners at the baseline. */
function columnPath(x: number, y: number, width: number, height: number): string {
  const radius = Math.min(4, width / 2, height);
  return [
    `M ${x} ${y + height}`,
    `L ${x} ${y + radius}`,
    `Q ${x} ${y} ${x + radius} ${y}`,
    `L ${x + width - radius} ${y}`,
    `Q ${x + width} ${y} ${x + width} ${y + radius}`,
    `L ${x + width} ${y + height}`,
    "Z",
  ].join(" ");
}
