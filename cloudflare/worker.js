// Baseline on Cloudflare: the static site (dist/client) plus the few dynamic
// routes the NAS relay used to serve. Every route here stays well inside the
// free plan: no request parses the large dashboard, it is streamed from KV.
//
//   GET  /api/tracker      the public dashboard, written by the GitHub price check
//   *    /api/tracker      read-only here (settings are changed by the owner)
//   GET  /api/analytics    records one aggregate event (?event=…&detail=…)
//   GET  /go/<offer id>    redirects to the stored retailer URL and logs the click
//   /api/push/*            price-alert sign-ups (sent by the GitHub price check)
//
// Bindings (cloudflare/wrangler.jsonc): ASSETS, DATA (KV), DB (D1), PUSH_PUBLIC_KEY.

import { acceptEvent } from "../scripts/analytics.mjs";
import { looksAutomated, notFoundPage, offerIdFromPath } from "../scripts/outbound-rules.mjs";
import { validSubscription } from "../scripts/push-subscription.mjs";

const json = (status, payload) => new Response(JSON.stringify(payload), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

async function subscriptionId(endpoint) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

async function readSmallJson(request, limit = 8192) {
  const text = await request.text();
  if (text.length > limit) return null;
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

async function handleTracker(request, env) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json(403, { error: "This action is available in the protected Baseline admin app." });
  }
  const dashboard = await env.DATA.get("dashboard.json", { type: "stream" });
  if (!dashboard) return json(503, { error: "Prices are not available yet." });
  return new Response(dashboard, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

async function handleAnalytics(request, env) {
  const url = new URL(request.url);
  const accepted = acceptEvent(url.searchParams.get("event") ?? "", url.searchParams.get("detail") ?? "");
  if (accepted) {
    const day = new Date().toISOString().slice(0, 10);
    const statements = [env.DB.prepare("INSERT INTO analytics (day, event, detail, count) VALUES (?1, ?2, '', 1) ON CONFLICT (day, event, detail) DO UPDATE SET count = count + 1").bind(day, accepted.event)];
    if (accepted.detail) {
      // At most 40 different details per event per day; the rest count as "other".
      const known = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM analytics WHERE day = ?1 AND event = ?2 AND detail <> '') AS distinctCount, (SELECT COUNT(*) FROM analytics WHERE day = ?1 AND event = ?2 AND detail = ?3) AS exists_").bind(day, accepted.event, accepted.detail).first();
      const detail = known?.exists_ || (known?.distinctCount ?? 0) < 40 ? accepted.detail : "other";
      statements.push(env.DB.prepare("INSERT INTO analytics (day, event, detail, count) VALUES (?1, ?2, ?3, 1) ON CONFLICT (day, event, detail) DO UPDATE SET count = count + 1").bind(day, accepted.event, detail));
    }
    await env.DB.batch(statements);
  }
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}

async function handleOutbound(request, env, ctx) {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });
  const url = new URL(request.url);
  const offerId = offerIdFromPath(url.pathname + url.search);
  // The URL stored by the price check is the only place a visitor can be sent.
  const offer = offerId ? await env.DB.prepare("SELECT url, store, network, kind, model FROM offers WHERE id = ?1").bind(offerId).first() : null;
  if (!offer) {
    return new Response(request.method === "HEAD" ? null : notFoundPage, { status: 404, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
  }
  if (request.method === "GET" && !looksAutomated(request.headers.get("user-agent"))) {
    ctx.waitUntil(env.DB.prepare("INSERT INTO clicks (ts, offer_id, retailer, market, network, kind, model) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)")
      .bind(new Date().toISOString(), offerId, offer.store ?? "Unknown", env.MARKET ?? "CA", offer.network ?? null, offer.kind ?? null, offer.model ?? null).run());
  }
  return new Response(null, { status: 302, headers: { location: offer.url, "cache-control": "no-store", "referrer-policy": "no-referrer" } });
}

async function handlePush(request, env) {
  const path = new URL(request.url).pathname;
  if (path === "/api/push/key" && request.method === "GET") return json(200, { publicKey: env.PUSH_PUBLIC_KEY });
  if (request.method !== "POST" || !["/api/push/alerts", "/api/push/alert", "/api/push/remove"].includes(path)) return json(404, { error: "Not found" });
  const body = await readSmallJson(request);
  const subscription = validSubscription(body?.subscription);
  if (!subscription) return json(path === "/api/push/alerts" ? 200 : 400, path === "/api/push/alerts" ? { alerts: {} } : { error: "This browser's notification address was not accepted." });
  const id = await subscriptionId(subscription.endpoint);
  const row = await env.DB.prepare("SELECT data FROM push_subscriptions WHERE id = ?1").bind(id).first();
  const entry = row ? JSON.parse(row.data) : { subscription, createdAt: new Date().toISOString(), alerts: {} };
  const summary = () => Object.fromEntries(Object.entries(entry.alerts).map(([key, alert]) => [key, alert.mode === "target" ? { mode: "target", target: alert.target } : { mode: "drop" }]));
  if (path === "/api/push/alerts") return json(200, { alerts: row ? summary() : {} });

  const modelKey = typeof body.modelKey === "string" && /^[a-z0-9-]{1,80}$/.test(body.modelKey) ? body.modelKey : null;
  if (path === "/api/push/remove") {
    if (!row) return json(200, { ok: true, alerts: {} });
    if (modelKey) delete entry.alerts[modelKey];
    if (!modelKey || !Object.keys(entry.alerts).length) {
      await env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?1").bind(id).run();
      return json(200, { ok: true, alerts: {} });
    }
    await env.DB.prepare("UPDATE push_subscriptions SET data = ?2, updated_at = ?3 WHERE id = ?1").bind(id, JSON.stringify(entry), Date.now()).run();
    return json(200, { ok: true, alerts: summary() });
  }

  const known = modelKey ? await env.DB.prepare("SELECT price FROM model_prices WHERE model_key = ?1").bind(modelKey).first() : null;
  if (!modelKey || known === null) return json(400, { error: "That racquet is not tracked." });
  const mode = body.mode;
  const target = Number(body.target);
  if (mode !== "target" && mode !== "drop") return json(400, { error: "Choose target price or any drop." });
  if (mode === "target" && !(Number.isFinite(target) && target > 0 && target < 10000)) return json(400, { error: "Enter a target price." });
  if (!entry.alerts[modelKey] && Object.keys(entry.alerts).length >= 20) return json(400, { error: "You can follow up to 20 racquets." });
  if (!row) {
    const total = await env.DB.prepare("SELECT COUNT(*) AS n FROM push_subscriptions").first();
    if ((total?.n ?? 0) >= 5000) return json(400, { error: "Alerts are full right now. Please try again later." });
  }
  const currentPrice = Number.isFinite(known.price) ? known.price : null;
  entry.subscription = subscription;
  entry.alerts[modelKey] = {
    mode,
    ...(mode === "target" ? { target: Math.round(target * 100) / 100 } : {}),
    lastPrice: currentPrice,
    met: mode === "target" && currentPrice !== null && currentPrice <= target,
    setAt: new Date().toISOString(),
  };
  await env.DB.prepare("INSERT INTO push_subscriptions (id, data, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT (id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at")
    .bind(id, JSON.stringify(entry), Date.now()).run();
  return json(200, { ok: true, alerts: summary() });
}

const worker = {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    try {
      if (pathname === "/api/tracker") return await handleTracker(request, env);
      if (pathname === "/api/analytics") return await handleAnalytics(request, env);
      if (pathname.startsWith("/go/")) return await handleOutbound(request, env, ctx);
      if (pathname.startsWith("/api/push/")) return await handlePush(request, env);
      if (pathname.startsWith("/api/")) return json(404, { error: "Not found" });
    } catch (error) {
      console.error(error);
      return json(500, { error: "Something went wrong. Please try again." });
    }
    return env.ASSETS.fetch(request);
  },
};

export default worker;
