import type { Bucket } from "../api";

interface BarListProps {
  title: string;
  items: Bucket[];
  /** Total for the share percentage — usually the range's pageview count. */
  total: number;
  formatKey?: (key: string) => string;
  emptyMessage?: string;
}

/**
 * Ranked magnitude for one dimension: one hue for every bar (length already
 * encodes the value — colour would just repeat it), value labelled at the tip.
 */
export function BarList({
  title,
  items,
  total,
  formatKey = (key) => key,
  emptyMessage = "No data yet.",
}: BarListProps) {
  const max = Math.max(...items.map((item) => item.count), 1);

  return (
    <section className="rounded border border-border bg-surface p-5">
      <h3 className="font-body text-xs uppercase tracking-widest text-bone-muted">
        {title}
      </h3>

      {items.length === 0 ? (
        <p className="mt-4 font-body text-sm text-bone-muted">{emptyMessage}</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.key}>
              <div className="flex items-baseline justify-between gap-4">
                <span className="truncate font-body text-sm text-bone" title={formatKey(item.key)}>
                  {formatKey(item.key)}
                </span>
                <span className="shrink-0 font-body text-sm tabular-nums text-bone-muted">
                  {item.count.toLocaleString()}
                  {total > 0 && (
                    <span className="ml-2 text-xs">
                      {((item.count / total) * 100).toFixed(0)}%
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-sm bg-bone/5">
                <div
                  className="h-full rounded-r-[4px] bg-chart-views"
                  style={{ width: `${Math.max(2, (item.count / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
