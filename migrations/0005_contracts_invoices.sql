-- Migration number: 0005 	 clients, contracts, invoices
--
-- Written only by the authenticated /api/admin routes, plus the signature
-- columns on `contracts`, which the public /api/sign route sets through an
-- unguessable per-contract token.

-- One row per customer, keyed by email so a client reused across contracts and
-- invoices stays one record. Contact details are refreshed from the latest form.
CREATE TABLE IF NOT EXISTS clients (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  email      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  company    TEXT,
  phone      TEXT,
  address    TEXT,
  created_at INTEGER NOT NULL,             -- unix seconds
  updated_at INTEGER NOT NULL
);

-- `answers` is the questionnaire (JSON) the contract text is generated from.
-- `rendered` is the generated text frozen at the moment it was first sent, so
-- what the client signs is exactly what is stored — later template edits never
-- rewrite a sent contract.
CREATE TABLE IF NOT EXISTS contracts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id     INTEGER NOT NULL REFERENCES clients (id),
  submission_id INTEGER,                   -- inquiry it was drafted from, if any
  title         TEXT    NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'draft',  -- draft | sent | signed | void
  answers       TEXT    NOT NULL,
  rendered      TEXT,
  fee_cents     INTEGER NOT NULL DEFAULT 0,
  sign_token    TEXT    UNIQUE,
  signer_name   TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  sent_at       INTEGER,
  signed_at     INTEGER,
  email_error   TEXT
);

CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts (status, id DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_client ON contracts (client_id);

-- Amounts are integer cents. `items` is a JSON array of
-- { description, quantity, unitCents }; `total_cents` is derived from it on
-- every save so list views and outstanding-balance sums never parse JSON.
-- "Overdue" is not stored: it is `sent` with a due date in the past.
CREATE TABLE IF NOT EXISTS invoices (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  number               TEXT    NOT NULL UNIQUE,      -- TMV-2026-0001
  client_id            INTEGER NOT NULL REFERENCES clients (id),
  contract_id          INTEGER REFERENCES contracts (id),
  status               TEXT    NOT NULL DEFAULT 'draft',  -- draft | sent | paid | void
  issue_date           TEXT    NOT NULL,             -- YYYY-MM-DD
  due_date             TEXT    NOT NULL,             -- YYYY-MM-DD
  items                TEXT    NOT NULL,
  tax_rate             REAL    NOT NULL DEFAULT 0,   -- percent, e.g. 8.5
  total_cents          INTEGER NOT NULL DEFAULT 0,
  notes                TEXT,
  payment_instructions TEXT,
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL,
  sent_at              INTEGER,
  last_reminder_at     INTEGER,
  paid_at              INTEGER,
  email_error          TEXT
);

CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices (status, id DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices (client_id);
