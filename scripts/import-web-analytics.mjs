#!/usr/bin/env node
/**
 * One-shot import of pre-launch history from Cloudflare Web Analytics into the
 * `imported_daily` D1 table.
 *
 *   node scripts/import-web-analytics.mjs                  # dry run: report only
 *   node scripts/import-web-analytics.mjs --days 90        # widen the window
 *   node scripts/import-web-analytics.mjs --apply          # write to production D1
 *   node scripts/import-web-analytics.mjs --apply --local  # write to the local D1
 *   node scripts/import-web-analytics.mjs --debug          # echo raw API responses
 *
 * Overrides when discovery cannot work it out: --site-tag=<tag>, --dataset=<name>.
 *
 * Reads from .dev.vars:
 *   CLOUDFLARE_ACCOUNT_ID     the account that owns the Web Analytics site
 *   CF_ANALYTICS_API_TOKEN    a token with Account Analytics:Read
 *
 * The token is only ever used here — it is never uploaded to the Worker. Create
 * a temporary one for the import and delete it afterwards.
 *
 * WHY THIS SCRIPT INTROSPECTS: Cloudflare's GraphQL schema names its RUM
 * dataset, dimensions, and filters differently across accounts and revisions,
 * and a wrong field name fails the whole query. Rather than hard-coding names,
 * the script asks the API which dataset and dimensions actually exist and
 * builds the query from that, reporting exactly what it found. Run it without
 * --apply first: it prints the plan and a summary of what would be imported.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API_BASE = process.env.CF_API_BASE ?? "https://api.cloudflare.com/client/v4";
const DATABASE = "thomasmeiss-video";
const SOURCE = "cloudflare-web-analytics";
const HOSTNAME = "thomasmeiss.video";
const MAX_ROWS_PER_DAY = 10_000; // GraphQL node limit

/** Enough nesting to unwrap `[Thing!]!` down to its named type. */
const TYPE_REF = `name kind ofType { name kind ofType { name kind ofType { name kind } } }`;

/** Used when the endpoint will not describe its own schema. */
const FALLBACK_PLAN = {
  dataset: "rumPageloadEventsAdaptiveGroups",
  dimensions: {
    path: "requestPath",
    country: "countryName",
    device: "deviceType",
    referrer_host: "refererHost",
  },
  hasVisits: true,
};

/** Dimensions we want, best name first — whichever the schema actually has wins. */
const DIMENSION_CANDIDATES = {
  path: ["requestPath", "path", "pagePath"],
  country: ["countryName", "countryCode", "country"],
  device: ["deviceType", "device"],
  referrer_host: ["refererHost", "referrerHost", "referer", "referrer"],
};

const args = parseArgs(process.argv.slice(2));

/** Set once credentials are read, so auth errors can name the account. */
let accountIdInUse = "";

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});

async function main() {
  const { accountId, token } = readCredentials();
  accountIdInUse = accountId;
  const { from, to } = dateRange(args.days);

  info(`Account ${accountId}`);
  info(`Range   ${from} → ${to} (${args.days} days)`);
  info(`Token   ${describeSecret(token)}`);
  if (API_BASE !== "https://api.cloudflare.com/client/v4") {
    warn(`Using API base override: ${API_BASE}`);
  }

  await verifyToken(token);

  const siteTag = args.siteTag ?? (await discoverSiteTag(accountId, token));
  info(`Site    ${siteTag}`);

  const proposed = await planQuery(token);
  // Prove the query shape against one day before spending 90 requests on it.
  const plan = await negotiatePlan(token, accountId, siteTag, proposed, to);

  info(`Dataset ${plan.dataset}`);
  info(`Dims    ${Object.entries(plan.dimensions).map(([k, v]) => `${k}→${v}`).join(", ") || "date only"}`);
  info(`Metrics count${plan.hasVisits ? " + sum.visits" : ""}`);

  const fetched = await fetchRange(token, accountId, siteTag, plan, from, to);
  const rows = aggregate(fetched);

  if (rows.length === 0) {
    warn("No rows returned. Either the beacon was not running in this window,");
    warn("or the data has aged out of Cloudflare's retention.");
    return;
  }

  summarize(rows);

  const sqlPath = join(REPO_ROOT, "imported-web-analytics.sql");
  writeFileSync(sqlPath, toSql(rows));
  info(`Wrote ${sqlPath}`);

  if (!args.apply) {
    info("");
    info("Dry run — nothing written to D1. Re-run with --apply to import.");
    return;
  }

  applyToD1(sqlPath, args.local);
}

