import { authenticate } from "../lib/access";
import { isSubmissionStatus, type SubmissionRow } from "../lib/db";
import { isSameOrigin, json } from "../lib/http";
import { utcDay } from "../lib/visitor";

const ALLOWED_RANGES = [7, 30, 90, 365] as const;
const DEFAULT_RANGE = 30;
const BREAKDOWN_LIMIT = 8; // Deeper tails are noise on a portfolio site.
const SUBMISSIONS_PAGE = 25;

interface Bucket {
  key: string;
  count: number;
}

/** Router for `/api/admin/*`. Every path below is authenticated. */
export async function handleAdmin(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  const identity = await authenticate(request, env);
  if (!identity) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  // Access rides in a cookie, so mutations must be same-origin.
  if (request.method !== "GET" && !isSameOrigin(request)) {
    return json({ ok: false, error: "Cross-origin request rejected" }, 403);
  }

  const route = url.pathname.replace(/^\/api\/admin\/?/, "");

  if (route === "session") {
    if (request.method !== "GET") return methodNotAllowed("GET");
    return json({ ok: true, email: identity.email });
  }

  if (route === "overview") {
    if (request.method !== "GET") return methodNotAllowed("GET");
    return getOverview(env, url);
  }

  if (route === "submissions") {
    if (request.method !== "GET") return methodNotAllowed("GET");
    return listSubmissions(env, url);
  }

  const submissionMatch = /^submissions\/(\d+)$/.exec(route);
  if (submissionMatch) {
    const id = Number(submissionMatch[1]);
    if (request.method === "PATCH") return updateSubmission(request, env, id);
    if (request.method === "DELETE") return deleteSubmission(env, id);
    return methodNotAllowed("PATCH, DELETE");
  }

  return json({ ok: false, error: "Not found" }, 404);
}

function methodNotAllowed(allow: string): Response {
  return json({ ok: false, error: "Method not allowed" }, 405, { Allow: allow });
}

async function getOverview(env: Env, url: URL): Promise<Response> {
  const days = parseRange(url.searchParams.get("days"));
  const now = Date.now();
  const from = Math.floor(now / 1000) - days * 86_400;
  // Same-length window immediately before `from`, for the period-over-period delta.
  const prevFrom = from - days * 86_400;

  const [
    totals,
    prevTotals,
    viewSeries,
    submissionSeries,
    submissionTotals,
    paths,
    referrers,
    countries,
    devices,
  ] = await env.DB.batch<Record<string, string | number | null>>([
    env.DB.prepare(
      `SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors
         FROM page_views WHERE ts >= ?`,
    ).bind(from),
    env.DB.prepare(
      `SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors
         FROM page_views WHERE ts >= ? AND ts < ?`,
    ).bind(prevFrom, from),
    env.DB.prepare(
      `SELECT day, COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors
         FROM page_views WHERE ts >= ? GROUP BY day ORDER BY day`,
    ).bind(from),
    env.DB.prepare(
      `SELECT date(ts, 'unixepoch') AS day, COUNT(*) AS submissions
         FROM contact_submissions WHERE ts >= ? GROUP BY day ORDER BY day`,
    ).bind(from),
    env.DB.prepare(
      `SELECT
         SUM(CASE WHEN ts >= ?1 THEN 1 ELSE 0 END) AS current,
         SUM(CASE WHEN ts >= ?2 AND ts < ?1 THEN 1 ELSE 0 END) AS previous,
         SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS unread,
         COUNT(*) AS total
       FROM contact_submissions`,
    ).bind(from, prevFrom),
    breakdown(env, "path", from),
    breakdown(env, "referrer_host", from),
    breakdown(env, "country", from),
    breakdown(env, "device", from),
  ]);

  const views = num(totals.results[0]?.views);
  const visitors = num(totals.results[0]?.visitors);
  const submissions = num(submissionTotals.results[0]?.current);

  return json({
    ok: true,
    range: { days, from, to: Math.floor(now / 1000) },
    totals: {
      views,
      visitors,
      submissions,
      // Submissions per 100 visitors — the number the dashboard actually leads on.
      conversionRate: visitors > 0 ? (submissions / visitors) * 100 : 0,
      unread: num(submissionTotals.results[0]?.unread),
      allTimeSubmissions: num(submissionTotals.results[0]?.total),
    },
    previous: {
      views: num(prevTotals.results[0]?.views),
      visitors: num(prevTotals.results[0]?.visitors),
      submissions: num(submissionTotals.results[0]?.previous),
    },
    series: buildSeries(days, now, viewSeries.results, submissionSeries.results),
    breakdowns: {
      paths: toBuckets(paths.results, "path"),
      referrers: toBuckets(referrers.results, "referrer_host", "Direct / none"),
      countries: toBuckets(countries.results, "country", "Unknown"),
      devices: toBuckets(devices.results, "device", "Unknown"),
    },
  });
}

