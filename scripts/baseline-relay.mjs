import http from "node:http";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile, rename, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { createAccessVerifier, isAdminRequest, parseLoginList } from "./access-control.mjs";
import { loadAffiliateLinks } from "./affiliate-links.mjs";
import { createAuditLog } from "./audit-log.mjs";
import { emptyAnalytics, recordEvent, reportDays, summarizeAnalytics } from "./analytics.mjs";
import { readClickRows, weeklyRetailerClicks } from "./click-report.mjs";
import { applyPersistentSettings, mergeMonitorState } from "./dashboard-build.mjs";
import { modelNames as catalogueModelNames } from "../app/lib/racquet-catalogue.js";
import { bestPrices, createPriceAlerts } from "./price-alerts.mjs";
import { createOutboundRedirect, looksAutomated, marketFrom } from "./outbound-redirect.mjs";
import { settingsAfterChange, settingsSnapshot } from "./persistent-settings.mjs";

const upstream = `http://${process.env.BASELINE_UPSTREAM_HOST ?? "127.0.0.1"}:${process.env.BASELINE_UPSTREAM_PORT ?? "4001"}`;
const upstreamUrl = new URL(upstream);
const stateFile = "/app/.data/baseline-monitor.json";
const settingsFile = "/app/.data/baseline-settings.json";
const analyticsFile = "/app/.data/baseline-analytics.json";
const clickLogFile = "/app/.data/baseline-clicks.jsonl";
const priceAlerts = createPriceAlerts({
  storePath: "/app/.data/baseline-price-alerts.json",
  keysPath: "/app/.data/baseline-push-keys.json",
  subject: process.env.BASELINE_PUSH_SUBJECT ?? "https://baseline-beta.besada.net",
});
const ebayDeletionTokenFile = process.env.EBAY_DELETION_TOKEN_FILE ?? "/app/.data/ebay-deletion-token";
const ebayDeletionEndpoint = process.env.EBAY_DELETION_ENDPOINT
  ?? "https://nasbesada.tail0731b8.ts.net:8443/api/ebay/account-deletion";
const ebayAudit = createAuditLog({ path: "/app/.data/ebay-callback-audit.log" });
// Cloudflare Access verification. Both values come from the Access application
// in the Cloudflare Zero Trust dashboard: the team domain (for example
// "myteam.cloudflareaccess.com") and the application's Audience (AUD) tag.
// Without them, requests arriving through Cloudflare are always public; direct
// LAN administration keeps working.
const accessVerifier = createAccessVerifier({
  teamDomain: process.env.CF_ACCESS_TEAM_DOMAIN,
  audience: process.env.CF_ACCESS_AUD,
});
if (!accessVerifier) {
  console.warn("CF_ACCESS_TEAM_DOMAIN / CF_ACCESS_AUD not set: admin actions are limited to the local network.");
}
// Tailscale logins (comma-separated) allowed to administer through Tailscale
// Serve, for example from the Android app. Empty means Tailscale is read-only.
const tailscaleAdmins = parseLoginList(process.env.BASELINE_TAILSCALE_ADMINS);
const publicPreviewByRequest = new WeakMap();
const market = marketFrom(process.env.BASELINE_MARKET);
// Only this market's affiliate file is read (config/affiliates/<market>.json).
const affiliate = await loadAffiliateLinks({ market, warn: (message) => console.warn(message) });
const { handleOutbound, rememberOffers } = createOutboundRedirect({
  readState: async () => JSON.parse(await readFile(stateFile, "utf8")),
  clickLogPath: clickLogFile,
  market,
  affiliate,
  // Visitor clicks only: not the owner's admin site, and not crawlers.
  countClick: (req) => isPublicPreviewRequest(req) && !looksAutomated(req.headers["user-agent"]),
});
const checkEveryMs = 3 * 60 * 60 * 1000;
let activeCheck = null;
let dashboardCache = null;
let dashboardCachedAt = 0;
let modelRefreshState = null;
let analyticsWrite = Promise.resolve();
const selectedModelRefreshes = new Map();
const selectedModelRefreshTtlMs = 10 * 60 * 1000;

async function readPersistentSettings() {
  try { return JSON.parse(await readFile(settingsFile, "utf8")); }
  catch { return null; }
}