// ── Cloudflare API ───────────────────────────────────────────────────────────

async function api(path, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.success === false) {
    const hint =
      res.status === 401 || res.status === 403
        ? `\n  Token read from .dev.vars: ${describeSecret(token)}`
        : "";
    throw new Error(
      `GET ${path} failed (${res.status}): ${JSON.stringify(body?.errors ?? body)}${hint}`,
    );
  }
  return body.result;
}

async function graphql(token, query, variables) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${API_BASE}/graphql`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });

    if (res.status === 429) {
      const wait = 2 ** attempt * 1000;
      warn(`Rate limited, retrying in ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }

    const body = await res.json().catch(() => null);
    if (args.debug) {
      warn(`GraphQL ${res.status} ← ${JSON.stringify(body).slice(0, 800)}`);
    }

    // The GraphQL endpoint is the authority on the credential, so this is where
    // an auth failure is diagnosed rather than guessed at earlier.
    if (res.status === 401 || res.status === 403) {
      throw fatalError(
        `Cloudflare rejected the credential (${res.status}): ` +
          `${JSON.stringify(body?.errors ?? body)}\n` +
          `  Token read from .dev.vars: ${describeSecret(token)}\n` +
          `  Check, in order:\n` +
          `   1. The value above matches the token you created — a stale line left\n` +
          `      above the new one in .dev.vars is the usual cause.\n` +
          `   2. It is an API Token, not the Global API Key (which needs different\n` +
          `      headers entirely and will always fail here).\n` +
          `   3. The token grants Account · Account Analytics · Read on account\n` +
          `      ${accountIdInUse || "(the one in .dev.vars)"}, and is not IP- or\n` +
          `      TTL-restricted.`,
      );
    }

    if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}: ${JSON.stringify(body)}`);
    if (body?.errors?.length) {
      throw new Error(`GraphQL error: ${body.errors.map((e) => e.message).join("; ")}`);
    }
    return body.data;
  }
  throw new Error("GraphQL rate limit did not clear after 4 attempts");
}

/**
 * Find the Web Analytics site tag for the hostname. The REST shape varies, so
 * this matches the hostname anywhere in each entry rather than assuming a path,
 * and falls back to listing what it found.
 */
async function discoverSiteTag(accountId, token) {
  let sites;
  try {
    sites = await api(`/accounts/${accountId}/rum/site_info/list?per_page=100`, token);
  } catch (err) {
    throw new Error(
      `Could not list Web Analytics sites: ${err.message}\n` +
        `Pass the site tag explicitly with --site-tag=<tag> (Web Analytics → your site → the "Site Tag").`,
    );
  }

  const list = Array.isArray(sites) ? sites : (sites?.items ?? []);
  const match = list.find((site) => JSON.stringify(site).includes(HOSTNAME));
  if (match?.site_tag) return match.site_tag;

  throw new Error(
    `No Web Analytics site matched ${HOSTNAME}. Found ${list.length} site(s):\n` +
      list.map((s) => `  ${s.site_tag ?? "?"}  ${s.ruleset?.zone_name ?? ""}`).join("\n") +
      `\nPass one with --site-tag=<tag>.`,
  );
}

/**
 * Advisory token check — never fatal.
 *
 * `/user/tokens/verify` only validates *user-owned* tokens: an account-owned
 * token is rejected there with the same "Invalid API Token" as a genuinely bad
 * one, even though it works perfectly against the endpoint we actually need.
 * Failing the run on this call therefore blocks tokens that are fine. The
 * GraphQL request is the only authority on whether the token works, so this
 * reports what it saw and gets out of the way.
 */
async function verifyToken(token) {
  let res;
  try {
    res = await fetch(`${API_BASE}/user/tokens/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    warn(`Could not reach ${API_BASE} to check the token: ${err.message}`);
    return;
  }

  if (res.ok) {
    const body = await res.json().catch(() => null);
    const status = body?.result?.status;
    if (status && status !== "active") warn(`Token status is "${status}", not "active".`);
    return;
  }

  warn(
    `Token check returned ${res.status}. That is expected for an account-owned ` +
      `token, which this endpoint cannot verify — continuing, since the GraphQL ` +
      `call is what actually matters.`,
  );
}

/** Unwrap NON_NULL / LIST wrappers to the underlying named type. */
function unwrapType(type) {
  let current = type;
  while (current && !current.name && current.ofType) current = current.ofType;
  return current?.name ?? null;
}

