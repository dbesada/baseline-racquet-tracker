import http from "node:http";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { appendFile, readFile, rename, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const upstream = `http://${process.env.BASELINE_UPSTREAM_HOST ?? "127.0.0.1"}:${process.env.BASELINE_UPSTREAM_PORT ?? "4001"}`;
const upstreamUrl = new URL(upstream);
const stateFile = "/app/.data/baseline-monitor.json";
const settingsFile = "/app/.data/baseline-settings.json";
const analyticsFile = "/app/.data/baseline-analytics.json";
const ebayDeletionTokenFile = process.env.EBAY_DELETION_TOKEN_FILE ?? "/app/.data/ebay-deletion-token";
const ebayDeletionEndpoint = process.env.EBAY_DELETION_ENDPOINT
  ?? "https://nasbesada.tail0731b8.ts.net:8443/api/ebay/account-deletion";
const checkEveryMs = 3 * 60 * 60 * 1000;
let activeCheck = null;
let dashboardCache = null;
let dashboardCachedAt = 0;
let modelRefreshState = null;
let analyticsWrite = Promise.resolve();
const selectedModelRefreshes = new Map();
const selectedModelRefreshTtlMs = 10 * 60 * 1000;

function settingsSnapshot(dashboard) {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    gripSize: dashboard.gripSize ?? "L3",
    targets: dashboard.targets ?? {},
    usedTargets: dashboard.usedTargets ?? {},
    modelOrder: dashboard.modelOrder ?? [],
    brandPicks: dashboard.brandPicks ?? {},
    retailers: (dashboard.retailers ?? []).map(({ key, name, enabled }) => ({ key, name, enabled: Boolean(enabled) })),
  };
}

async function readPersistentSettings() {
  try { return JSON.parse(await readFile(settingsFile, "utf8")); }
  catch { return null; }
}

async function writePersistentSettings(settings) {
  const temporary = `${settingsFile}.tmp`;
  await writeFile(temporary, JSON.stringify(settings, null, 2));
  await rename(temporary, settingsFile);
}

function applyPersistentSettings(dashboard, settings) {
  if (!settings) return dashboard;
  if (/^L[0-5]$/.test(settings.gripSize ?? "")) dashboard.gripSize = settings.gripSize;
  if (settings.targets) dashboard.targets = { ...(dashboard.targets ?? {}), ...settings.targets };
  if (settings.usedTargets) dashboard.usedTargets = { ...(dashboard.usedTargets ?? {}), ...settings.usedTargets };
  if (Array.isArray(settings.modelOrder) && settings.modelOrder.length) dashboard.modelOrder = settings.modelOrder;
  if (settings.brandPicks && typeof settings.brandPicks === "object") {
    dashboard.brandPicks = { ...(dashboard.brandPicks ?? {}), ...settings.brandPicks };
  }
  if (Array.isArray(settings.retailers)) {
    const enabledByKey = new Map(settings.retailers.map((retailer) => [retailer.key, Boolean(retailer.enabled)]));
    dashboard.retailers = (dashboard.retailers ?? []).map((retailer) => enabledByKey.has(retailer.key)
      ? { ...retailer, enabled: enabledByKey.get(retailer.key) }
      : retailer);
    dashboard.stores = dashboard.retailers
      .filter((retailer) => retailer.enabled && retailer.kind !== "manual")
      .map((retailer) => retailer.name);
  }
  return dashboard;
}

function sendJson(req, res, payload) {
  const rawBody = Buffer.from(JSON.stringify(payload));
  const acceptsGzip = /\bgzip\b/i.test(String(req.headers["accept-encoding"] ?? ""));
  const body = acceptsGzip ? gzipSync(rawBody, { level: 6 }) : rawBody;
  res.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "content-length": body.length,
    "cache-control": "no-store",
    "vary": "Accept-Encoding",
    ...(acceptsGzip ? { "content-encoding": "gzip" } : {}),
  });
  res.end(body);
}