async function writePersistentSettings(settings) {
  const temporary = `${settingsFile}.tmp`;
  await writeFile(temporary, JSON.stringify(settings, null, 2));
  await rename(temporary, settingsFile);
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
    if (ok) {
      try {
        const sent = await priceAlerts.notifyAfterCheck(JSON.parse(await readFile(stateFile, "utf8")), catalogueModelNames);
        if (sent) console.log(`Sent ${sent} price alert${sent === 1 ? "" : "s"}`);
      } catch (error) {
        console.warn(`Price alerts were not sent: ${error.message}`);
      }
    }
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

async function readAnalytics() {
  try {
    const parsed = JSON.parse(await readFile(analyticsFile, "utf8"));
    return parsed && typeof parsed === "object" && parsed.days ? parsed : emptyAnalytics();
  } catch {
    return emptyAnalytics();
  }
}

async function recordAnalytics(event, detail) {
  let accepted = false;
  analyticsWrite = analyticsWrite.then(async () => {
    const analytics = await readAnalytics();
    accepted = recordEvent(analytics, event, detail);
    if (!accepted) return;
    const temporary = `${analyticsFile}.tmp`;
    await writeFile(temporary, JSON.stringify(analytics, null, 2));
    await rename(temporary, analyticsFile);
  }).catch(() => {});
  await analyticsWrite;
  return accepted;
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
    // Every offer a visitor can see stays reachable through /go/ for a while.
    rememberOffers(state);
    mergeMonitorState(dashboard, state);
  } catch {
    // The UI still loads normally before the first collector run completes.
  }
  dashboard.modelRefresh = modelRefreshState;
  // Retailers with an enabled affiliate link; the UI shows its disclosure while any are listed.
  dashboard.affiliateRetailers = affiliate.retailers;
  let settings = await readPersistentSettings();
  if (!settings) {
    settings = settingsSnapshot(dashboard);
    await writePersistentSettings(settings);
  }
  return applyPersistentSettings(dashboard, settings);
}

// The decision is made once per request, before routing (see the server
// callback below), and read back here. A request that was never classified is
// treated as public.
async function classifyRequest(req) {
  const admin = await isAdminRequest({
    headers: req.headers,
    remoteAddress: req.socket?.remoteAddress,
    verifier: accessVerifier,
    // The public beta hostname is always the read-only preview.
    publicHosts: ["baseline-beta.besada.net"],
    tailscaleAdmins,
  });
  publicPreviewByRequest.set(req, !admin);
}

function isPublicPreviewRequest(req) {
  return publicPreviewByRequest.get(req) ?? true;
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
    if (parsedBody?.restoreSettings !== undefined) {
      // Only the relay itself restores the settings file, on startup.
      res.writeHead(400, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify({ error: "Invalid request body" }));
      return;
    }
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
    // Only the field this PATCH changed: the API's database may still hold defaults.
    await writePersistentSettings(settingsAfterChange(await readPersistentSettings(), parsedBody, updatedDashboard));
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
  const [analytics, dashboard, clicks] = await Promise.all([readAnalytics(), dashboardWithLivePrices(), readClickRows(clickLogFile)]);
  // Admin only: public preview requests returned above.
  const days = reportDays(url.searchParams.get("days"));
  sendJson(req, res, { ...summarizeAnalytics(analytics, { clicks, dashboard, days }), retailerWeeks: weeklyRetailerClicks(clicks) });
}

// Reads a small JSON body (price-alert requests are well under 4 KB).
function readSmallJson(req, limit = 8192) {
  return new Promise((resolve) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) { req.destroy(); resolve(null); return; }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        resolve(value && typeof value === "object" && !Array.isArray(value) ? value : null);
      } catch { resolve(null); }
    });
    req.on("error", () => resolve(null));
  });
}

// A simple brake on alert changes: 300 a minute for the whole site.
let alertWrites = { minute: 0, count: 0 };
function alertWriteAllowed() {
  const minute = Math.floor(Date.now() / 60000);
  if (alertWrites.minute !== minute) alertWrites = { minute, count: 0 };
  alertWrites.count += 1;
  return alertWrites.count <= 300;
}

function sendAlertJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body), "cache-control": "no-store" });
  res.end(body);
}

