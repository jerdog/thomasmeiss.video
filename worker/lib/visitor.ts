/**
 * Request fingerprinting for analytics — deliberately lossy.
 *
 * No IP address, user-agent string, or cookie is ever stored. A visitor is
 * identified by a salted hash of (IP + user agent) that also mixes in the UTC
 * date, so the identifier rotates every 24h and cannot be used to follow
 * someone across days or correlated back to a person. That keeps "unique
 * visitors today" meaningful while staying cookie-free — the same reason the
 * site needs no consent banner.
 */

const BOT_RE =
  /bot|crawler|spider|crawling|slurp|facebookexternalhit|preview|headless|monitor|curl|wget|python-requests|axios|lighthouse|pingdom|semrush|ahrefs|dataprovider|feedfetcher/i;

const TABLET_RE = /ipad|tablet|playbook|silk|(android(?!.*mobile))/i;
const MOBILE_RE = /mobi|iphone|ipod|android|blackberry|iemobile|opera mini/i;

export type Device = "desktop" | "mobile" | "tablet";

export function isBot(userAgent: string): boolean {
  return !userAgent || BOT_RE.test(userAgent);
}

export function deviceFromUserAgent(userAgent: string): Device {
  if (TABLET_RE.test(userAgent)) return "tablet";
  if (MOBILE_RE.test(userAgent)) return "mobile";
  return "desktop";
}

/** `YYYY-MM-DD` in UTC — the grouping key for every daily rollup. */
export function utcDay(timestampMs: number): string {
  return new Date(timestampMs).toISOString().slice(0, 10);
}

export async function visitorHash(
  request: Request,
  env: Env,
  day: string,
): Promise<string> {
  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  const userAgent = request.headers.get("User-Agent") ?? "";
  const salt = env.ANALYTICS_SALT ?? "";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${salt}|${day}|${ip}|${userAgent}`),
  );
  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Normalize a referrer to its hostname, dropping same-site navigation (which is
 * not a traffic source) and anything unparseable.
 */
export function referrerHost(referrer: string, selfHost: string): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    if (!host || host === selfHost.replace(/^www\./, "")) return null;
    return host.slice(0, 128);
  } catch {
    return null;
  }
}

/** Keep paths bounded and query-free so the top-pages list stays readable. */
export function normalizePath(rawPath: string): string {
  let path = rawPath.trim();
  if (!path.startsWith("/")) path = `/${path}`;
  path = path.split(/[?#]/)[0];
  if (path.length > 1) path = path.replace(/\/+$/, "") || "/";
  return path.slice(0, 256);
}