function runPriceCheck(forceModelAudit = false) {
  if (activeCheck) return activeCheck;
  const startedAt = new Date().toISOString();
  if (forceModelAudit) {
    modelRefreshState = { status: "running", startedAt, checkedAt: null, scanned: 0, verified: 0, images: 0 };
  }
  activeCheck = new Promise((resolve) => {
    const child = spawn(process.execPath, ["/app/scripts/check-prices.mjs"], {
      cwd: "/app",
      env: { ...process.env, BASELINE_URL: upstream, ...(forceModelAudit ? { BASELINE_FORCE_MODEL_AUDIT: "1" } : {}) },
      stdio: "inherit",
    });
    child.on("exit", (code) => resolve(code === 0));
    child.on("error", () => resolve(false));
  }).then(async (ok) => {
    dashboardCache = null;
    dashboardCachedAt = 0;
    if (forceModelAudit) {
      let results = [];
      let checkedAt = new Date().toISOString();
      try {
        const state = JSON.parse(await readFile(stateFile, "utf8"));
        results = state.manufacturerSpecResults ?? [];
        checkedAt = state.checkedAt ?? checkedAt;
      } catch { /* The completion state still reports a failed refresh. */ }
      modelRefreshState = {
        status: ok ? "complete" : "failed",
        startedAt,
        checkedAt,
        scanned: results.length,
        verified: results.filter((result) => result.ok).length,
        images: results.filter((result) => result.image).length,
      };
    }
    return ok;
  }).finally(() => { activeCheck = null; });
  return activeCheck;
}

const analyticsEvents = new Set(["page_view", "browse_section", "used_market", "retailer_open", "comparison_open", "deal_open", "coach_open"]);

function analyticsDay() {
  return new Date().toISOString().slice(0, 10);
}

