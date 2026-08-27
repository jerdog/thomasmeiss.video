import type { VitalsSummary } from "../api";
import {
  formatThreshold,
  formatVital,
  rate,
  RATING_STYLE,
  VITAL_METRICS,
  ZONE_FILL,
  type Rating,
  type VitalMetric,
} from "../vitals";

function zoneFill(zone: Rating, active: Rating | null): string {
  return zone === active ? ZONE_FILL[zone].active : ZONE_FILL[zone].idle;
}

/**
 * Real-user performance, measured in visitors' browsers and reported at the
 * 75th percentile — the percentile Google's thresholds are defined against.
 *
 * Each metric is a single value against a limit, so the form is a meter rather
 * than a chart: a track split into good / needs-work / poor zones with the p75
 * marked on it. Threshold values are printed under the track, so the zones are
 * readable without relying on their colour.
 */
export function WebVitals({ vitals }: { vitals: VitalsSummary }) {
  const core = VITAL_METRICS.filter((metric) => metric.core);
  const supporting = VITAL_METRICS.filter((metric) => !metric.core);
  const totalSamples = VITAL_METRICS.reduce(
    (sum, metric) => sum + (vitals[metric.key]?.samples ?? 0),
    0,
  );

  return (
    <section className="rounded border border-border bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-body text-xs uppercase tracking-widest text-bone-muted">
          Web Vitals
        </h3>
        <p className="font-body text-xs text-bone-muted">
          75th percentile, measured in visitors' browsers
        </p>
      </div>

      {totalSamples === 0 ? (
        <p className="mt-4 font-body text-sm text-bone-muted">
          No measurements yet. Vitals are reported once a visitor leaves a page,
          so they appear shortly after the first real visit.
        </p>
      ) : (
        <>
          <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {core.map((metric) => (
              <VitalCard key={metric.key} metric={metric} data={vitals[metric.key]} />
            ))}
          </ul>

          <h4 className="mt-6 border-t border-border pt-5 font-body text-[10px] uppercase tracking-widest text-bone-muted">
            Supporting
          </h4>
          <ul className="mt-4 grid gap-5 sm:grid-cols-2">
            {supporting.map((metric) => (
              <VitalCard key={metric.key} metric={metric} data={vitals[metric.key]} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function VitalCard({
  metric,
  data,
}: {
  metric: VitalMetric;
  data?: { p75: number | null; samples: number };
}) {
  const value = data?.p75 ?? null;
  const samples = data?.samples ?? 0;
  const rating = value === null ? null : rate(metric, value);
  const style = rating ? RATING_STYLE[rating] : null;

  // The track runs past the "poor" threshold so a poor value still lands inside
  // the meter rather than pinning to the end.
  const scaleMax = metric.poor * 1.5;
  const position = value === null ? 0 : Math.min(value, scaleMax) / scaleMax;

  return (
    <li>
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-body text-sm text-bone">
          {metric.short}{" "}
          <span className="text-bone-muted">· {metric.aspect}</span>
        </p>
        {style && (
          <p className={`shrink-0 font-body text-xs ${style.text}`}>
            <span aria-hidden="true">{style.glyph}</span> {style.label}
          </p>
        )}
      </div>

      <p className="mt-1 font-body text-2xl font-semibold leading-none text-bone">
        {value === null ? "—" : formatVital(metric, value)}
      </p>

      {value === null ? (
        <p className="mt-3 font-body text-xs text-bone-muted">Not measured yet</p>
      ) : (
        <>
          <div
            className="relative mt-3 h-2 w-full overflow-hidden rounded-sm"
            role="img"
            aria-label={`${metric.label}: ${formatVital(metric, value)} at the 75th percentile of ${samples} samples — ${style?.label}. Good is under ${formatThreshold(metric, metric.good)}, poor is over ${formatThreshold(metric, metric.poor)}.`}
          >
            <div className="absolute inset-0 flex">
              <span
                className={`h-full ${zoneFill("good", rating)}`}
                style={{ width: `${(metric.good / scaleMax) * 100}%` }}
              />
              <span
                className={`h-full ${zoneFill("needs-work", rating)}`}
                style={{ width: `${((metric.poor - metric.good) / scaleMax) * 100}%` }}
              />
              <span className={`h-full flex-1 ${zoneFill("poor", rating)}`} />
            </div>
            {/* Marker in the text colour, ringed in the surface colour so it
                stays legible whichever zone it lands in. */}
            <span
              className="absolute top-0 h-full w-1 rounded-full bg-bone ring-2 ring-surface"
              style={{ left: `calc(${position * 100}% - 2px)` }}
            />
          </div>

          {/* Ticks sit at their true positions on the scale, not spread evenly —
              an evenly spaced label would misstate where the zone actually ends. */}
          <div className="relative mt-1.5 h-3 font-body text-[10px] tabular-nums text-bone-muted">
            <span className="absolute left-0">0</span>
            <span
              className="absolute -translate-x-1/2"
              style={{ left: `${(metric.good / scaleMax) * 100}%` }}
            >
              {formatThreshold(metric, metric.good)}
            </span>
            <span
              className="absolute -translate-x-1/2"
              style={{ left: `${(metric.poor / scaleMax) * 100}%` }}
            >
              {formatThreshold(metric, metric.poor)}
            </span>
          </div>

          <p className="mt-2 font-body text-xs text-bone-muted">
            p75 of {samples.toLocaleString()} {samples === 1 ? "sample" : "samples"}
          </p>
        </>
      )}
    </li>
  );
}