/**
 * Find the type behind `viewer.accounts` rather than assuming it is called
 * "Account" — the schema's naming is not something this script should hard-code.
 */
async function discoverAccountType(token) {
  const root = await graphql(token, `query { __schema { queryType { name } } }`);
  const queryType = root?.__schema?.queryType?.name;
  if (!queryType) return null;

  const viewerType = await fieldTypeName(token, queryType, "viewer");
  if (!viewerType) return null;

  return fieldTypeName(token, viewerType, "accounts");
}

async function fieldTypeName(token, typeName, fieldName) {
  const data = await graphql(
    token,
    `query($t: String!) { __type(name: $t) { fields { name type { ${TYPE_REF} } } } }`,
    { t: typeName },
  );
  const field = (data?.__type?.fields ?? []).find((f) => f.name === fieldName);
  return field ? unwrapType(field.type) : null;
}

/**
 * Ask the schema which RUM dataset and dimensions exist, so the data query is
 * built from reality rather than from a guess.
 *
 * Introspection is an optimisation, not a requirement: if the endpoint will not
 * describe itself, fall back to the conventional names and let the data query —
 * which negotiates itself down field by field — be the source of truth.
 */
async function planQuery(token) {
  let fields = [];
  let accountType = null;

  try {
    accountType = await discoverAccountType(token);
    if (accountType) {
      const data = await graphql(
        token,
        `query($t: String!) { __type(name: $t) { fields { name type { ${TYPE_REF} } } } }`,
        { t: accountType },
      );
      fields = data?.__type?.fields ?? [];
    }
  } catch (err) {
    warn(`Schema introspection failed: ${err.message}`);
  }

  if (fields.length === 0) {
    warn(
      accountType
        ? `Schema described no fields on type "${accountType}".`
        : "Could not locate the account type in the schema.",
    );
    warn("Falling back to conventional field names; the query will adapt if they are wrong.");
    return { ...FALLBACK_PLAN, dimensions: { ...FALLBACK_PLAN.dimensions }, negotiated: false };
  }

  const candidates = fields
    .map((f) => f.name)
    .filter((name) => /^rum.*(pageload|pageview).*Groups$/i.test(name));

  const dataset =
    args.dataset ??
    candidates.find((name) => /adaptiveGroups$/i.test(name)) ??
    candidates[0];

  if (!dataset) {
    const rumFields = fields.map((f) => f.name).filter((n) => /^rum/i.test(n));
    throw new Error(
      `No RUM pageview dataset found on this account. RUM datasets available:\n  ${
        rumFields.join("\n  ") || "(none — is Web Analytics enabled?)"
      }\nPick one with --dataset=<name>.`,
    );
  }

  const field = fields.find((f) => f.name === dataset);
  const typeName = field ? unwrapType(field.type) : null;
  if (!typeName) {
    warn(`Could not resolve the type of ${dataset}; using conventional dimension names.`);
    return { ...FALLBACK_PLAN, dataset, dimensions: { ...FALLBACK_PLAN.dimensions }, negotiated: false };
  }

  const dimensionsType = await typeFieldType(token, typeName, "dimensions");
  const available = new Set(await typeFields(token, dimensionsType));

  if (!available.has("date")) {
    throw new Error(
      `Dataset ${dataset} has no "date" dimension; available: ${[...available].join(", ")}`,
    );
  }

  const dimensions = {};
  for (const [column, names] of Object.entries(DIMENSION_CANDIDATES)) {
    const found = names.find((name) => available.has(name));
    if (found) dimensions[column] = found;
    else warn(`No dimension available for "${column}" — it will be imported empty.`);
  }

  const sumType = await typeFieldType(token, typeName, "sum").catch(() => null);
  const sumFields = sumType ? await typeFields(token, sumType) : [];

  return {
    dataset,
    dimensions,
    hasVisits: sumFields.includes("visits"),
    negotiated: true,
  };
}

/**
 * Prove the query shape against a single day before fetching ninety of them,
 * dropping whatever the API objects to and trying again.
 *
 * Cloudflare names the offending field in its error, so a wrong dimension costs
 * one retry rather than the whole import. Daily totals are what the dashboard
 * actually needs; path, country and device are enrichment, so degrading to
 * fewer dimensions is much better than failing outright.
 */
