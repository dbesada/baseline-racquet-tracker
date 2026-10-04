import { createPublicKey, verify as verifySignature } from "node:crypto";

// Access control for the Baseline relay.
//
// The relay decides whether a request is "admin" (may change settings and start
// price checks) or "public preview" (read-only). Two rules keep that decision
// from being forgeable by a visitor:
//
//  1. Anything that arrives through Cloudflare (it carries at least one cf-*
//     header that Cloudflare adds and a client cannot remove) is admin only if
//     its Cloudflare Access token is cryptographically valid for this team and
//     application. The mere presence of a header proves nothing.
//  2. Tailscale Serve (tailnet only) adds a Tailscale-User-Login header and
//     removes any copy a client sends; Funnel (public) traffic never carries
//     it. A request with that header is admin only if it came from Tailscale
//     on this machine (loopback peer) and the login is on the configured
//     allowlist.
//  3. Direct LAN admin is allowed only when the request carries no proxy or
//     forwarding headers, its Host header is a known LAN host, and the socket
//     peer is a private or loopback address. X-Forwarded-Host is never trusted.
//
// Anything that cannot be proven admin is public. Errors also mean public.

const TEAM_DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.cloudflareaccess\.com$/i;
const CLOCK_LEEWAY_SECONDS = 60;

export const DEFAULT_LAN_HOSTS = ["192.168.50.230", "localhost", "127.0.0.1"];
export const DEFAULT_PUBLIC_HOSTS = ["baseline-beta.besada.net"];

