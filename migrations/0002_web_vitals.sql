-- Migration number: 0002 	 web vitals
--
-- One row per page *session* rather than per metric: the browser reports every
-- metric it has when the page is hidden, so a single row keeps the write count
-- at one per visit and makes per-metric percentiles a plain column scan.
--
-- Columns are nullable on purpose — a visitor who never interacts produces no
-- INP, and a browser that does not support a metric simply omits it. NULLs are
-- excluded from the percentile, so a metric's sample count is its own.
--
-- Deliberately no visitor identifier of any kind, not even the daily-rotating
-- hash: performance data needs no notion of who, so it does not store one.
CREATE TABLE IF NOT EXISTS web_vitals (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  ts     INTEGER NOT NULL,          -- unix seconds
  day    TEXT    NOT NULL,          -- YYYY-MM-DD (UTC)
  path   TEXT    NOT NULL,
  device TEXT    NOT NULL,          -- desktop | mobile | tablet
  lcp    REAL,                      -- Largest Contentful Paint, ms
  inp    REAL,                      -- Interaction to Next Paint, ms
  cls    REAL,                      -- Cumulative Layout Shift, unitless score
  ttfb   REAL,                      -- Time to First Byte, ms
  fcp    REAL                       -- First Contentful Paint, ms
);

CREATE INDEX IF NOT EXISTS idx_web_vitals_ts ON web_vitals (ts);
