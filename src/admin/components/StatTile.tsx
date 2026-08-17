import { compact, delta, formatDelta } from "../format";

interface StatTileProps {
  label: string;
  value: number;
  /** Pre-formatted value — used for rates, where the raw number isn't a count. */
  display?: string;
  previous?: number;
  /** Comparison window, named so the delta is never ambiguous. */
  comparedTo?: string;
  footnote?: string;
}

/**
 * label · value · delta — the stat-tile contract. The value is sans (never the
 * display serif) with proportional figures; identity and direction come from
 * text, not colour alone: every delta carries an arrow glyph as well as a hue.
 */
export function StatTile({
  label,
  value,
  display,
  previous,
  comparedTo,
  footnote,
}: StatTileProps) {
  const change = previous === undefined ? null : delta(value, previous);

  return (
    <div className="rounded border border-border bg-surface p-5">
      <p className="font-body text-xs uppercase tracking-widest text-bone-muted">
        {label}
      </p>
      <p className="mt-3 font-body text-4xl font-semibold leading-none text-bone">
        {display ?? compact(value)}
      </p>
      {change !== null && (
        <p className="mt-3 font-body text-xs text-bone-muted">
          <span className={change >= 0 ? "text-emerald-300" : "text-red-300"}>
            {change >= 0 ? "▲" : "▼"} {formatDelta(change)}
          </span>{" "}
          {comparedTo ?? "vs previous period"}
        </p>
      )}
      {change === null && footnote && (
        <p className="mt-3 font-body text-xs text-bone-muted">{footnote}</p>
      )}
    </div>
  );
}