function base64UrlToBuffer(value) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function parseJsonPart(value) {
  try {
    const parsed = JSON.parse(base64UrlToBuffer(value).toString("utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Creates a verifier for Cloudflare Access application tokens
 * (the Cf-Access-Jwt-Assertion header). Returns null when the configuration is
 * missing or invalid, so callers treat every Cloudflare request as public.
 */
export function createAccessVerifier({
  teamDomain,
  audience,
  fetchJwks = defaultFetchJwks,
  now = () => Date.now(),
  keyCacheMs = 10 * 60 * 1000,
  keyRefreshMinIntervalMs = 60 * 1000,
} = {}) {
  const domain = String(teamDomain ?? "").trim().toLowerCase();
  const aud = String(audience ?? "").trim();
  if (!TEAM_DOMAIN_PATTERN.test(domain) || !aud) return null;

  const issuer = `https://${domain}`;
  let keysByKid = new Map();
  let keysFetchedAt = 0;
  let lastRefreshAttempt = 0;

  async function refreshKeys() {
    lastRefreshAttempt = now();
    const document = await fetchJwks(`${issuer}/cdn-cgi/access/certs`);
    const next = new Map();
    for (const jwk of Array.isArray(document?.keys) ? document.keys : []) {
      if (jwk?.kty !== "RSA" || typeof jwk.kid !== "string") continue;
      try {
        next.set(jwk.kid, createPublicKey({ key: jwk, format: "jwk" }));
      } catch {
        // Ignore a key we cannot parse; the others may still be valid.
      }
    }
    if (next.size > 0) {
      keysByKid = next;
      keysFetchedAt = now();
    }
  }

  async function keyFor(kid) {
    const stale = now() - keysFetchedAt > keyCacheMs;
    const canRefresh = now() - lastRefreshAttempt >= keyRefreshMinIntervalMs;
    if ((stale || !keysByKid.has(kid)) && canRefresh) {
      try { await refreshKeys(); } catch { /* Keep whatever keys are cached. */ }
    }
    return keysByKid.get(kid) ?? null;
  }

  return {
    issuer,
    audience: aud,
    /** Returns the token claims when valid, otherwise null. Never throws. */
    async verify(token) {
      try {
        if (typeof token !== "string" || token.length > 8192) return null;
        const parts = token.split(".");
        if (parts.length !== 3 || parts.some((part) => !part)) return null;
        const header = parseJsonPart(parts[0]);
        const claims = parseJsonPart(parts[1]);
        if (!header || !claims) return null;
        if (header.alg !== "RS256" || typeof header.kid !== "string") return null;

        const key = await keyFor(header.kid);
        if (!key) return null;
        const signatureOk = verifySignature(
          "RSA-SHA256",
          Buffer.from(`${parts[0]}.${parts[1]}`),
          key,
          base64UrlToBuffer(parts[2]),
        );
        if (!signatureOk) return null;

        if (claims.iss !== issuer) return null;
        const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
        if (!audiences.includes(aud)) return null;

        const nowSeconds = Math.floor(now() / 1000);
        if (typeof claims.exp !== "number" || claims.exp + CLOCK_LEEWAY_SECONDS < nowSeconds) return null;
        if (typeof claims.nbf === "number" && claims.nbf - CLOCK_LEEWAY_SECONDS > nowSeconds) return null;
        return claims;
      } catch {
        return null;
      }
    },
  };
}

async function defaultFetchJwks(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`JWKS request failed: ${response.status}`);
  return response.json();
}

function normalizeHost(value) {
  return String(value ?? "").split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}

export function isLoopbackAddress(address) {
  const value = String(address ?? "").trim().toLowerCase().replace(/^::ffff:/, "");
  return value === "::1" || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value);
}

/** Parses a comma-separated allowlist of Tailscale logins (case-insensitive). */
export function parseLoginList(value) {
  return String(value ?? "").split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean);
}

export function isPrivateOrLoopbackAddress(address) {
  const value = String(address ?? "").trim().toLowerCase().replace(/^::ffff:/, "");
  if (value === "::1") return true;
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(value);
  if (!match) return false;
  const [a, b] = match.slice(1).map(Number);
  if (match.slice(1).some((part) => Number(part) > 255)) return false;
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

function hasHeaderMatching(headers, predicate) {
  return Object.keys(headers).some((name) => predicate(name.toLowerCase()));
}

/**
 * Returns true only when the request is provably an admin request.
 * `headers` is Node's lowercased req.headers; `remoteAddress` is req.socket.remoteAddress.
 */
export async function isAdminRequest({
  headers,
  remoteAddress,
  verifier = null,
  lanHosts = DEFAULT_LAN_HOSTS,
  publicHosts = DEFAULT_PUBLIC_HOSTS,
  tailscaleAdmins = [],
}) {
  try {
    if (headers["x-baseline-public-preview"] === "true") return false;

    // Either host header naming a public hostname makes the request public.
    for (const value of [headers.host, headers["x-forwarded-host"]]) {
      if (publicHosts.includes(normalizeHost(value))) return false;
    }

    const viaCloudflare = hasHeaderMatching(headers, (name) => name.startsWith("cf-"));
    if (viaCloudflare) {
      // Requires a valid Cloudflare Access token. Without configuration, or
      // without a token, Cloudflare traffic is public.
      const token = headers["cf-access-jwt-assertion"];
      if (!verifier || typeof token !== "string") return false;
      return Boolean(await verifier.verify(token));
    }

    // Through Tailscale Serve: trust the identity header only from the local
    // Tailscale proxy, and only for allowlisted logins.
    const tailscaleLogin = headers["tailscale-user-login"];
    if (typeof tailscaleLogin === "string" && tailscaleLogin.trim()) {
      if (!isLoopbackAddress(remoteAddress)) return false;
      return tailscaleAdmins.includes(tailscaleLogin.trim().toLowerCase());
    }

    // Not through Cloudflare or Tailscale Serve: allow only a direct LAN request. Any sign of a
    // proxy in front (Tailscale, another reverse proxy) means we cannot trust
    // the Host header, so the request is public.
    const proxied = hasHeaderMatching(
      headers,
      (name) => name.startsWith("x-forwarded-") || name === "forwarded" || name === "x-real-ip" || name.startsWith("tailscale-"),
    );
    if (proxied) return false;
    if (!lanHosts.includes(normalizeHost(headers.host))) return false;
    return isPrivateOrLoopbackAddress(remoteAddress);
  } catch {
    return false;
  }
}
