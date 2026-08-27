/**
 * Core Web Vitals metadata — thresholds, labels, and formatting.
 *
 * `good` / `poor` are Google's published thresholds, evaluated at the 75th
 * percentile, which is why the dashboard reports p75 and not an average: an
 * average hides the slow tail that the thresholds exist to catch.
 */

export type VitalKey = "lcp" | "inp" | "cls" | "ttfb" | "fcp";
export type Rating = "good" | "needs-work" | "poor";

export interface VitalMetric {
  key: VitalKey;
  short: string;
  label: string;
  /** What a reader learns from this metric, in two words. */
  aspect: string;
  good: number;
  poor: number;
  unit: "ms" | "score";
  /** Core Web Vitals rank above the supporting diagnostics. */
  core: boolean;
}

export const VITAL_METRICS: VitalMetric[] = [
  {
    key: "lcp",
    short: "LCP",
    label: "Largest Contentful Paint",
    aspect: "Loading",
    good: 2500,
    poor: 4000,
    unit: "ms",
    core: true,
  },
  {
    key: "inp",
    short: "INP",
    label: "Interaction to Next Paint",
    aspect: "Responsiveness",
    good: 200,
    poor: 500,
    unit: "ms",
    core: true,
  },
  {
    key: "cls",
    short: "CLS",
    label: "Cumulative Layout Shift",
    aspect: "Visual stability",
    good: 0.1,
    poor: 0.25,
    unit: "score",
    core: true,
  },
  {
    key: "ttfb",
    short: "TTFB",
    label: "Time to First Byte",
    aspect: "Server response",
    good: 800,
    poor: 1800,
    unit: "ms",
    core: false,
  },
  {
    key: "fcp",
    short: "FCP",
    label: "First Contentful Paint",
    aspect: "First render",
    good: 1800,
    poor: 3000,
    unit: "ms",
    core: false,
  },
];

export function rate(metric: VitalMetric, value: number): Rating {
  if (value <= metric.good) return "good";
  if (value <= metric.poor) return "needs-work";
  return "poor";
}

/**
 * Status styling. Every rating ships a glyph and a word alongside its colour —
 * the colour is never the only thing carrying the state.
 */
export const RATING_STYLE: Record<Rating, { label: string; glyph: string; text: string }> = {
  good: { label: "Good", glyph: "✓", text: "text-emerald-300" },
  "needs-work": { label: "Needs work", glyph: "!", text: "text-amber-300" },
  poor: { label: "Poor", glyph: "✕", text: "text-red-300" },
};

/**
 * Meter zone fills. The zone the value lands in is stronger than its
 * neighbours, so the rating is scannable from the track alone — the glyph and
 * word beside the value remain the channel that does not depend on colour.
 * Written as whole class names so Tailwind keeps them.
 */
export const ZONE_FILL: Record<Rating, { active: string; idle: string }> = {
  good: { active: "bg-emerald-400/45", idle: "bg-emerald-400/15" },
  "needs-work": { active: "bg-amber-400/45", idle: "bg-amber-400/15" },
  poor: { active: "bg-red-400/45", idle: "bg-red-400/15" },
};

export function formatVital(metric: VitalMetric, value: number): string {
  if (metric.unit === "score") return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${Math.round(value)} ms`;
}

/** Short form for the threshold ticks under the meter. */
export function formatThreshold(metric: VitalMetric, value: number): string {
  if (metric.unit === "score") return String(value);
  return value >= 1000 ? `${value / 1000}s` : `${value}ms`;
}
