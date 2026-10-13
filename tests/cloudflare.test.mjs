import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import worker from "../cloudflare/worker.js";
import { modelNames } from "../app/lib/racquet-catalogue.js";
import { applyPersistentSettings, catalogueDashboard, mergeMonitorState } from "../scripts/dashboard-build.mjs";

// A tiny stand-in for D1: answers SELECTs from `tables` and records writes.
function fakeDb(tables = {}) {
  const writes = [];
  const statement = (sql) => ({
    params: [],
    bind(...params) { this.params = params; return this; },
    async first() {
      if (/FROM offers/.test(sql)) return tables.offers?.[this.params[0]] ?? null;
      if (/FROM model_prices/.test(sql)) return tables.prices?.[this.params[0]] ?? null;
      if (/FROM push_subscriptions WHERE id/.test(sql)) return tables.subscriptions?.[this.params[0]] ?? null;
      if (/COUNT\(\*\) AS n/.test(sql)) return { n: Object.keys(tables.subscriptions ?? {}).length };
      return { distinctCount: 0, exists_: 0 };
    },
    async run() { writes.push([sql, this.params]); return {}; },
  });
  return { writes, prepare: statement, async batch(statements) { for (const item of statements) await item.run(); } };
}
const ctx = { waitUntil: (promise) => promise };
const env = (db, extra = {}) => ({ DB: db, DATA: { get: async () => "{\"publicPreview\":true}" }, ASSETS: { fetch: () => new Response("static") }, PUSH_PUBLIC_KEY: "key", ...extra });

