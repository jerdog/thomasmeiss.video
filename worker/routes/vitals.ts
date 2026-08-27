import { insertWebVitals } from "../lib/db";
import { isSameOrigin, json } from "../lib/http";
import { deviceFromUserAgent, isBot, normalizePath, utcDay } from "../lib/visitor";

interface VitalsPayload {
  path?: string;
  lcp?: unknown;
  inp?: unknown;
  cls?: unknown;
  ttfb?: unknown;
  fcp?: unknown;
}

// Anything past these is a broken measurement, not a slow page — a tab left in
// the background for an hour can report absurd timings.
const MAX_MS = 120_000;
const MAX_CLS = 100;

/**
 * `POST /api/vitals` — Core Web Vitals for one page visit.
 *
 * Sent once, as the page is hidden, with whatever the browser has measured by
 * then. Like the pageview beacon it always answers 204 and never blocks.
 */
export async function handleVitals(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  if (!isSameOrigin(request)) return noContent();

  const userAgent = request.headers.get("User-Agent") ?? "";
  if (isBot(userAgent)) return noContent();

  let body: VitalsPayload;
  try {
    body = (await request.json()) as VitalsPayload;
  } catch {
    return noContent();
  }

  const path = normalizePath(body.path ?? "/");
  if (path === "/admin" || path.startsWith("/admin/")) return noContent();

  const row = {
    lcp: metric(body.lcp, MAX_MS),
    inp: metric(body.inp, MAX_MS),
    cls: metric(body.cls, MAX_CLS),
    ttfb: metric(body.ttfb, MAX_MS),
    fcp: metric(body.fcp, MAX_MS),
  };

  // A row where every metric is missing carries no information.
  if (Object.values(row).every((value) => value === null)) return noContent();

  const now = Date.now();
  ctx.waitUntil(
    insertWebVitals(env.DB, {
      ts: Math.floor(now / 1000),
      day: utcDay(now),
      path,
      device: deviceFromUserAgent(userAgent),
      ...row,
    }).catch((err) => console.error("Web vitals insert failed:", err)),
  );

  return noContent();
}

function metric(value: unknown, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0 || value > max) return null;
  return Math.round(value * 1000) / 1000;
}

function noContent(): Response {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
