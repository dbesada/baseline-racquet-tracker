import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { historyPath, historySummary, torontoDay } from "../app/lib/price-history.js";
import { racquetSlug, racquetSlugs } from "../app/lib/racquet-slug.js";
import worker from "../cloudflare/worker.js";
import { escapeHtml, renderRacquetIndex, renderRacquetPage, renderSitemap } from "../scripts/racquet-pages.mjs";

const run = promisify(execFile);

test("racquet addresses are readable, stable and unique", () => {
  assert.equal(racquetSlug("Wilson Blade 98 16x19 v9"), "wilson-blade-98-16x19-v9");
  assert.equal(racquetSlug("Yonex EZONE 98+ (2025)"), "yonex-ezone-98-plus-2025");
  assert.equal(racquetSlug("Völkl V-Cell 10"), "volkl-v-cell-10");
  assert.equal(racquetSlug("", "fallback-key"), "fallback-key");
  const slugs = racquetSlugs({ "a-1": "Same Name", "b-2": "Same Name", c: "Other" });
  assert.equal(new Set(Object.values(slugs)).size, 3);
  assert.equal(slugs["b-2"], "same-name-b-2");
});

test("the price history summary finds the 30-day low and flags good and high prices", () => {
  const points = [
    { day: "2026-09-01", low: 250 }, { day: "2026-10-01", low: 300 }, { day: "2026-10-05", low: 289 },
    { day: "2026-10-10", low: 310 }, { day: "2026-10-14", low: 299 },
  ];
  const summary = historySummary(points, 289, "2026-10-14");
  assert.equal(summary.low30, 289);
  assert.equal(summary.low30Day, "2026-10-05");
  assert.equal(summary.since, "2026-09-01");
  assert.equal(summary.isLowest30, true);
  assert.equal(historySummary(points, 340, "2026-10-14").aboveUsual, true);
  assert.equal(historySummary(points.slice(0, 2), 300, "2026-10-14"), null, "needs 3 days");
  assert.match(historyPath(points, 600, 150), /^M[\d.]+ [\d.]+( L[\d.]+ [\d.]+){4}$/);
  assert.equal(historyPath(points.slice(0, 1), 600, 150), "");
  assert.match(torontoDay(Date.parse("2026-10-14T03:00:00Z")), /^2026-10-13$/, "Toronto is still the 13th at 03:00 UTC");
});

test("with less than 30 days of history the claim is 'lowest since', and only after a week", () => {
  const week = ["2026-10-06", "2026-10-08", "2026-10-10", "2026-10-14"].map((day, index) => ({ day, low: 300 - index }));
  const short = historySummary(week, 297, "2026-10-14");
  assert.equal(short.coversMonth, false);
  assert.equal(short.isLowest30, false, "never claims 30 days without 30 days of history");
  assert.equal(short.isLowestSinceStart, true);
  assert.equal(short.aboveUsual, false, "too little history to say what is usual");
  const threeDays = historySummary(week.slice(1), 297, "2026-10-14");
  assert.equal(threeDays.isLowestSinceStart, false, "less than a week");
});

test("a stale price never beats a fresh one, and history takes fresh prices only", async () => {
  const { bestPrices, freshBestPrices } = await import("../scripts/price-alerts.mjs");
  const state = { offers: {
    a: { modelKey: "blade-v9", price: 199, store: "Old Shop", sourceState: "stale" },
    b: { modelKey: "blade-v9", price: 279, store: "ATR" },
    c: { modelKey: "ezone-98", price: 250, store: "Only Stale", sourceState: "stale" },
  } };
  assert.deepEqual(bestPrices(state).get("blade-v9"), { price: 279, store: "ATR" });
  assert.deepEqual(bestPrices(state).get("ezone-98"), { price: 250, store: "Only Stale" }, "stale is a last resort");
  assert.equal(freshBestPrices(state).has("ezone-98"), false);
});

