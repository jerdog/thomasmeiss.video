-- Migration number: 0001 	 admin dashboard: analytics + contact submissions
--
-- Apply with:
--   npx wrangler d1 migrations apply thomasmeiss-video --local   (dev)
--   npx wrangler d1 migrations apply thomasmeiss-video --remote  (production)

-- One row per pageview beacon. No IP, no user-agent string, no cookie:
-- `visitor_hash` is a salted hash of (IP + UA) mixed with the UTC day, so it
-- rotates every 24h and cannot follow anyone across days.
CREATE TABLE IF NOT EXISTS page_views (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ts            INTEGER NOT NULL,           -- unix seconds
  day           TEXT    NOT NULL,           -- YYYY-MM-DD (UTC), the rollup key
  path          TEXT    NOT NULL,
  referrer_host TEXT,                       -- NULL for direct / same-site
  country       TEXT,                       -- CF-IPCountry, 2 letters
  device        TEXT    NOT NULL,           -- desktop | mobile | tablet
  visitor_hash  TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_page_views_ts ON page_views (ts);
-- Serves the daily series and every GROUP BY day rollup without a table scan.
CREATE INDEX IF NOT EXISTS idx_page_views_day ON page_views (day);

-- One row per contact-form post. Written even when email delivery fails, so a
-- bounced send never loses the inquiry — `email_status` surfaces it instead.
CREATE TABLE IF NOT EXISTS contact_submissions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ts           INTEGER NOT NULL,
  name         TEXT    NOT NULL,
  email        TEXT    NOT NULL,
  project_type TEXT    NOT NULL,
  message      TEXT    NOT NULL,
  country      TEXT,
  referrer     TEXT,
  email_status TEXT    NOT NULL DEFAULT 'sent',  -- sent | failed
  email_error  TEXT,
  status       TEXT    NOT NULL DEFAULT 'new'    -- new | read | archived
);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_ts ON contact_submissions (ts);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_status
  ON contact_submissions (status, id DESC);
