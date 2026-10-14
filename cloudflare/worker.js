// Baseline on Cloudflare: the static site (dist/client) plus the few dynamic
// routes the NAS relay used to serve. Every route here stays well inside the
// free plan: no request parses the large dashboard, it is streamed from KV.
//
//   GET  /api/tracker      the public dashboard, written by the GitHub price check
//   *    /api/tracker      read-only here (settings are changed by the owner)
//   GET  /api/analytics    records one aggregate event (?event=…&detail=…)
//   GET  /go/<offer id>    redirects to the stored retailer URL and logs the click
//   /api/push/*            price-alert sign-ups (sent by the GitHub price check)
//   GET  /api/history?model=<key>  a racquet's daily lowest prices (D1)
//   GET  /tennis-racquets/, /tennis-racquets/<slug>, /sitemap.xml  pages for search engines,
//                          built by the GitHub price check
//
// On the admin hostname (ADMIN_HOST, behind Cloudflare Access) a request with
// a valid Access token is admin: it gets the admin dashboard, may change the
// saved settings (KV "settings.json"), start a price check, and read the
// Analytics report. Changes are published by the GitHub workflow, which this
// Worker starts with GITHUB_DISPATCH_TOKEN (Actions: read and write, this
// repository only).
//
// Bindings (cloudflare/wrangler.jsonc): ASSETS, DATA (KV), DB (D1), PUSH_PUBLIC_KEY.

import { acceptEvent, reportDays, summarizeAnalytics } from "../scripts/analytics.mjs";
import { weeklyRetailerClicks } from "../scripts/click-report.mjs";
import { applySettingsChange } from "../scripts/settings-change.mjs";
import { isAccessAdmin } from "./access.js";
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