const page = {
  siteUrl: "https://baseline-beta.besada.net",
  slug: "wilson-blade-98-16x19-v9",
  modelKey: "blade-v9",
  name: "Wilson Blade 98 16x19 v9",
  brand: "Wilson",
  imageUrl: "https://example.com/blade.jpg",
  fit: { label: "Good for experienced players", reasons: ["smaller, precise head", "medium weight"] },
  specRows: [{ label: "Head size", value: "98 in² / 632 cm²" }],
  specSource: { name: "Wilson official", url: "https://www.wilson.com/blade" },
  offers: [{ id: "ATR Sports:blade:1", store: "ATR <b>Sports</b>", price: 279.95, grips: 4 }, { id: "x", store: "Tennis Giant", price: 299, grips: 2 }],
  gripLabel: "L3 (4 3/8 in)",
  history: [{ day: "2026-10-12", low: 289 }, { day: "2026-10-13", low: 285 }, { day: "2026-10-14", low: 279.95 }],
  summary: { low30: 279.95, low30Day: "2026-10-14", since: "2026-10-12", median30: 285, isLowest30: true, aboveUsual: false },
  checkedAt: "2026-10-14T04:24:04.584Z",
  affiliateOn: false,
  related: [{ slug: "wilson-blade-100-v9", name: "Wilson Blade 100 v9", low: 259 }],
};