async function readAnalytics() {
  try {
    const parsed = JSON.parse(await readFile(analyticsFile, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : { version: 1, startedAt: new Date().toISOString(), days: {} };
  } catch {
    return { version: 1, startedAt: new Date().toISOString(), days: {} };
  }
}

async function recordAnalytics(event, detail) {
  if (!analyticsEvents.has(event)) return false;
  analyticsWrite = analyticsWrite.then(async () => {
    const analytics = await readAnalytics();
    const day = analyticsDay();
    const bucket = analytics.days[day] ?? { events: {}, details: {} };
    bucket.events[event] = (bucket.events[event] ?? 0) + 1;
    if (event === "browse_section" && /^[a-z-]{2,24}$/.test(detail ?? "")) {
      bucket.details[detail] = (bucket.details[detail] ?? 0) + 1;
    }
    analytics.days[day] = bucket;
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    for (const key of Object.keys(analytics.days)) if (key < cutoff) delete analytics.days[key];
    const temporary = `${analyticsFile}.tmp`;
    await writeFile(temporary, JSON.stringify(analytics, null, 2));
    await rename(temporary, analyticsFile);
  }).catch(() => {});
  await analyticsWrite;
  return true;
}

function summarizeAnalytics(analytics, dashboard) {
  const days = Object.entries(analytics.days ?? {}).sort(([a], [b]) => a.localeCompare(b)).slice(-14);
  const totals = { pageViews: 0, dealOpens: 0, retailerOpens: 0, comparisons: 0, coachOpens: 0, usedMarket: 0 };
  const sections = {};
  for (const [, bucket] of days) {
    totals.pageViews += bucket.events?.page_view ?? 0;
    totals.dealOpens += bucket.events?.deal_open ?? 0;
    totals.retailerOpens += bucket.events?.retailer_open ?? 0;
    totals.comparisons += bucket.events?.comparison_open ?? 0;
    totals.coachOpens += bucket.events?.coach_open ?? 0;
    totals.usedMarket += bucket.events?.used_market ?? 0;
    for (const [section, count] of Object.entries(bucket.details ?? {})) sections[section] = (sections[section] ?? 0) + count;
  }
  return {
    startedAt: analytics.startedAt,
    windowDays: days.length,
    totals,
    daily: days.map(([date, bucket]) => ({ date, pageViews: bucket.events?.page_view ?? 0, dealOpens: bucket.events?.deal_open ?? 0 })),
    sections: Object.entries(sections).map(([section, count]) => ({ section, count })).sort((a, b) => b.count - a.count),
    operations: {
      freshOffers: dashboard.sourceHealth?.freshOffers ?? 0,
      liveSources: dashboard.sourceHealth?.liveSources ?? 0,
      totalSources: dashboard.sourceHealth?.totalSources ?? 0,
      dropsLast24Hours: dashboard.dropsLast24Hours ?? 0,
      lastChecked: dashboard.lastCheck?.checkedAt ?? null,
    },
  };
}

async function runSelectedModelRefresh(modelKey) {
  if (!/^[a-z0-9-]{2,80}$/.test(modelKey)) return false;
  const cached = selectedModelRefreshes.get(modelKey);
  if (cached?.promise) return cached.promise;
  if (cached?.ok && cached.checkedAt && Date.now() - cached.checkedAt < selectedModelRefreshTtlMs) return true;
  const promise = (async () => {
    if (activeCheck) await activeCheck;
    return new Promise((resolve) => {
      const child = spawn(process.execPath, ["/app/scripts/check-prices.mjs"], {
        cwd: "/app",
        env: { ...process.env, BASELINE_URL: upstream, BASELINE_TARGET_MODEL_KEY: modelKey },
        stdio: "inherit",
      });
      child.on("exit", (code) => resolve(code === 0));
      child.on("error", () => resolve(false));
    });
  })().then((ok) => {
    selectedModelRefreshes.set(modelKey, { ok, checkedAt: Date.now(), promise: null });
    dashboardCache = null;
    dashboardCachedAt = 0;
    return ok;
  });
  selectedModelRefreshes.set(modelKey, { ok: false, checkedAt: 0, promise });
  return promise;
}

async function dashboardWithLivePrices() {
  let dashboard;
  if (dashboardCache && Date.now() - dashboardCachedAt < 5 * 60 * 1000) {
    dashboard = structuredClone(dashboardCache);
  } else {
    const response = await fetch(`${upstream}/api/tracker`, {
      headers: { host: "192.168.50.230" },
      signal: AbortSignal.timeout(90000),
    });
    if (!response.ok) throw new Error(`Dashboard upstream returned ${response.status}`);
    dashboardCache = await response.json();
    dashboardCachedAt = Date.now();
    dashboard = structuredClone(dashboardCache);
  }
  try {
    const state = JSON.parse(await readFile(stateFile, "utf8"));
    const cached = Object.values(state.offers ?? {});
    const offers = cached.map((offer) => ({
      id: offer.id,
      modelKey: offer.modelKey,
      store: offer.store,
      title: offer.title,
      url: offer.url,
      currentPrice: offer.price,
      previousPrice: null,
      compareAtPrice: Number.isFinite(offer.compareAtPrice) ? offer.compareAtPrice : null,
      inStock: true,
      gripSizes: offer.gripSizes ?? [state.gripSize ?? "L3"],
      specs: offer.specs ?? null,
      sourceState: offer.sourceState ?? "fresh",
      lastChecked: offer.lastChecked ?? state.checkedAt,
    }));
    const retailerResults = Array.isArray(state.retailerResults) ? state.retailerResults : [];
    const stores = new Set(offers.map((offer) => offer.store));
    const bestByModel = new Map();
    for (const offer of offers) {
      if (offer.modelKey === "other-sale") continue;
      const current = bestByModel.get(offer.modelKey);
      if (!current || offer.currentPrice < current.currentPrice) bestByModel.set(offer.modelKey, offer);
    }
    dashboard.offers = offers;
    dashboard.saleOffers = offers
      .filter((offer) => offer.modelKey === "other-sale" && offer.compareAtPrice > offer.currentPrice)
      .sort((a, b) => a.currentPrice - b.currentPrice)
      .slice(0, 18);
    dashboard.specialOffers = (state.specialOffers ?? []).map((offer) => ({
      id: offer.id,
      modelKey: offer.modelKey,
      store: offer.store,
      title: offer.title,
      url: offer.url,
      currentPrice: offer.price,
      previousPrice: null,
      compareAtPrice: Number.isFinite(offer.compareAtPrice) ? offer.compareAtPrice : null,
      inStock: true,
      gripSizes: offer.gripSizes ?? [],
      specs: offer.specs ?? null,
      sourceState: offer.sourceState ?? "fresh",
      lastChecked: offer.lastChecked ?? state.checkedAt,
    }));
    dashboard.stringOffers = (state.stringOffers ?? []).map((offer) => ({
      id: offer.id,
      store: offer.store,
      title: offer.title,
      url: offer.url,
      currentPrice: offer.price,
      compareAtPrice: Number.isFinite(offer.compareAtPrice) ? offer.compareAtPrice : null,
      inStock: offer.inStock !== false,
      brand: offer.brand ?? "Unknown",
      type: offer.type ?? "Other",
      gauges: offer.gauges ?? ["Not listed"],
      format: offer.format ?? "Single package",
      sourceState: offer.sourceState ?? "fresh",
      lastChecked: offer.lastChecked ?? state.checkedAt,
    }));
    dashboard.stringSourceResults = state.stringSourceResults ?? [];
    dashboard.accessoryOffers = (state.accessoryOffers ?? []).map((offer) => ({
      id: offer.id,
      store: offer.store,
      title: offer.title,
      url: offer.url,
      currentPrice: offer.price,
      compareAtPrice: Number.isFinite(offer.compareAtPrice) ? offer.compareAtPrice : null,
      inStock: offer.inStock !== false,
      brand: offer.brand ?? "Other",
      category: offer.category ?? "Racquet care",
      detail: offer.detail ?? "Single item",
      sourceState: offer.sourceState ?? "fresh",
      lastChecked: offer.lastChecked ?? state.checkedAt,
    }));
    dashboard.accessorySourceResults = state.accessorySourceResults ?? [];
    dashboard.ballOffers = (state.ballOffers ?? []).map((offer) => ({
      id: offer.id,
      store: offer.store,
      title: offer.title,
      url: offer.url,
      currentPrice: offer.price,
      compareAtPrice: Number.isFinite(offer.compareAtPrice) ? offer.compareAtPrice : null,
      inStock: offer.inStock !== false,
      brand: offer.brand ?? "Other",
      type: offer.type ?? "Other",
      package: offer.package ?? "Package size not listed",
      sourceState: offer.sourceState ?? "fresh",
      lastChecked: offer.lastChecked ?? state.checkedAt,
    }));
    dashboard.ballSourceResults = state.ballSourceResults ?? [];
    dashboard.lastCheck = {
      checkedAt: state.checkedAt,
      storesChecked: retailerResults.length ? retailerResults.filter((result) => result.ok).length : stores.size,
      offersFound: offers.length,
      failures: retailerResults.filter((result) => !result.ok).length,
    };
    dashboard.retailerResults = retailerResults;
    dashboard.sourceHealth = state.sourceHealth ?? {
      liveSources: retailerResults.filter((result) => result.ok).length,
      totalSources: retailerResults.length,
      failures: retailerResults.filter((result) => !result.ok).length,
      freshOffers: offers.filter((offer) => offer.sourceState !== "stale").length,
      staleOffers: offers.filter((offer) => offer.sourceState === "stale").length,
      averageDurationMs: 0,
    };
    dashboard.usedOffers = (state.usedOffers ?? []).map((offer) => ({
      id: offer.id,
      modelKey: offer.modelKey,
      store: offer.store,
      title: offer.title,
      url: offer.url,
      currentPrice: offer.price,
      previousPrice: null,
      compareAtPrice: Number.isFinite(offer.compareAtPrice) ? offer.compareAtPrice : null,
      inStock: true,
      gripSizes: offer.gripSizes ?? [state.gripSize ?? "L3"],
      condition: offer.condition ?? "Used",
      currency: offer.currency ?? "CAD",
      sourceState: "fresh",
      lastChecked: offer.lastChecked ?? state.checkedAt,
    }));
    dashboard.usedSourceResults = state.usedSourceResults ?? [];
    dashboard.racquetSpecs = state.racquetSpecs ?? dashboard.racquetSpecs ?? {};
    dashboard.specValidation = state.specValidation ?? {};
    dashboard.manufacturerSpecResults = state.manufacturerSpecResults ?? [];
    dashboard.modelSelectionRefreshes = state.modelSelectionRefreshes ?? {};
    dashboard.gripSize = state.selectedGripSize ?? dashboard.gripSize ?? state.gripSize ?? "L3";
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    dashboard.dropsLast24Hours = new Set((state.dropHistory ?? [])
      .filter((drop) => Date.parse(drop.detectedAt) >= cutoff)
      .map((drop) => drop.id)).size;
    dashboard.history = [...bestByModel.values()].map((offer) => ({
      modelKey: offer.modelKey,
      price: offer.currentPrice,
      checkedAt: state.checkedAt,
    }));
  } catch {
    // The UI still loads normally before the first collector run completes.
  }
  dashboard.modelRefresh = modelRefreshState;
  let settings = await readPersistentSettings();
  if (!settings) {
    settings = settingsSnapshot(dashboard);
    await writePersistentSettings(settings);
  }
  return applyPersistentSettings(dashboard, settings);
}

function isPublicPreviewRequest(req) {
  if (req.headers["x-baseline-public-preview"] === "true") return true;
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "").split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
  if (host === "baseline-beta.besada.net") return true;
  // Cloudflare Access adds a signed assertion to the protected hostname.
  // Treat every tunnel request without that assertion as public, even if a
  // proxy rewrites Host or drops the normal Cloudflare tracing header. Direct
  // LAN use remains available for recovery and local administration.
  const directLan = host === "192.168.50.230" || host === "localhost" || host === "127.0.0.1";
  if (directLan) return false;
  return !req.headers["cf-access-jwt-assertion"] && !req.headers["cf-access-authenticated-user-email"];
}

function requestHeadersForUpstream(req) {
  return isPublicPreviewRequest(req)
    ? { ...req.headers, "x-baseline-public-preview": "true", host: "192.168.50.230" }
    : { ...req.headers, host: "192.168.50.230" };
}

async function handleTracker(req, res) {
  const url = new URL(req.url, "http://baseline.local");
  const publicPreview = isPublicPreviewRequest(req);
  if (publicPreview && (req.method === "POST" || req.method === "PATCH")) {
    res.writeHead(403, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    res.end(JSON.stringify({ error: "This action is available in the protected Baseline admin app." }));
    return;
  }
  if (req.method === "POST" && url.searchParams.get("action") === "check") await runPriceCheck();
  if (req.method === "POST" && url.searchParams.get("action") === "models") {
    if (!activeCheck) void runPriceCheck(true);
    else if (!modelRefreshState || modelRefreshState.status !== "running") {
      modelRefreshState = { status: "running", startedAt: new Date().toISOString(), checkedAt: null, scanned: 0, verified: 0, images: 0 };
    }
  }
  if (req.method === "POST" && url.searchParams.get("action") === "model") {
    await runSelectedModelRefresh(url.searchParams.get("modelKey") ?? "");
  }
  if (req.method === "PATCH") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    let parsedBody = {};
    try { parsedBody = JSON.parse(body.toString("utf8")); } catch { /* Upstream returns the validation error. */ }
    const upstreamResponse = await fetch(`${upstream}${req.url}`, {
      method: "PATCH",
      headers: { ...requestHeadersForUpstream(req), "content-type": req.headers["content-type"] ?? "application/json" },
      body,
      signal: AbortSignal.timeout(90000),
    });
    if (!upstreamResponse.ok) {
      const errorBody = await upstreamResponse.text();
      res.writeHead(upstreamResponse.status, { "content-type": upstreamResponse.headers.get("content-type") ?? "application/json" });
      res.end(errorBody);
      return;
    }
    const updatedDashboard = await upstreamResponse.json();
    await writePersistentSettings(settingsSnapshot(updatedDashboard));
    if (/^L[0-5]$/.test(parsedBody.gripSize ?? "")) {
      let state = {};
      try { state = JSON.parse(await readFile(stateFile, "utf8")); } catch { /* Created by the first collector run. */ }
      state.selectedGripSize = parsedBody.gripSize;
      await writeFile(stateFile, JSON.stringify(state, null, 2));
    }
    dashboardCache = updatedDashboard;
    dashboardCachedAt = Date.now();
  }
  const dashboard = await dashboardWithLivePrices();
  if (publicPreview) dashboard.publicPreview = true;
  sendJson(req, res, dashboard);
}

async function handleAnalytics(req, res) {
  const url = new URL(req.url, "http://baseline.local");
  const publicPreview = isPublicPreviewRequest(req);
  if (req.method !== "GET") {
    res.writeHead(405, { allow: "GET" });
    res.end();
    return;
  }
  if (publicPreview) {
    await recordAnalytics(url.searchParams.get("event") ?? "", url.searchParams.get("detail") ?? "");
    res.writeHead(204, { "cache-control": "no-store" });
    res.end();
    return;
  }
  const [analytics, dashboard] = await Promise.all([readAnalytics(), dashboardWithLivePrices()]);
  sendJson(req, res, summarizeAnalytics(analytics, dashboard));
}

async function handleEbayAccountDeletion(req, res) {
  const url = new URL(req.url, ebayDeletionEndpoint);
  if (req.method === "HEAD") {
    await appendFile(
      "/app/.data/ebay-callback-audit.log",
      `${new Date().toISOString()} HEAD readiness probe\n`,
    ).catch(() => {});
    res.writeHead(204, { "cache-control": "no-store" });
    res.end();
    return;
  }
  if (req.method === "GET") {
    const challengeCode = url.searchParams.get("challenge_code");
    if (!challengeCode) {
      await appendFile(
        "/app/.data/ebay-callback-audit.log",
        `${new Date().toISOString()} GET readiness probe\n`,
      ).catch(() => {});
      const body = JSON.stringify({ status: "ready" });
      res.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "content-length": Buffer.byteLength(body),
        "cache-control": "no-store",
      });
      res.end(body);
      return;
    }
    await appendFile(
      "/app/.data/ebay-callback-audit.log",
      `${new Date().toISOString()} GET challenge received\n`,
    ).catch(() => {});
    const verificationToken = (await readFile(ebayDeletionTokenFile, "utf8")).trim();
    const challengeResponse = createHash("sha256")
      .update(challengeCode)
      .update(verificationToken)
      .update(ebayDeletionEndpoint)
      .digest("hex");
    const body = JSON.stringify({ challengeResponse });
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "content-length": Buffer.byteLength(body),
      "cache-control": "no-store",
    });
    res.end(body);
    return;
  }
  if (req.method === "POST") {
    // Baseline stores public listing metadata only and never persists eBay
    // usernames, user IDs, EIAS tokens, orders, messages, or buyer data.
    // Acknowledge promptly; there is no matching personal record to delete.
    req.resume();
    res.writeHead(204, { "cache-control": "no-store" });
    res.end();
    return;
  }
  res.writeHead(405, { allow: "GET, POST" });
  res.end();
}

