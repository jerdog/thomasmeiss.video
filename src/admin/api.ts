/** Typed client for `/api/admin/*`. Every call rides the Cloudflare Access session. */

export interface SeriesPoint {
  day: string;
  views: number;
  visitors: number;
  submissions: number;
}

export interface Bucket {
  key: string;
  count: number;
}

export interface Overview {
  range: { days: number; from: number; to: number };
  totals: {
    views: number;
    visitors: number;
    submissions: number;
    conversionRate: number;
    unread: number;
    allTimeSubmissions: number;
  };
  previous: { views: number; visitors: number; submissions: number };
  series: SeriesPoint[];
  breakdowns: {
    paths: Bucket[];
    referrers: Bucket[];
    countries: Bucket[];
    devices: Bucket[];
  };
}

export type SubmissionStatus = "new" | "read" | "archived";

export interface Submission {
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

export interface SubmissionsPage {
  items: Submission[];
  counts: Record<SubmissionStatus, number>;
  nextCursor: number | null;
}

/** Thrown on 401 so the UI can prompt for a fresh Access sign-in. */
export class UnauthorizedError extends Error {
  constructor() {
    super("Your session has expired.");
    this.name = "UnauthorizedError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/admin/${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (res.status === 401) throw new UnauthorizedError();

  const body = (await res.json().catch(() => null)) as
    | ({ ok: boolean; error?: string } & T)
    | null;

  if (!res.ok || !body?.ok) {
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return body;
}

export function getSession() {
  return request<{ email: string }>("session");
}

export function getOverview(days: number) {
  return request<Overview>(`overview?days=${days}`);
}

export function getSubmissions(options: {
  status?: SubmissionStatus | null;
  before?: number | null;
}) {
  const params = new URLSearchParams();
  if (options.status) params.set("status", options.status);
  if (options.before) params.set("before", String(options.before));
  const query = params.toString();
  return request<SubmissionsPage>(`submissions${query ? `?${query}` : ""}`);
}

export function setSubmissionStatus(id: number, status: SubmissionStatus) {
  return request<{ id: number; status: SubmissionStatus }>(`submissions/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function deleteSubmission(id: number) {
  return request<{ id: number }>(`submissions/${id}`, { method: "DELETE" });
}
