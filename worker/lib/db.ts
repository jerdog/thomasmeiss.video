/**
 * D1 access layer for the admin dashboard.
 *
 * Three tables, all written by the public site and read only by `/api/admin/*`:
 *   page_views          one row per pageview beacon
 *   web_vitals          one row per visit, written as the page is hidden
 *   contact_submissions one row per contact-form post
 *
 * Schema lives in `migrations/` and is applied with `wrangler d1 migrations apply`.
 */

export const DEFAULT_RETENTION_DAYS = 400;

export type SubmissionStatus = "new" | "read" | "archived";

export const SUBMISSION_STATUSES: readonly SubmissionStatus[] = [
  "new",
  "read",
  "archived",
];

export interface PageViewRow {
  ts: number;
  day: string;
  path: string;
  referrer_host: string | null;
  country: string | null;
  device: string;
  visitor_hash: string;
}

export interface SubmissionRow {
  id: number;
  ts: number;
  name: string;
  email: string;
  project_type: string;
  message: string;
  country: string | null;
  referrer: string | null;
  email_status: string;
  email_error: string | null;
  status: SubmissionStatus;
}

export function isSubmissionStatus(value: unknown): value is SubmissionStatus {
  return SUBMISSION_STATUSES.includes(value as SubmissionStatus);
}

export async function insertPageView(db: D1Database, row: PageViewRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO page_views (ts, day, path, referrer_host, country, device, visitor_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.ts,
      row.day,
      row.path,
      row.referrer_host,
      row.country,
      row.device,
      row.visitor_hash,
    )
    .run();
}

export interface WebVitalsRow {
  ts: number;
  day: string;
  path: string;
  device: string;
  lcp: number | null;
  inp: number | null;
  cls: number | null;
  ttfb: number | null;
  fcp: number | null;
}

export async function insertWebVitals(
  db: D1Database,
  row: WebVitalsRow,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO web_vitals (ts, day, path, device, lcp, inp, cls, ttfb, fcp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.ts,
      row.day,
      row.path,
      row.device,
      row.lcp,
      row.inp,
      row.cls,
      row.ttfb,
      row.fcp,
    )
    .run();
}

export async function insertSubmission(
  db: D1Database,
  row: Omit<SubmissionRow, "id" | "status">,
): Promise<number | null> {
  const result = await db
    .prepare(
      `INSERT INTO contact_submissions
         (ts, name, email, project_type, message, country, referrer, email_status, email_error, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
       RETURNING id`,
    )
    .bind(
      row.ts,
      row.name,
      row.email,
      row.project_type,
      row.message,
      row.country,
      row.referrer,
      row.email_status,
      row.email_error,
    )
    .first<{ id: number }>();
  return result?.id ?? null;
}

/**
 * Drop analytics rows past the retention window. Runs on the daily cron so the
 * tables stay inside D1's free-tier row budget without any manual maintenance.
 * Contact submissions are never auto-deleted — they are the business record.
 */
export async function pruneAnalytics(env: Env): Promise<number> {
  const days = Number(env.ANALYTICS_RETENTION_DAYS) || DEFAULT_RETENTION_DAYS;
  const cutoff = Math.floor(Date.now() / 1000) - days * 86_400;

  const results = await env.DB.batch([
    env.DB.prepare(`DELETE FROM page_views WHERE ts < ?`).bind(cutoff),
    env.DB.prepare(`DELETE FROM web_vitals WHERE ts < ?`).bind(cutoff),
  ]);

  return results.reduce((total, result) => total + (result.meta.changes ?? 0), 0);
}