async function negotiatePlan(token, accountId, siteTag, plan, day) {
  let current = plan;

  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      await fetchDay(token, accountId, siteTag, current, day);
      return current;
    } catch (err) {
      // A rejected credential is not a query-shape problem; dropping fields
      // would only bury the real message under misleading retries.
      if (err.fatal) throw err;
      const dropped = dropRejectedField(current, err.message);
      if (!dropped) throw err;
      warn(`Query rejected, retrying without ${dropped}.`);
      if (args.debug) warn(err.message);
    }
  }

  throw new Error("Could not find a query shape this account accepts.");
}

/**
 * Remove the field the API complained about. Returns what was dropped, or null
 * when the error is about something this script cannot fix by simplifying —
 * in which case the caller surfaces the original error rather than blindly
 * stripping the query down to nothing.
 */
function dropRejectedField(plan, message) {
  const named = [...message.matchAll(/["'`]([A-Za-z_][A-Za-z0-9_]*)["'`]/g)].map((m) => m[1]);

  for (const [column, field] of Object.entries(plan.dimensions)) {
    if (named.includes(field)) {
      delete plan.dimensions[column];
      return field;
    }
  }

  if (plan.hasVisits && named.includes("visits")) {
    plan.hasVisits = false;
    return "sum.visits";
  }

  // A complaint about the filter or the date grouping is not something fewer
  // dimensions can fix — surface it rather than stripping the query for nothing.
  if (["siteTag", "date", "filter", "limit", "orderBy"].some((f) => named.includes(f))) {
    return null;
  }

  // Nothing recognisable: try once with only the date dimension before giving up.
  const extras = Object.keys(plan.dimensions);
  if (extras.length > 0) {
    plan.dimensions = {};
    return `the optional dimensions (${extras.join(", ")})`;
  }

  if (plan.hasVisits) {
    plan.hasVisits = false;
    return "sum.visits";
  }

  return null;
}

async function typeFieldType(token, typeName, fieldName) {
  const data = await graphql(
    token,
    `query($t: String!) { __type(name: $t) { fields { name type { name kind ofType { name } } } } }`,
    { t: typeName },
  );
  const field = (data?.__type?.fields ?? []).find((f) => f.name === fieldName);
  const resolved = field?.type?.name ?? field?.type?.ofType?.name;
  if (!resolved) throw new Error(`Type ${typeName} has no "${fieldName}" field`);
  return resolved;
}

async function typeFields(token, typeName) {
  const data = await graphql(
    token,
    `query($t: String!) { __type(name: $t) { fields { name } } }`,
    { t: typeName },
  );
  return (data?.__type?.fields ?? []).map((f) => f.name);
}

/** One query per day keeps every response inside the row limit. */
async function fetchRange(token, accountId, siteTag, plan, from, to) {
  const rows = [];
  const days = eachDay(from, to);

  for (const [index, day] of days.entries()) {
    process.stderr.write(`\r  fetching ${index + 1}/${days.length} (${day})   `);
    const dayRows = await fetchDay(token, accountId, siteTag, plan, day);
    rows.push(...dayRows);
    if (dayRows.length >= MAX_ROWS_PER_DAY) {
      warn(`\n${day} hit the ${MAX_ROWS_PER_DAY}-row limit; totals for that day may be partial.`);
    }
  }
  process.stderr.write("\r".padEnd(48) + "\r");
  return rows;
}

async function fetchDay(token, accountId, siteTag, plan, day) {
  const dimensionFields = ["date", ...Object.values(plan.dimensions)].join("\n              ");
  const query = `
    query($accountId: String!, $siteTag: String!, $day: Date!, $limit: Int!) {
      viewer {
        accounts(filter: { accountTag: $accountId }) {
          ${plan.dataset}(
            filter: { siteTag: $siteTag, date: $day }
            limit: $limit
            orderBy: [count_DESC]
          ) {
            count
            ${plan.hasVisits ? "sum { visits }" : ""}
            dimensions {
              ${dimensionFields}
            }
          }
        }
      }
    }`;

  const data = await graphql(token, query, {
    accountId,
    siteTag,
    day,
    limit: MAX_ROWS_PER_DAY,
  });

  const groups = data?.viewer?.accounts?.[0]?.[plan.dataset] ?? [];
  return groups.map((group) => ({
    day: group.dimensions.date,
    path: pick(group.dimensions, plan.dimensions.path),
    country: pick(group.dimensions, plan.dimensions.country),
    device: pick(group.dimensions, plan.dimensions.device),
    referrer_host: hostOnly(pick(group.dimensions, plan.dimensions.referrer_host)),
    views: Number(group.count) || 0,
    visits: plan.hasVisits ? (Number(group.sum?.visits) || 0) : null,
  }));
}

/**
 * Sum buckets that share a key after normalisation.
 *
 * Cloudflare's groups are unique per dimension tuple, but normalising collapses
 * some of them — `https://www.google.com/` and `google.com` both become
 * `google.com`. Since the D1 primary key is the normalised tuple, colliding
 * buckets have to be summed here; letting INSERT OR REPLACE resolve them would
 * silently drop every view but the last.
 */
function aggregate(rows) {
  const byKey = new Map();

  for (const row of rows) {
    const key = [row.day, row.path, row.country, row.device, row.referrer_host].join(" ");
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...row });
      continue;
    }
    existing.views += row.views;
    if (row.visits !== null) existing.visits = (existing.visits ?? 0) + row.visits;
  }

  return [...byKey.values()];
}