// /api/push/key (GET), /api/push/alerts, /api/push/alert, /api/push/remove (POST).
async function handlePriceAlerts(req, res) {
  const path = new URL(req.url, "http://baseline.local").pathname;
  if (path === "/api/push/key" && req.method === "GET") {
    sendAlertJson(res, 200, { publicKey: await priceAlerts.publicKey() });
    return;
  }
  if (req.method !== "POST" || !["/api/push/alerts", "/api/push/alert", "/api/push/remove"].includes(path)) {
    sendAlertJson(res, 404, { error: "Not found" });
    return;
  }
  if (path !== "/api/push/alerts" && !alertWriteAllowed()) {
    sendAlertJson(res, 429, { error: "Too many alert changes right now. Please try again in a minute." });
    return;
  }
  const body = await readSmallJson(req);
  if (!body) {
    sendAlertJson(res, 400, { error: "The alert request could not be read." });
    return;
  }
  if (path === "/api/push/alerts") {
    sendAlertJson(res, 200, await priceAlerts.listAlerts(body));
    return;
  }
  const modelKey = typeof body.modelKey === "string" && Object.hasOwn(catalogueModelNames, body.modelKey) ? body.modelKey : null;
  if (path === "/api/push/remove") {
    const result = await priceAlerts.removeAlert({ subscription: body.subscription, modelKey });
    sendAlertJson(res, result.error ? 400 : 200, result);
    return;
  }
  if (!modelKey) {
    sendAlertJson(res, 400, { error: "That racquet is not tracked." });
    return;
  }
  let currentPrice = null;
  try { currentPrice = bestPrices(JSON.parse(await readFile(stateFile, "utf8"))).get(modelKey)?.price ?? null; } catch { /* No price check yet. */ }
  const result = await priceAlerts.setAlert({ subscription: body.subscription, modelKey, mode: body.mode, target: Number(body.target), currentPrice });
  sendAlertJson(res, result.error ? 400 : 200, result);
}

async function handleEbayAccountDeletion(req, res) {
  const url = new URL(req.url, ebayDeletionEndpoint);
  if (req.method === "HEAD") {
    await ebayAudit("HEAD readiness probe", { throttleKey: "head-probe" });
    res.writeHead(204, { "cache-control": "no-store" });
    res.end();
    return;
  }
  if (req.method === "GET") {
    const challengeCode = url.searchParams.get("challenge_code");
    if (!challengeCode) {
      await ebayAudit("GET readiness probe", { throttleKey: "get-probe" });
      const body = JSON.stringify({ status: "ready" });
      res.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "content-length": Buffer.byteLength(body),
        "cache-control": "no-store",
      });
      res.end(body);
      return;
    }
    await ebayAudit("GET challenge received");
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

http.createServer(async (req, res) => {
  await classifyRequest(req).catch(() => publicPreviewByRequest.set(req, true));
  if (req.url?.startsWith("/api/tracker")) {
    handleTracker(req, res).catch((error) => { res.writeHead(502); res.end(`Price service error: ${error.message}`); });
    return;
  }
  if (req.url?.startsWith("/api/push/")) {
    handlePriceAlerts(req, res).catch(() => { if (!res.headersSent) { res.writeHead(500); res.end(); } });
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
  if (req.url?.startsWith("/go/")) {
    handleOutbound(req, res).catch(() => { res.writeHead(500); res.end(); });
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

// The API's database is created with defaults whenever its folder is new.
// Store the saved settings in it on startup so the two agree; the UI takes a
// minute or more to start, so keep trying until it answers.
async function restoreDatabaseSettings() {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const settings = await readPersistentSettings();
    if (!settings) return;
    try {
      const response = await fetch(`${upstream}/api/tracker`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ restoreSettings: settings }),
        signal: AbortSignal.timeout(90000),
      });
      if (response.ok) {
        dashboardCache = null;
        dashboardCachedAt = 0;
        console.log("Restored the saved settings into the database");
      } else {
        console.warn(`Restoring the saved settings returned HTTP ${response.status}`);
      }
      return;
    } catch { /* The UI is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
  console.warn("Could not restore the saved settings into the database: the UI did not answer");
}

void restoreDatabaseSettings();
runPriceCheck();
setInterval(runPriceCheck, checkEveryMs).unref();
