/** Shared response helpers for the Worker API routes. */

export function json(
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

/**
 * Same-origin check used to gate anything with side effects.
 *
 * The Cloudflare Access session rides in a cookie, so a cross-site form post
 * would otherwise carry credentials. Browsers always send `Origin` on
 * cross-origin requests (and on same-origin non-GET), so a mismatch is a
 * reliable reject. A missing `Origin` means a non-browser client — allowed,
 * because those cannot be tricked into replaying a user's cookie.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