// ── Output ───────────────────────────────────────────────────────────────────

function summarize(rows) {
  const days = new Set(rows.map((r) => r.day));
  const views = rows.reduce((sum, r) => sum + r.views, 0);
  const visits = rows.reduce((sum, r) => sum + (r.visits ?? 0), 0);
  const sorted = [...days].sort();

  info("");
  info(`Rows    ${rows.length.toLocaleString()} daily buckets`);
  info(`Days    ${days.size} (${sorted[0]} → ${sorted[sorted.length - 1]})`);
  info(`Views   ${views.toLocaleString()}`);
  if (visits) info(`Visits  ${visits.toLocaleString()} (Cloudflare's metric — not our visitor count)`);
}

/**
 * No BEGIN TRANSACTION / COMMIT. D1's remote engine rejects explicit
 * transaction statements outright ("please use the state.storage.transaction()
 * ... APIs instead"), even though the local SQLite dev database accepts them —
 * so a file that works against --local fails against --remote. Wrangler already
 * sends the statements as one batch, and every statement is INSERT OR REPLACE
 * keyed on the full dimension tuple, so a partial run is fixed by running it
 * again rather than by rolling back.
 */
function toSql(rows) {
  const now = Math.floor(Date.now() / 1000);
  const lines = [
    "-- Generated by scripts/import-web-analytics.mjs — idempotent, safe to re-run.",
    "-- Deliberately no BEGIN/COMMIT: remote D1 rejects explicit transactions.",
  ];

  for (const row of rows) {
    lines.push(
      "INSERT OR REPLACE INTO imported_daily " +
        "(source, day, path, country, device, referrer_host, views, visits, imported_at) VALUES (" +
        [
          quote(SOURCE),
          quote(row.day),
          quote(row.path),
          quote(row.country),
          quote(row.device),
          quote(row.referrer_host),
          Math.round(row.views),
          row.visits === null ? "NULL" : Math.round(row.visits),
          now,
        ].join(", ") +
        ");",
    );
  }

  lines.push("");
  return lines.join("\n");
}

