-- Migration number: 0003 	 imported historical analytics
--
-- Pre-launch history exported from Cloudflare Web Analytics.
--
-- Kept in its OWN table rather than backfilled into page_views, because the two
-- are not the same kind of data and merging them would quietly corrupt both:
--
--   * Cloudflare returns daily aggregates, not events. Synthesising one row per
--     view would invent detail that was never measured.
--   * There is no per-visitor identity to recover, so `visitor_hash` — and with
--     it the unique-visitor count — cannot be reconstructed. Cloudflare's
--     "visits" is a different metric with a different definition; it is stored
--     here under its own name rather than passed off as our visitor count.
--   * The beacons measure different populations, so a spliced series would show
--     a step change at the cutover that looks like a traffic event but is not.
--
-- The dashboard therefore draws this as a clearly-labelled dashed series and
-- leaves the KPI tiles measuring tracked data only.
--
-- The primary key is the full dimension tuple so re-running the importer is
-- idempotent (INSERT OR REPLACE). Missing dimensions are stored as '' rather
-- than NULL, because NULLs do not compare equal in a SQLite key.
CREATE TABLE IF NOT EXISTS imported_daily (
  source        TEXT    NOT NULL DEFAULT 'cloudflare-web-analytics',
  day           TEXT    NOT NULL,           -- YYYY-MM-DD (UTC)
  path          TEXT    NOT NULL DEFAULT '',
  country       TEXT    NOT NULL DEFAULT '',
  device        TEXT    NOT NULL DEFAULT '',
  referrer_host TEXT    NOT NULL DEFAULT '',
  views         INTEGER NOT NULL,           -- Cloudflare "page views"
  visits        INTEGER,                    -- Cloudflare "visits" — NOT our visitors
  imported_at   INTEGER NOT NULL,
  PRIMARY KEY (source, day, path, country, device, referrer_host)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_imported_daily_day ON imported_daily (day);
