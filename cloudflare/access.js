// Cloudflare Access check for the admin hostname, with the browser's Web
// Crypto (no Node). A request is admin only when its Cf-Access-Jwt-Assertion
// token is signed by this team's Access keys, is for this application (aud),
// and has not expired. Anything else is the public site.

const leewaySeconds = 60;
let cachedKeys = null;
let cachedAt = 0;

function base64UrlBytes(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function jsonPart(value) {
  try { return JSON.parse(new TextDecoder().decode(base64UrlBytes(value))); } catch { return null; }
}

async function accessKeys(teamDomain, fetcher) {
  if (cachedKeys && Date.now() - cachedAt < 10 * 60 * 1000) return cachedKeys;
  const response = await fetcher(`https://${teamDomain}/cdn-cgi/access/certs`);
  const { keys = [] } = await response.json();
  const imported = new Map();
  for (const jwk of keys) {
    if (jwk?.kty !== "RSA" || typeof jwk.kid !== "string") continue;
    try {
      imported.set(jwk.kid, await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]));
    } catch { /* skip a key we cannot read */ }
  }
  if (imported.size) { cachedKeys = imported; cachedAt = Date.now(); }
  return imported;
}

export async function isAccessAdmin(request, { teamDomain, audience, fetcher = fetch, now = Date.now() } = {}) {
  if (!teamDomain || !audience) return false;
  const token = request.headers.get("cf-access-jwt-assertion");
  const parts = token?.split(".");
  if (parts?.length !== 3) return false;
  const header = jsonPart(parts[0]);
  const claims = jsonPart(parts[1]);
  if (header?.alg !== "RS256" || typeof header.kid !== "string" || !claims) return false;
  const nowSeconds = Math.floor(now / 1000);
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(audience) || claims.iss !== `https://${teamDomain}`) return false;
  if (typeof claims.exp !== "number" || claims.exp + leewaySeconds < nowSeconds) return false;
  if (typeof claims.nbf === "number" && claims.nbf - leewaySeconds > nowSeconds) return false;
  try {
    const key = (await accessKeys(teamDomain, fetcher)).get(header.kid);
    if (!key) return false;
    return await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, base64UrlBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  } catch {
    return false;
  }
}