function forward(req, res) {
  const proxy = http.request({
    hostname: upstreamUrl.hostname,
    port: upstreamUrl.port,
    path: req.url,
    method: req.method,
    headers: requestHeadersForUpstream(req),
  }, (upstreamResponse) => {
    const headers = { ...upstreamResponse.headers };
    if (/^\/racquets\/optimized-v\d+\//.test(req.url ?? "")) {
      headers["cache-control"] = "public, max-age=31536000, immutable";
    }
    res.writeHead(upstreamResponse.statusCode ?? 502, headers);
    upstreamResponse.pipe(res);
  });
  proxy.on("error", (error) => { res.writeHead(502); res.end(`Bad Gateway: ${error.code || error.message}`); });
  req.pipe(proxy);
}

http.createServer((req, res) => {
  if (req.url?.startsWith("/api/tracker")) {
    handleTracker(req, res).catch((error) => { res.writeHead(502); res.end(`Price service error: ${error.message}`); });
    return;
  }
  if (req.url?.startsWith("/api/analytics")) {
    handleAnalytics(req, res).catch(() => { res.writeHead(500); res.end(); });
    return;
  }
  if (req.url?.startsWith("/api/ebay/account-deletion")) {
    handleEbayAccountDeletion(req, res).catch(() => { res.writeHead(500); res.end(); });
    return;
  }
  forward(req, res);
}).listen(Number(process.env.BASELINE_RELAY_PORT ?? "4000"), "0.0.0.0");

// Tailscale Funnel maps public HTTPS port 8443 only to this loopback listener.
// It deliberately exposes no dashboard, settings, price data, or other route.
http.createServer((req, res) => {
  if (req.url?.startsWith("/api/ebay/account-deletion")) {
    handleEbayAccountDeletion(req, res).catch(() => { res.writeHead(500); res.end(); });
    return;
  }
  res.writeHead(404);
  res.end();
}).listen(Number(process.env.BASELINE_CALLBACK_PORT ?? "4002"), "0.0.0.0");

runPriceCheck();
setInterval(runPriceCheck, checkEveryMs).unref();
