/**
 * Cloudflare Access (Zero Trust) JWT verification.
 *
 * Access sits in front of `/admin*` and `/api/admin*` at the edge and injects a
 * signed assertion on every request it lets through. The Worker does not trust
 * that header blindly: an application that is reachable by any other path (a
 * Workers preview URL, a direct route, a misconfigured Access policy) would let
 * a forged header through. So every admin request re-verifies the JWT against
 * the team's public keys and re-checks the audience.
 *
 * Fails closed: no team domain configured, no AUD, bad signature, wrong
 * audience, or an expired token all return null.
 */

export interface AccessIdentity {
  email: string;
  /** Access user id (`sub` claim) — stable per user, empty for service tokens. */
  userId: string;
}

interface AccessJwtPayload {
  aud?: string | string[];
  email?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  nbf?: number;
  sub?: string;
  common_name?: string;
}

const JWKS_TTL_MS = 60 * 60 * 1000; // Access rotates signing keys ~every 6 weeks.
const CLOCK_SKEW_S = 60;

interface CachedKeys {
  keys: Map<string, CryptoKey>;
  fetchedAt: number;
}

/** Module-scope cache — survives for the life of the isolate. */
let jwksCache: CachedKeys | null = null;
let jwksInFlight: Promise<CachedKeys> | null = null;

/**
 * Resolve the caller's Access identity, or null when the request is not
 * authenticated. `reason` on the error path is deliberately coarse — the client
 * gets "Unauthorized" and the detail goes to the Worker log.
 */
export async function authenticate(
  request: Request,
  env: Env,
): Promise<AccessIdentity | null> {
  const bypass = devBypass(env);
  if (bypass) return bypass;

  const teamDomain = normalizeTeamDomain(env.CF_ACCESS_TEAM_DOMAIN);
  const aud = env.CF_ACCESS_AUD?.trim();
  if (!teamDomain || !aud) {
    console.error(
      "Admin API is not configured: set CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD",
    );
    return null;
  }

  const token = readToken(request);
  if (!token) return null;

  let payload: AccessJwtPayload;
  try {
    payload = await verifyJwt(token, teamDomain);
  } catch (err) {
    console.warn("Access JWT rejected:", err instanceof Error ? err.message : err);
    return null;
  }

  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(aud)) {
    console.warn("Access JWT rejected: audience mismatch");
    return null;
  }

  if (payload.iss !== `https://${teamDomain}`) {
    console.warn("Access JWT rejected: issuer mismatch");
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp + CLOCK_SKEW_S < now) {
    console.warn("Access JWT rejected: expired");
    return null;
  }
  if (typeof payload.nbf === "number" && payload.nbf - CLOCK_SKEW_S > now) {
    console.warn("Access JWT rejected: not yet valid");
    return null;
  }

  const email = payload.email?.trim().toLowerCase() ?? "";
  if (!email) {
    console.warn("Access JWT rejected: no email claim (service token?)");
    return null;
  }

  if (!isAllowed(email, env.ADMIN_EMAILS)) {
    console.warn("Access JWT rejected: email not in ADMIN_EMAILS");
    return null;
  }

  return { email, userId: payload.sub ?? "" };
}

/**
 * Local-development escape hatch. Only ever set in `.dev.vars`, which is
 * gitignored and never uploaded — production has no such variable, and
 * `keep_vars: true` means a deploy cannot introduce one either.
 */
function devBypass(env: Env): AccessIdentity | null {
  const email = env.ADMIN_DEV_BYPASS_EMAIL?.trim().toLowerCase();
  if (!email) return null;
  console.warn(
    `ADMIN_DEV_BYPASS_EMAIL is set — admin API is unauthenticated as ${email}. Local dev only.`,
  );
  return { email, userId: "dev-bypass" };
}

function isAllowed(email: string, allowList: string | undefined): boolean {
  const allowed = (allowList ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  // Empty list means "whoever the Access policy admits" — the policy is the gate.
  return allowed.length === 0 || allowed.includes(email);
}

function normalizeTeamDomain(value: string | undefined): string {
  const raw = value?.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (!raw) return "";
  return raw.includes(".") ? raw : `${raw}.cloudflareaccess.com`;
}

function readToken(request: Request): string {
  const header = request.headers.get("Cf-Access-Jwt-Assertion");
  if (header) return header.trim();

  const cookie = request.headers.get("Cookie") ?? "";
  const match = /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(cookie);
  return match ? decodeURIComponent(match[1]) : "";
}

async function verifyJwt(token: string, teamDomain: string): Promise<AccessJwtPayload> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("malformed token");
  const [headerB64, payloadB64, signatureB64] = parts;

  const header = JSON.parse(decodeBase64Url(headerB64, "text")) as {
    alg?: string;
    kid?: string;
  };
  if (header.alg !== "RS256") throw new Error(`unsupported alg ${header.alg}`);
  if (!header.kid) throw new Error("missing kid");

  let key = (await getKeys(teamDomain, false)).keys.get(header.kid);
  if (!key) {
    // Unknown kid: the team may have just rotated. Refetch once before failing.
    key = (await getKeys(teamDomain, true)).keys.get(header.kid);
  }
  if (!key) throw new Error(`unknown signing key ${header.kid}`);

  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    decodeBase64Url(signatureB64, "bytes"),
    new TextEncoder().encode(`${headerB64}.${payloadB64}`),
  );
  if (!valid) throw new Error("signature verification failed");

  return JSON.parse(decodeBase64Url(payloadB64, "text")) as AccessJwtPayload;
}

async function getKeys(teamDomain: string, force: boolean): Promise<CachedKeys> {
  const fresh = jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS;
  if (!force && fresh) return jwksCache!;

  // Collapse concurrent misses onto one fetch.
  if (!jwksInFlight) {
    jwksInFlight = fetchKeys(teamDomain)
      .then((cached) => {
        jwksCache = cached;
        return cached;
      })
      .finally(() => {
        jwksInFlight = null;
      });
  }

  try {
    return await jwksInFlight;
  } catch (err) {
    // Serve a stale key set rather than locking the dashboard out on a blip.
    if (jwksCache) return jwksCache;
    throw err;
  }
}

async function fetchKeys(teamDomain: string): Promise<CachedKeys> {
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`, {
    cf: { cacheTtl: 3600, cacheEverything: true },
  });
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);

  const body = (await res.json()) as { keys?: JsonWebKey[] };
  const keys = new Map<string, CryptoKey>();

  for (const jwk of body.keys ?? []) {
    const kid = (jwk as JsonWebKey & { kid?: string }).kid;
    if (!kid) continue;
    keys.set(
      kid,
      await crypto.subtle.importKey(
        "jwk",
        { ...jwk, alg: "RS256", ext: true, key_ops: ["verify"] },
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"],
      ),
    );
  }

  if (keys.size === 0) throw new Error("JWKS contained no usable keys");
  return { keys, fetchedAt: Date.now() };
}

function decodeBase64Url(value: string, as: "text"): string;
function decodeBase64Url(value: string, as: "bytes"): Uint8Array;
function decodeBase64Url(value: string, as: "text" | "bytes"): string | Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return as === "text" ? new TextDecoder().decode(bytes) : bytes;
}
