import { useCallback, useEffect, useState } from "react";
import { getOverview, UnauthorizedError, type Overview as OverviewData } from "../api";
import { compact, countryName, percent } from "../format";
import { BarList } from "./BarList";
import { InquiryColumns } from "./InquiryColumns";
import { StatTile } from "./StatTile";
import { TrendChart } from "./TrendChart";

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "12 months" },
];

export function Overview({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (range: number) => {
      setLoading(true);
      try {
        setData(await getOverview(range));
        setError("");
      } catch (err) {
        if (err instanceof UnauthorizedError) return onUnauthorized();
        setError(err instanceof Error ? err.message : "Could not load analytics.");
      } finally {
        setLoading(false);
      }
    },
    [onUnauthorized],
  );

  useEffect(() => {
    void load(days);
  }, [days, load]);

  const comparedTo = `vs previous ${days} days`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl text-bone">Analytics</h2>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Date range"
        >
          {RANGES.map((range) => (
            <button
              key={range.days}
              type="button"
              onClick={() => setDays(range.days)}
              aria-pressed={days === range.days}
              className={`min-h-11 rounded-full border px-4 font-body text-xs uppercase tracking-widest transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                days === range.days
                  ? "border-accent bg-accent/15 text-bone"
                  : "border-border text-bone-muted hover:border-border-strong hover:text-bone"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded border border-red-400/50 bg-red-400/10 p-4 font-body text-sm text-red-200" role="alert">
          {error}
        </p>
      )}

      {!data ? (
        <p className="font-body text-sm text-bone-muted" role="status">
          {loading ? "Loading analytics…" : "No data yet."}
        </p>
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Visitors"
              value={data.totals.visitors}
              previous={data.previous.visitors}
              comparedTo={comparedTo}
            />
            <StatTile
              label="Page views"
              value={data.totals.views}
              previous={data.previous.views}
              comparedTo={comparedTo}
            />
            <StatTile
              label="Inquiries"
              value={data.totals.submissions}
              previous={data.previous.submissions}
              comparedTo={comparedTo}
              footnote={`${compact(data.totals.allTimeSubmissions)} all time`}
            />
            <StatTile
              label="Inquiry rate"
              value={data.totals.conversionRate}
              display={percent(data.totals.conversionRate)}
              footnote="Inquiries per 100 visitors"
            />
          </div>

          <div className="mt-6 space-y-6">
            <TrendChart series={data.series} />
            <InquiryColumns series={data.series} />

            <div className="grid gap-4 lg:grid-cols-2">
              <BarList
                title="Top pages"
                items={data.breakdowns.paths}
                total={data.totals.views}
              />
              <BarList
                title="Referrers"
                items={data.breakdowns.referrers}
                total={data.totals.views}
                emptyMessage="No external referrers yet."
              />
              <BarList
                title="Countries"
                items={data.breakdowns.countries}
                total={data.totals.views}
                formatKey={countryName}
              />
              <BarList
                title="Devices"
                items={data.breakdowns.devices}
                total={data.totals.views}
                formatKey={(key) => key.charAt(0).toUpperCase() + key.slice(1)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