test("a racquet page has the price, stores, history, specs and Google's product data, all escaped", () => {
  const html = renderRacquetPage(page);
  assert.match(html, /<title>Wilson Blade 98 16x19 v9 price in Canada — 2 stores compared \| Baseline<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/baseline-beta\.besada\.net\/tennis-racquets\/wilson-blade-98-16x19-v9">/);
  assert.match(html, /ATR &lt;b&gt;Sports&lt;\/b&gt;/, "store names are escaped");
  assert.doesNotMatch(html, /<b>Sports<\/b>/);
  assert.match(html, /href="\/go\/ATR%20Sports%3Ablade%3A1" rel="sponsored nofollow noreferrer"/);
  assert.match(html, /Lowest price in 30 days/);
  assert.match(html, /href="\/#racquet-blade-v9"/);
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
  const product = blocks.find((block) => block["@type"] === "Product");
  assert.deepEqual(product.offers, { "@type": "AggregateOffer", priceCurrency: "CAD", lowPrice: "279.95", highPrice: "299.00", offerCount: 2, availability: "https://schema.org/InStock" });
  assert.equal(product.brand.name, "Wilson");
  assert.ok(blocks.some((block) => block["@type"] === "BreadcrumbList"));
  // A name that tries to close the script block stays inside the JSON.
  const hostile = renderRacquetPage({ ...page, name: "Evil </script><script>alert(1)</script>" });
  assert.equal((hostile.match(/<script>alert/g) ?? []).length, 0);
});

test("a racquet nobody stocks still gets a page, without an offer", () => {
  const html = renderRacquetPage({ ...page, offers: [], summary: null, history: [] });
  assert.match(html, /specs and Canadian availability/);
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
  assert.deepEqual(blocks.map((block) => block["@type"]), ["BreadcrumbList"], "no Product data without an offer (Google requires one)");
  assert.equal(escapeHtml("\"<&>'"), "&quot;&lt;&amp;&gt;&#39;");
});

test("the racquet list and sitemap link every page", () => {
  const index = renderRacquetIndex([{ slug: "a", name: "Wilson A", brand: "Wilson", low: 200, stores: 3 }, { slug: "b", name: "Head B", brand: "Head", low: null, stores: 0 }], { siteUrl: "https://x.ca", checkedAt: "2026-10-14T04:00:00Z" });
  assert.match(index, /href="\/tennis-racquets\/a"/);
  assert.match(index, /not in stock now/);
  const sitemap = renderSitemap([{ path: "/tennis-racquets/a", lastmod: "2026-10-14" }], "https://x.ca");
  assert.match(sitemap, /<loc>https:\/\/x\.ca\/tennis-racquets\/a<\/loc><lastmod>2026-10-14<\/lastmod>/);
});

test("publishing records today's lows and builds a page per racquet with the site's helpers", { timeout: 120_000 }, async () => {
  const folder = await mkdtemp(join(tmpdir(), "baseline-pages-"));
  const bundle = join(folder, "page-data.mjs");
  await run(process.execPath, ["scripts/bundle-page-data.mjs", bundle]);
  const state = {
    checkedAt: "2026-10-14T16:00:00.000Z",
    offers: {
      a: { id: "a", modelKey: "blade-v9", store: "ATR Sports", title: "Wilson Blade 98 v9", url: "https://atr.example/blade", price: 279.95, gripSizes: ["L3"], inStock: true },
      b: { id: "b", modelKey: "blade-v9", store: "Tennis Giant", title: "Wilson Blade 98 v9", url: "https://tg.example/blade", price: 299, gripSizes: ["L3"], inStock: true },
    },
    retailerResults: [{ store: "ATR Sports", ok: true, offers: 1 }],
  };
  await writeFile(join(folder, "state.json"), JSON.stringify(state));
  await writeFile(join(folder, "history.json"), JSON.stringify([{ results: [{ model_key: "blade-v9", day: "2026-10-12", low: 289 }, { model_key: "blade-v9", day: "2026-10-13", low: 285 }] }]));
  const out = join(folder, "out");
  await run(process.execPath, ["scripts/publish-cloudflare.mjs", join(folder, "state.json"), join(folder, "none.json"), out, join(folder, "history.json"), bundle]);
  const history = await readFile(join(out, "history.sql"), "utf8");
  assert.match(history, /INSERT INTO price_history \(model_key, day, low, store\) VALUES \('blade-v9', '2026-10-14', 279\.95, 'ATR Sports'\)/);
  assert.match(history, /WHERE excluded\.low < price_history\.low/);
  const pages = await readFile(join(out, "pages.sql"), "utf8");
  assert.match(pages, /INSERT INTO racquet_pages \(slug, model_key, html, updated_at\) VALUES \('wilson-blade-98-16x19-v9', 'blade-v9'/);
  assert.match(pages, /DELETE FROM racquet_pages WHERE updated_at < \d+;/);
  const dashboard = JSON.parse(await readFile(join(out, "dashboard.json"), "utf8"));
  assert.deepEqual(dashboard.history.filter((row) => row.modelKey === "blade-v9").map((row) => row.price), [279.95, 285, 289], "newest first");
  assert.match(await readFile(join(out, "sitemap.xml"), "utf8"), /tennis-racquets\/wilson-blade-98-16x19-v9/);
});

test("the Worker serves racquet pages, the list, the sitemap and price history", async () => {
  const writes = [];
  const db = {
    prepare(sql) {
      return {
        params: [],
        bind(...params) { this.params = params; return this; },
        async first() { return /FROM racquet_pages/.test(sql) && this.params[0] === "wilson-blade-98-16x19-v9" ? { model_key: "blade-v9", html: "<html>blade</html>" } : null; },
        async all() { return { results: /FROM price_history/.test(sql) ? [{ day: "2026-10-13", low: 285, store: "ATR" }] : [] }; },
        async run() { writes.push(sql); return {}; },
      };
    },
    async batch(statements) { for (const statement of statements) await statement.run(); },
  };
  const kv = { get: async (key) => ({ "sitemap.xml": "<urlset/>", "racquets-index.html": "<html>list</html>" })[key] ?? null };
  const env = { DB: db, DATA: kv, ASSETS: { fetch: () => new Response("static") } };
  const waits = [];
  const ctx = { waitUntil: (promise) => waits.push(promise) };
  const get = (path, agent = "Mozilla/5.0 (iPhone)") => worker.fetch(new Request(`https://baseline-beta.besada.net${path}`, { headers: { "user-agent": agent } }), env, ctx);
  assert.equal(await (await get("/tennis-racquets/wilson-blade-98-16x19-v9")).text(), "<html>blade</html>");
  await Promise.all(waits);
  assert.equal(writes.filter((sql) => /INSERT INTO analytics/.test(sql)).length, 2, "a visitor's page view is counted");
  await get("/tennis-racquets/wilson-blade-98-16x19-v9", "Googlebot/2.1");
  assert.equal(writes.filter((sql) => /INSERT INTO analytics/.test(sql)).length, 2, "crawlers are not counted");
  assert.equal((await get("/tennis-racquets/no-such-racquet")).status, 404);
  assert.equal((await get("/tennis-racquets/Bad%20Slug%3Cx%3E")).status, 404);
  assert.equal(await (await get("/tennis-racquets/")).text(), "<html>list</html>");
  assert.equal((await get("/tennis-racquets")).status, 301);
  // The site's racquet photos live under /racquets/ and must stay static files.
  assert.equal(await (await get("/racquets/optimized-v1/blade-v9.webp")).text(), "static");
  const wrangler = await readFile(new URL("../cloudflare/wrangler.jsonc", import.meta.url), "utf8");
  assert.doesNotMatch(wrangler, /"\/racquets/, "the Worker must not run first for the photo folder");
  assert.equal((await get("/sitemap.xml")).headers.get("content-type"), "application/xml; charset=utf-8");
  assert.deepEqual((await (await get("/api/history?model=blade-v9")).json()).points, [{ day: "2026-10-13", low: 285, store: "ATR" }]);
  assert.equal((await get("/api/history?model=<x>")).status, 400);
});