function applyToD1(sqlPath, local) {
  const target = local ? "--local" : "--remote";
  info(`Applying to D1 (${target})…`);

  // Captured rather than inherited so wrangler's failures can be translated
  // into something actionable; the raw output is still printed either way.
  const result = spawnSync(
    "npx",
    ["wrangler", "d1", "execute", DATABASE, target, `--file=${sqlPath}`, "--yes"],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );

  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");

  if (result.status === 0) {
    info("Imported.");
    return;
  }

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

  if (/no such table/i.test(output)) {
    fail(
      `The imported_daily table does not exist on the ${local ? "local" : "remote"} database.\n` +
        `Run the migrations first:\n` +
        `  npm run db:migrate${local ? "" : ":remote"}\n` +
        `then re-run this import — the fetched data is already in ${sqlPath}.`,
    );
  }

  fail(
    `wrangler exited with code ${result.status}. The SQL is still at ${sqlPath};\n` +
      `once the cause is fixed it can be applied directly with:\n` +
      `  npx wrangler d1 execute ${DATABASE} ${target} --file=${sqlPath} --yes`,
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function readCredentials() {
  let raw;
  try {
    raw = readFileSync(join(REPO_ROOT, ".dev.vars"), "utf8");
  } catch {
    fail(".dev.vars not found — copy .dev.vars-example and fill it in.");
  }

  const accountId = readVar(raw, "CLOUDFLARE_ACCOUNT_ID");
  const token = readVar(raw, "CF_ANALYTICS_API_TOKEN");

  if (!accountId) fail("CLOUDFLARE_ACCOUNT_ID is missing from .dev.vars");
  if (!token) {
    fail(
      "CF_ANALYTICS_API_TOKEN is missing from .dev.vars.\n" +
        "Create one at dash.cloudflare.com → My Profile → API Tokens with\n" +
        "permission Account · Account Analytics · Read, and delete it after the import.",
    );
  }
  return { accountId, token };
}

/**
 * Read one key from the dotenv-style file.
 *
 * The LAST non-empty assignment wins, matching scripts/deploy.sh. That matters:
 * appending a replacement token below an old one is the obvious way to swap it,
 * and taking the first would silently keep using the stale value.
 */
function readVar(raw, key) {
  const matches = [...raw.matchAll(new RegExp(`^[ \\t]*${key}[ \\t]*=(.*)$`, "gm"))];
  const values = matches
    .map((match) => match[1].trim().replace(/^(["'])(.*)\1$/, "$2").trim())
    .filter(Boolean);

  if (values.length > 1) {
    warn(`.dev.vars assigns ${key} ${values.length} times — using the last one.`);
  }
  return values[values.length - 1] ?? "";
}

/**
 * Describe a secret without printing it, so a value mangled on its way out of
 * .dev.vars (stray quotes, a trailing comment, the wrong credential entirely)
 * can be identified from the output.
 */
function describeSecret(value) {
  const masked =
    value.length > 12 ? `${value.slice(0, 4)}…${value.slice(-4)}` : "(too short to mask)";
  const notes = [];

  if (/\s/.test(value)) notes.push("contains whitespace — quoting or a trailing comment?");
  if (/["']/.test(value)) notes.push("contains a quote character");
  if (/^[0-9a-f]+$/.test(value)) {
    notes.push("all lowercase hex — this looks like a Global API Key, not an API Token");
  }
  if (!/^[A-Za-z0-9_.-]+$/.test(value)) notes.push("contains unexpected characters");

  return `${value.length} chars, ${masked}${notes.length ? ` — ${notes.join("; ")}` : ""}`;
}

/** Accepts both `--days=14` and `--days 14`. */
function parseArgs(argv) {
  const parsed = {
    days: 90,
    apply: false,
    local: false,
    debug: false,
    siteTag: null,
    dataset: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const [flag, inline] = arg.split(/=(.*)/s);
    const next = () => {
      if (inline !== undefined) return inline;
      const following = argv[++i];
      if (following === undefined || following.startsWith("--")) {
        fail(`${flag} needs a value`);
      }
      return following;
    };

    if (flag === "--apply") parsed.apply = true;
    else if (flag === "--local") parsed.local = true;
    else if (flag === "--debug") parsed.debug = true;
    else if (flag === "--days") {
      const days = Number(next());
      if (!Number.isInteger(days) || days < 1) fail("--days must be a positive whole number");
      parsed.days = days;
    } else if (flag === "--site-tag") parsed.siteTag = next();
    else if (flag === "--dataset") parsed.dataset = next();
    else if (flag === "--help" || flag === "-h") {
      console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]);
      process.exit(0);
    } else fail(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function dateRange(days) {
  const to = new Date(Date.now() - 86_400_000); // yesterday: today is still partial
  const from = new Date(to.getTime() - (days - 1) * 86_400_000);
  return { from: iso(from), to: iso(to) };
}

function eachDay(from, to) {
  const days = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
    days.push(iso(new Date(t)));
  }
  return days;
}

function iso(date) {
  return date.toISOString().slice(0, 10);
}

function pick(dimensions, key) {
  return key ? String(dimensions[key] ?? "").slice(0, 256) : "";
}

/** Referrers arrive as hosts or full URLs depending on the dimension used. */
function hostOnly(value) {
  if (!value) return "";
  try {
    return new URL(value.includes("://") ? value : `https://${value}`).hostname.replace(/^www\./, "");
  } catch {
    return value.replace(/^www\./, "");
  }
}

// Function declarations, not consts: `main()` runs at module top level, so
// anything it touches must already be hoisted.
function quote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function info(message) {
  console.log(message);
}

function warn(message) {
  console.warn(`\x1b[33mwarning:\x1b[0m ${message}`);
}

/** An error no amount of simplifying the query can fix. */
function fatalError(message) {
  const error = new Error(message);
  error.fatal = true;
  return error;
}

function fail(message) {
  console.error(`\x1b[31merror:\x1b[0m ${message}`);
  process.exit(1);
}