// Starts the GitHub workflow: "publish" rebuilds the dashboard from the last
// price check with the current settings; "prices" runs a new price check.
// Returns { ok } or { ok: false, reason } with GitHub's own explanation, which
// the admin site shows (never the token).
async function startWorkflow(env, job, extraInputs = {}) {
  const token = String(env.GITHUB_DISPATCH_TOKEN ?? "").trim();
  if (!token) return { ok: false, reason: "the site has no GitHub token (repository secret BASELINE_DISPATCH_TOKEN)" };
  let response;
  try {
    response = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/cloudflare.yml/dispatches`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "baseline-worker", "content-type": "application/json" },
      body: JSON.stringify({ ref: "main", inputs: { job, ...extraInputs } }),
    });
  } catch (error) {
    const reason = `GitHub could not be reached (${error?.message ?? "network error"})`;
    console.error(`Workflow "${job}" not started: ${reason}`);
    return { ok: false, reason };
  }
  if (response.status === 204) return { ok: true };
  const text = await response.text().catch(() => "");
  let detail = text;
  try { detail = JSON.parse(text).message ?? text; } catch { /* plain text */ }
  const reason = `GitHub answered HTTP ${response.status}${detail ? `: ${String(detail).slice(0, 200)}` : ""}`;
  console.error(`Workflow "${job}" not started: ${reason}`);
  return { ok: false, reason };
}

async function handleAdminTracker(request, env) {
  const url = new URL(request.url);
  if (request.method === "GET" || request.method === "HEAD") {
    const dashboard = await env.DATA.get("dashboard-admin.json", { type: "stream" }) ?? await env.DATA.get("dashboard.json", { type: "stream" });
    if (!dashboard) return json(503, { error: "Prices are not available yet." });
    return new Response(dashboard, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
  }
  if (request.method === "PATCH") {
    const change = await readSmallJson(request);
    const saved = await env.DATA.get("settings.json", { type: "json" });
    const result = applySettingsChange(saved, change);
    if (result.error) return json(400, { error: result.error });
    await env.DATA.put("settings.json", JSON.stringify(result.settings));
    const started = await startWorkflow(env, "publish");
    return json(200, { ok: true, queued: started.ok, message: started.ok ? "Saved. The site updates in about 2–3 minutes." : `Saved, but the site update could not start (${started.reason}). It will show after the next price check.` });
  }
  if (request.method === "POST") {
    const action = url.searchParams.get("action");
    if (action === "check" || action === "models") {
      const started = await startWorkflow(env, "prices", action === "models" ? { force_model_audit: "true" } : {});
      return json(started.ok ? 202 : 502, started.ok
        ? { ok: true, queued: true, message: action === "models" ? "Catalogue scan started. Results appear in about 5 minutes." : "Price check started. Results appear in about 3 minutes." }
        : { error: `The price check could not be started: ${started.reason}.` });
    }
    // Refreshing one model's specs runs with the next full check on Cloudflare.
    if (action === "model") return json(202, { ok: true, queued: false });
  }
  return json(405, { error: "Not supported." });
}

// The admin Analytics report, from D1 counts and clicks.
async function handleAdminAnalytics(request, env) {
  const days = reportDays(new URL(request.url).searchParams.get("days"));
  const since = new Date(Date.now() - 2 * days * 24 * 60 * 60 * 1000);
  const [{ results: rows = [] }, { results: clicks = [] }, operations] = await Promise.all([
    env.DB.prepare("SELECT day, event, detail, count FROM analytics WHERE day >= ?1").bind(since.toISOString().slice(0, 10)).all(),
    env.DB.prepare("SELECT ts, retailer, network, kind, model FROM clicks WHERE ts >= ?1").bind(new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()).all(),
    env.DATA.get("operations.json", { type: "json" }),
  ]);
  const analytics = { version: 2, startedAt: rows.reduce((first, row) => (row.day < first ? row.day : first), new Date().toISOString().slice(0, 10)), days: {} };
  for (const row of rows) {
    const bucket = analytics.days[row.day] ??= { events: {}, details: {} };
    if (!row.detail) bucket.events[row.event] = row.count;
    else if (row.event === "browse_section") bucket.details[row.detail] = row.count;
    else ((bucket.breakdown ??= {})[row.event] ??= {})[row.detail] = row.count;
  }
  const report = summarizeAnalytics(analytics, { clicks, dashboard: operations ?? {}, days });
  return json(200, { ...report, retailerWeeks: weeklyRetailerClicks(clicks) });
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

const htmlHeaders = { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" };

async function handleRacquetPages(request, env, ctx) {
  const { pathname } = new URL(request.url);
  if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });
  if (pathname === "/sitemap.xml") {
    const sitemap = await env.DATA.get("sitemap.xml", { type: "stream" });
    return sitemap ? new Response(sitemap, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } }) : new Response("Not found", { status: 404 });
  }
  if (pathname === "/tennis-racquets") return Response.redirect(new URL("/tennis-racquets/", request.url).href, 301);
  if (pathname === "/tennis-racquets/") {
    const index = await env.DATA.get("racquets-index.html", { type: "stream" });
    return index ? new Response(index, { headers: htmlHeaders }) : env.ASSETS.fetch(request);
  }
  const slug = /^\/tennis-racquets\/([a-z0-9-]{1,140})\/?$/.exec(pathname)?.[1];
  const page = slug ? await env.DB.prepare("SELECT model_key, html FROM racquet_pages WHERE slug = ?1").bind(slug).first() : null;
  if (!page) return new Response(notFoundPage, { status: 404, headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex" } });
  // Count real visitors per racquet page (not crawlers), like other analytics.
  if (request.method === "GET" && !looksAutomated(request.headers.get("user-agent"))) {
    const accepted = acceptEvent("racquet_page", page.model_key);
    if (accepted) {
      const day = new Date().toISOString().slice(0, 10);
      ctx.waitUntil(env.DB.batch([
        env.DB.prepare("INSERT INTO analytics (day, event, detail, count) VALUES (?1, ?2, '', 1) ON CONFLICT (day, event, detail) DO UPDATE SET count = count + 1").bind(day, accepted.event),
        env.DB.prepare("INSERT INTO analytics (day, event, detail, count) VALUES (?1, ?2, ?3, 1) ON CONFLICT (day, event, detail) DO UPDATE SET count = count + 1").bind(day, accepted.event, accepted.detail),
      ]).catch(() => {}));
    }
  }
  return new Response(page.html, { headers: htmlHeaders });
}

async function handleHistory(request, env) {
  const modelKey = new URL(request.url).searchParams.get("model") ?? "";
  if (!/^[a-z0-9-]{1,80}$/.test(modelKey)) return json(400, { error: "Unknown racquet." });
  const { results = [] } = await env.DB.prepare("SELECT day, low, store FROM price_history WHERE model_key = ?1 AND day >= ?2 ORDER BY day")
    .bind(modelKey, new Date(Date.now() - 366 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)).all();
  return new Response(JSON.stringify({ modelKey, points: results }), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=600" } });
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
    const url = new URL(request.url);
    const { pathname } = url;
    try {
      // Admin only on the Access-protected hostname, with a valid Access token.
      const admin = url.hostname === env.ADMIN_HOST && (pathname === "/api/tracker" || pathname === "/api/analytics")
        && await isAccessAdmin(request, { teamDomain: env.ACCESS_TEAM_DOMAIN, audience: env.ACCESS_AUD });
      if (pathname === "/api/tracker") return await (admin ? handleAdminTracker(request, env) : handleTracker(request, env));
      if (pathname === "/api/analytics") return await (admin && !url.searchParams.has("event") ? handleAdminAnalytics(request, env) : handleAnalytics(request, env));
      if (pathname.startsWith("/go/")) return await handleOutbound(request, env, ctx);
      if (pathname === "/tennis-racquets" || pathname.startsWith("/tennis-racquets/") || pathname === "/sitemap.xml") return await handleRacquetPages(request, env, ctx);
      if (pathname === "/api/history") return await handleHistory(request, env);
      if (pathname.startsWith("/api/push/")) return await handlePush(request, env);
      if (pathname.startsWith("/api/")) return json(404, { error: "Not found" });
    } catch (error) {
      console.error(error);
      return json(500, { error: "Something went wrong. Please try again." });
    }
    return env.ASSETS.fetch(request);
  },

  // Cloudflare Cron Trigger (cloudflare/wrangler.jsonc): starts the price
  // check every 3 hours. GitHub's own schedule is only a fallback because it
  // skips runs when GitHub is busy.
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(startWorkflow(env, "prices").then((started) => {
      if (started.ok) console.log("Scheduled price check started");
    }));
  },
};

export default worker;