/**
 * Top-N counts for one dimension. The column name is not user input — it comes
 * from the fixed list of call sites above — so interpolating it is safe.
 */
function breakdown(env: Env, column: string, from: number): D1PreparedStatement {
  return env.DB.prepare(
    `SELECT ${column} AS key, COUNT(*) AS count
       FROM page_views WHERE ts >= ?
      GROUP BY ${column} ORDER BY count DESC LIMIT ${BREAKDOWN_LIMIT}`,
  ).bind(from);
}

function toBuckets(
  rows: Record<string, string | number | null>[],
  column: string,
  emptyLabel = "Unknown",
): Bucket[] {
  return rows.map((row) => ({
    key: String(row[column] ?? row.key ?? "") || emptyLabel,
    count: num(row.count),
  }));
}

/**
 * Zero-fill the daily series so the chart has one point per day in the range —
 * a gap in the data must read as a trough, not as a straight line across it.
 */
function buildSeries(
  days: number,
  nowMs: number,
  viewRows: Record<string, string | number | null>[],
  submissionRows: Record<string, string | number | null>[],
): { day: string; views: number; visitors: number; submissions: number }[] {
  const viewsByDay = new Map(viewRows.map((row) => [String(row.day), row]));
  const submissionsByDay = new Map(
    submissionRows.map((row) => [String(row.day), num(row.submissions)]),
  );

  const series = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    const day = utcDay(nowMs - offset * 86_400_000);
    const row = viewsByDay.get(day);
    series.push({
      day,
      views: num(row?.views),
      visitors: num(row?.visitors),
      submissions: submissionsByDay.get(day) ?? 0,
    });
  }
  return series;
}

async function listSubmissions(env: Env, url: URL): Promise<Response> {
  const statusParam = url.searchParams.get("status");
  const status = isSubmissionStatus(statusParam) ? statusParam : null;
  const before = Number(url.searchParams.get("before")) || null;

  const filters: string[] = [];
  const binds: (string | number)[] = [];
  if (status) {
    filters.push("status = ?");
    binds.push(status);
  }
  if (before) {
    filters.push("id < ?");
    binds.push(before);
  }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const [page, counts] = await env.DB.batch([
    env.DB.prepare(
      `SELECT id, ts, name, email, project_type, message, country, referrer,
              email_status, email_error, status
         FROM contact_submissions ${where}
        ORDER BY id DESC LIMIT ${SUBMISSIONS_PAGE + 1}`,
    ).bind(...binds),
    env.DB.prepare(
      `SELECT status, COUNT(*) AS count FROM contact_submissions GROUP BY status`,
    ),
  ]);

  const rows = page.results as unknown as SubmissionRow[];
  const hasMore = rows.length > SUBMISSIONS_PAGE;
  const items = hasMore ? rows.slice(0, SUBMISSIONS_PAGE) : rows;

  const byStatus: Record<string, number> = { new: 0, read: 0, archived: 0 };
  for (const row of counts.results as unknown as { status: string; count: number }[]) {
    byStatus[row.status] = Number(row.count);
  }

  return json({
    ok: true,
    items,
    counts: byStatus,
    nextCursor: hasMore ? items[items.length - 1]?.id : null,
  });
}

async function updateSubmission(
  request: Request,
  env: Env,
  id: number,
): Promise<Response> {
  let body: { status?: unknown };
  try {
    body = (await request.json()) as { status?: unknown };
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  if (!isSubmissionStatus(body.status)) {
    return json({ ok: false, error: "Unknown status" }, 400);
  }

  const result = await env.DB.prepare(
    `UPDATE contact_submissions SET status = ? WHERE id = ?`,
  )
    .bind(body.status, id)
    .run();

  if (!result.meta.changes) return json({ ok: false, error: "Not found" }, 404);
  return json({ ok: true, id, status: body.status });
}

async function deleteSubmission(env: Env, id: number): Promise<Response> {
  const result = await env.DB.prepare(`DELETE FROM contact_submissions WHERE id = ?`)
    .bind(id)
    .run();

  if (!result.meta.changes) return json({ ok: false, error: "Not found" }, 404);
  return json({ ok: true, id });
}

function parseRange(value: string | null): number {
  const days = Number(value);
  return (ALLOWED_RANGES as readonly number[]).includes(days) ? days : DEFAULT_RANGE;
}

function num(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0) || 0;
}
