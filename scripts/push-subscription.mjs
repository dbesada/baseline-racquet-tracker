// Checks a browser push subscription before it is stored. Shared by the NAS
// relay (scripts/price-alerts.mjs) and the Cloudflare Worker.

// Only the browser makers' push services are accepted, so the relay never
// sends requests to an address a visitor made up.
const pushHosts = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];
const base64Url = /^[A-Za-z0-9_-]+={0,2}$/;

export function validSubscription(value) {
  if (!value || typeof value !== "object") return null;
  let url;
  try { url = new URL(value.endpoint); } catch { return null; }
  if (url.protocol !== "https:" || value.endpoint.length > 1000 || !pushHosts.some((host) => host.test(url.hostname))) return null;
  const p256dh = value.keys?.p256dh;
  const auth = value.keys?.auth;
  if (typeof p256dh !== "string" || typeof auth !== "string" || !base64Url.test(p256dh) || !base64Url.test(auth) || p256dh.length > 200 || auth.length > 60) return null;
  return { endpoint: value.endpoint, keys: { p256dh, auth } };
}
