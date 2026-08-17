import { insertPageView } from "../lib/db";
import { isSameOrigin, json } from "../lib/http";
import {
  deviceFromUserAgent,
  isBot,
  normalizePath,
  referrerHost,
  utcDay,
  visitorHash,
} from "../lib/visitor";

interface CollectPayload {
  path?: string;
  referrer?: string;
}

/**
 * `POST /api/collect` — the first-party pageview beacon.
 *
 * Always answers 204 so a tracking failure never surfaces as a console error on
 * the public site, and never blocks the page: the browser sends this with
 * `sendBeacon`/`keepalive` and ignores the response.
 */
export async function handleCollect(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  // Only the site's own pages may write analytics rows.
  if (!isSameOrigin(request)) return noContent();

  const userAgent = request.headers.get("User-Agent") ?? "";
  if (isBot(userAgent)) return noContent();

  let body: CollectPayload;
  try {
    body = (await request.json()) as CollectPayload;
  } catch {
    return noContent();
  }

  const path = normalizePath(body.path ?? "/");
  // The dashboard is not part of the site's traffic.
  if (path === "/admin" || path.startsWith("/admin/")) return noContent();

  const now = Date.now();
  const day = utcDay(now);
  const url = new URL(request.url);

  ctx.waitUntil(
    (async () => {
      try {
        await insertPageView(env.DB, {
          ts: Math.floor(now / 1000),
          day,
          path,
          referrer_host: referrerHost(body.referrer ?? "", url.hostname),
          country: request.headers.get("CF-IPCountry"),
          device: deviceFromUserAgent(userAgent),
          visitor_hash: await visitorHash(request, env, day),
        });
      } catch (err) {
        console.error("Pageview insert failed:", err);
      }
    })(),
  );

  return noContent();
}

function noContent(): Response {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
