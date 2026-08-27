#!/usr/bin/env node
/**
 * One-shot import of pre-launch history from Cloudflare Web Analytics into the
 * `imported_daily` D1 table.
 *
 *   node scripts/import-web-analytics.mjs                  # dry run: report only
 *   node scripts/import-web-analytics.mjs --days 90        # widen the window
 *   node scripts/import-web-analytics.mjs --apply          # write to production D1
 *   node scripts/import-web-analytics.mjs --apply --local  # write to the local D1
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

/** Dimensions we want, best name first — whichever the schema actually has wins. */
const DIMENSION_CANDIDATES = {
  path: ["requestPath", "path", "pagePath"],
  country: ["countryName", "countryCode", "country"],
  device: ["deviceType", "device"],
  referrer_host: ["refererHost", "referrerHost", "referer", "referrer"],
};

const args = parseArgs(process.argv.slice(2));

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});

async function main() {
  const { accountId, token } = readCredentials();
  const { from, to } = dateRange(args.days);

  info(`Account ${accountId}`);
  info(`Range   ${from} → ${to} (${args.days} days)`);
  if (API_BASE !== "https://api.cloudflare.com/client/v4") {
    warn(`Using API base override: ${API_BASE}`);
  }

  const siteTag = args.siteTag ?? (await discoverSiteTag(accountId, token));
  info(`Site    ${siteTag}`);

  const plan = await planQuery(token);
  info(`Dataset ${plan.dataset}`);
  info(`Dims    ${Object.entries(plan.dimensions).map(([k, v]) => `${k}→${v}`).join(", ") || "(none)"}`);
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
    throw new Error(
      `GET ${path} failed (${res.status}): ${JSON.stringify(body?.errors ?? body)}`,
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
 * Ask the schema which RUM dataset and dimensions exist, so the data query is
 * built from reality rather than from a guess.
 */
async function planQuery(token) {
  const accountType = await graphql(
    token,
    `query { __type(name: "Account") { fields { name type { name ofType { name } } } } }`,
  );

  const fields = accountType?.__type?.fields ?? [];
  if (fields.length === 0) {
    throw new Error("Schema introspection returned no Account fields — is the token valid?");
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
  const typeName = field.type?.name ?? field.type?.ofType?.name;
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

  return { dataset, dimensions, hasVisits: sumFields.includes("visits") };
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

function toSql(rows) {
  const now = Math.floor(Date.now() / 1000);
  const lines = [
    "-- Generated by scripts/import-web-analytics.mjs — safe to re-run.",
    "BEGIN TRANSACTION;",
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

  lines.push("COMMIT;", "");
  return lines.join("\n");
}

function applyToD1(sqlPath, local) {
  const target = local ? "--local" : "--remote";
  info(`Applying to D1 (${target})…`);
  const result = spawnSync(
    "npx",
    ["wrangler", "d1", "execute", DATABASE, target, `--file=${sqlPath}`, "--yes"],
    { cwd: REPO_ROOT, stdio: "inherit" },
  );
  if (result.status !== 0) fail(`wrangler exited with code ${result.status}`);
  info("Imported.");
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function readCredentials() {
  let raw;
  try {
    raw = readFileSync(join(REPO_ROOT, ".dev.vars"), "utf8");
  } catch {
    fail(".dev.vars not found — copy .dev.vars-example and fill it in.");
  }

  const read = (key) => {
    const match = new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`, "m").exec(raw);
    return match ? match[1].trim().replace(/^["']|["']$/g, "") : "";
  };

  const accountId = read("CLOUDFLARE_ACCOUNT_ID");
  const token = read("CF_ANALYTICS_API_TOKEN");

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

/** Accepts both `--days=14` and `--days 14`. */
function parseArgs(argv) {
  const parsed = { days: 90, apply: false, local: false, siteTag: null, dataset: null };

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

function fail(message) {
  console.error(`\x1b[31merror:\x1b[0m ${message}`);
  process.exit(1);
}