test("the catalogue dashboard matches the API route's defaults and saved settings apply on top", () => {
  const dashboard = catalogueDashboard(true);
  assert.equal(dashboard.publicPreview, true);
  assert.equal(Object.keys(dashboard.modelNames).length, Object.keys(modelNames).length);
  const names = dashboard.retailers.map((retailer) => retailer.name);
  assert.deepEqual(names, [...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  const withSettings = applyPersistentSettings(dashboard, { gripSize: "L2", targets: { "blade-v9": 199 }, retailers: [{ key: dashboard.retailers[0].key, enabled: false }] });
  assert.equal(withSettings.gripSize, "L2");
  assert.equal(withSettings.targets["blade-v9"], 199);
  assert.ok(!withSettings.stores.includes(dashboard.retailers[0].name));
  const merged = mergeMonitorState(catalogueDashboard(true), { checkedAt: "2026-10-13T12:00:00Z", offers: { a: { id: "a", modelKey: "blade-v9", store: "ATR", title: "Blade", url: "https://x/a", price: 250 } } });
  assert.equal(merged.offers[0].currentPrice, 250);
  assert.equal(merged.lastCheck.offersFound, 1);
});

test("the Worker serves the dashboard read-only and leaves pages to the static site", async () => {
  const db = fakeDb();
  assert.equal(await (await worker.fetch(new Request("https://b/api/tracker"), env(db), ctx)).text(), "{\"publicPreview\":true}");
  assert.equal((await worker.fetch(new Request("https://b/api/tracker?action=check", { method: "POST" }), env(db), ctx)).status, 403);
  assert.equal(await (await worker.fetch(new Request("https://b/privacy"), env(db), ctx)).text(), "static");
  assert.equal((await worker.fetch(new Request("https://b/api/other"), env(db), ctx)).status, 404);
});

test("buy links redirect only to stored URLs and count visitors, not crawlers", async () => {
  const db = fakeDb({ offers: { "ATR:1": { url: "https://atr.example/p", store: "ATR", network: null, kind: "racquet", model: "blade-v9" } } });
  const visitor = await worker.fetch(new Request("https://b/go/ATR%3A1", { headers: { "user-agent": "Mozilla/5.0 (iPhone)" } }), env(db), ctx);
  assert.equal(visitor.status, 302);
  assert.equal(visitor.headers.get("location"), "https://atr.example/p");
  await worker.fetch(new Request("https://b/go/ATR%3A1", { headers: { "user-agent": "Googlebot/2.1" } }), env(db), ctx);
  assert.equal(db.writes.filter(([sql]) => sql.startsWith("INSERT INTO clicks")).length, 1);
  assert.equal((await worker.fetch(new Request("https://b/go/https%3A%2F%2Fevil.example"), env(db), ctx)).status, 404);
  assert.equal((await worker.fetch(new Request("https://b/go/ATR%3A1?to=https://evil.example"), env(db), ctx)).status, 404);
});

test("analytics accepts known events only, and alert sign-ups are checked", async () => {
  const db = fakeDb({ prices: { "blade-v9": { price: 260 } } });
  await worker.fetch(new Request("https://b/api/analytics?event=made_up"), env(db), ctx);
  assert.equal(db.writes.length, 0);
  await worker.fetch(new Request("https://b/api/analytics?event=visit&detail=google.com"), env(db), ctx);
  assert.equal(db.writes.length, 2);
  const subscription = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" } };
  const post = (path, body) => worker.fetch(new Request(`https://b${path}`, { method: "POST", body: JSON.stringify(body) }), env(db), ctx);
  assert.deepEqual(await (await post("/api/push/alert", { subscription, modelKey: "blade-v9", mode: "target", target: 250 })).json(), { ok: true, alerts: { "blade-v9": { mode: "target", target: 250 } } });
  assert.equal((await post("/api/push/alert", { subscription, modelKey: "not-tracked", mode: "drop" })).status, 400);
  assert.equal((await post("/api/push/alert", { subscription: { ...subscription, endpoint: "https://evil.example/x" }, modelKey: "blade-v9", mode: "drop" })).status, 400);
});

test("the Cloudflare workflow stays off until the account is configured", async () => {
  const workflow = await readFile(new URL("../.github/workflows/cloudflare.yml", import.meta.url), "utf8");
  assert.equal((workflow.match(/if: vars\.CLOUDFLARE_ACCOUNT_ID != ''/g) ?? []).length, 2);
  assert.match(workflow, /cron: "17 \*\/3 \* \* \*"/);
});

test("admin settings changes are checked and applied to the saved settings", async () => {
  const { applySettingsChange } = await import("../scripts/settings-change.mjs");
  const saved = { gripSize: "L3", targets: { "blade-v9": 275 }, modelOrder: ["blade-v10", "blade-v9", "blade-v8", "ezone-98", "pure-aero-98", "speed-pro-2026"], brandPicks: {}, retailers: [{ key: "atr-sports", name: "ATR Sports", enabled: true }] };
  assert.equal(applySettingsChange(saved, { gripSize: "L2" }).settings.gripSize, "L2");
  assert.match(applySettingsChange(saved, { gripSize: "XL" }).error, /grip size/);
  assert.equal(applySettingsChange(saved, { modelKey: "blade-v9", targetPrice: 240 }).settings.targets["blade-v9"], 240);
  assert.equal(applySettingsChange(saved, { modelKey: "blade-v9", targetPrice: 150, market: "used" }).settings.usedTargets["blade-v9"], 150);
  assert.match(applySettingsChange(saved, { modelKey: "toString", targetPrice: 10 }).error, /tracked racquet/);
  assert.equal(applySettingsChange(saved, { retailerKey: "atr-sports", enabled: false }).settings.retailers[0].enabled, false);
  assert.equal(applySettingsChange(saved, { slot: 2, selectedModelKey: "ezone-100" }).settings.modelOrder[2], "ezone-100");
  assert.match(applySettingsChange(saved, { slot: 2, selectedModelKey: "blade-v10" }).error, /already on the watchlist/);
  assert.match(applySettingsChange(saved, { featuredBrand: "Wilson", featuredSlot: 0, selectedModelKey: "ezone-98" }).error, /from that brand/);
  assert.equal(saved.gripSize, "L3", "the saved settings are not modified");
});

test("only a correctly signed Cloudflare Access token for this application is admin", async () => {
  const { isAccessAdmin } = await import("../cloudflare/access.js");
  const keys = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const jwk = { ...(await crypto.subtle.exportKey("jwk", keys.publicKey)), kid: "k1" };
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const team = "test-team.cloudflareaccess.com";
  const sign = async (claims, kid = "k1") => {
    const body = `${encode({ alg: "RS256", kid })}.${encode(claims)}`;
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keys.privateKey, new TextEncoder().encode(body));
    return `${body}.${Buffer.from(signature).toString("base64url")}`;
  };
  const fetcher = async () => new Response(JSON.stringify({ keys: [jwk] }));
  const now = Date.now();
  const claims = { aud: ["aud-1"], iss: `https://${team}`, exp: Math.floor(now / 1000) + 600 };
  const check = async (token, audience = "aud-1") => isAccessAdmin(new Request("https://baseline.besada.net/api/tracker", { headers: token ? { "cf-access-jwt-assertion": token } : {} }), { teamDomain: team, audience, fetcher, now });
  assert.equal(await check(await sign(claims)), true);
  assert.equal(await check(await sign(claims), "other-app"), false);
  assert.equal(await check(await sign({ ...claims, exp: Math.floor(now / 1000) - 3600 })), false);
  assert.equal(await check(await sign({ ...claims, iss: "https://evil.cloudflareaccess.com" })), false);
  const [header, payload] = (await sign(claims)).split(".");
  assert.equal(await check(`${header}.${payload}.AAAA`), false);
  assert.equal(await check(null), false);
});

test("the public hostname never gets admin answers, even with an Access header", async () => {
  const db = fakeDb();
  const request = new Request("https://baseline-beta.besada.net/api/tracker", { method: "PATCH", headers: { "cf-access-jwt-assertion": "x.y.z" }, body: "{\"gripSize\":\"L2\"}" });
  assert.equal((await worker.fetch(request, env(db, { ADMIN_HOST: "baseline.besada.net", ACCESS_TEAM_DOMAIN: "t.cloudflareaccess.com", ACCESS_AUD: "a" }), ctx)).status, 403);
});
