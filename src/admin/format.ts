/** Formatting helpers shared by the dashboard tiles, charts, and tables. */

const REGION_NAMES =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(undefined, { type: "region" })
    : null;

/** Compact for tiles (12.9K), grouped everywhere a full count matters. */
export function compact(value: number): string {
  if (Math.abs(value) < 10_000) return value.toLocaleString();
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function percent(value: number): string {
  return `${value.toFixed(value < 10 ? 1 : 0)}%`;
}

/** Period-over-period change, or null when the previous period had no data. */
export function delta(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export function formatDelta(value: number): string {
  const rounded = Math.abs(value) < 10 ? value.toFixed(1) : value.toFixed(0);
  return `${value > 0 ? "+" : ""}${rounded}%`;
}

/** `2026-08-17` → `Aug 17`. Parsed as UTC to match how the day key is stored. */
export function shortDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function fullDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function dateTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function countryName(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return code;
  try {
    return REGION_NAMES?.of(code) ?? code;
  } catch {
    return code;
  }
}
