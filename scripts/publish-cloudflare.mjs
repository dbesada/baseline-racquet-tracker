import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { historySummary, torontoDay } from "../app/lib/price-history.js";
import { racquetPagePath, racquetSlugs } from "../app/lib/racquet-slug.js";
import { playerFit } from "../app/ui/player-fit.js";
import { renderRacquetIndex, renderRacquetPage, renderSitemap } from "./racquet-pages.mjs";
import { loadAffiliateLinks } from "./affiliate-links.mjs";
import { applyPersistentSettings, catalogueDashboard, mergeMonitorState } from "./dashboard-build.mjs";
import { clickDetails, listKinds, offerDestination, offerLists } from "./outbound-rules.mjs";
import { bestPrices, freshBestPrices } from "./price-alerts.mjs";

// After a price check on GitHub, writes what Cloudflare serves:
//   out/dashboard.json  the public dashboard (KV key "dashboard.json")
//   out/dashboard-admin.json  the same for the admin site (publicPreview false)
//   out/operations.json tracker health for the admin Analytics report
//   out/offers.sql      every listing /go/ can open, with the affiliate link
//                       applied, plus each racquet's lowest price (D1)
//   out/history.sql     today's lowest price per racquet (D1 price_history)
//   out/pages.sql       one page per racquet (D1 racquet_pages)
//   out/racquets-index.html, out/sitemap.xml  (KV)
// The workflow uploads them with Wrangler.
//
// Usage: node scripts/publish-cloudflare.mjs <state.json> <settings.json> <out dir> [history export.json] [page-data.mjs]
// The history export is the D1 query result for price_history; page-data.mjs
// is the bundle from scripts/bundle-page-data.mjs (pages are skipped without it).

const [statePath = ".data/baseline-monitor.json", settingsPath = ".data/baseline-settings.json", outDir = "out", historyPath = "", pageDataPath = "out/page-data.mjs"] = process.argv.slice(2);
const siteUrl = (process.env.BASELINE_SITE_URL ?? "https://baseline-beta.besada.net").replace(/\/$/, "");
const market = /^[A-Z]{2}$/.test(process.env.BASELINE_MARKET ?? "") ? process.env.BASELINE_MARKET : "CA";

const state = JSON.parse(await readFile(statePath, "utf8"));
let settings = null;
try { settings = JSON.parse(await readFile(settingsPath, "utf8")); } catch { /* defaults */ }
const affiliate = await loadAffiliateLinks({ market, warn: (message) => console.warn(message) });

const dashboard = applyPersistentSettings(mergeMonitorState(catalogueDashboard(true), state), settings);
dashboard.affiliateRetailers = affiliate.retailers;
dashboard.modelRefresh = null;

// Daily lowest prices: the stored history plus today's check.
let historyRows = [];
if (historyPath) {
  try {
    const exported = JSON.parse(await readFile(historyPath, "utf8"));
    historyRows = (Array.isArray(exported) ? exported[0]?.results : exported?.results) ?? [];
  } catch (error) { console.warn(`Price history not loaded: ${error.message}`); }
}
const today = torontoDay(Date.parse(state.checkedAt) || Date.now());
// Only prices verified in this check go into the history.
const todaysLows = freshBestPrices(state);
const history = new Map();
for (const row of historyRows) {
  const low = Number(row.low);
  if (typeof row.model_key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.day ?? "") || !Number.isFinite(low)) continue;
  if (!history.has(row.model_key)) history.set(row.model_key, new Map());
  history.get(row.model_key).set(row.day, low);
}
for (const [modelKey, best] of todaysLows) {
  const days = history.get(modelKey) ?? new Map();
  if (!days.has(today) || best.price < days.get(today)) days.set(today, best.price);
  history.set(modelKey, days);
}
const historyFor = (modelKey) => [...(history.get(modelKey) ?? new Map())].map(([day, low]) => ({ day, low })).sort((a, b) => a.day.localeCompare(b.day));
// The cards' small trend bars: the last 14 daily lows per racquet, newest first.
dashboard.history = [...history.keys()].flatMap((modelKey) => historyFor(modelKey).slice(-14).reverse()
  .map((point) => ({ modelKey, price: point.low, checkedAt: `${point.day}T12:00:00.000Z` })));

const sql = (value) => value === null || value === undefined ? "NULL" : typeof value === "number" ? String(value) : `'${String(value).replace(/'/g, "''")}'`;
const seenAt = Date.now();
const rows = [];
const add = (offer, kind) => {
  const destination = offerDestination(offer);
  if (typeof offer?.id !== "string" || !destination) return;
  const link = affiliate(offer, destination);
  const { model } = clickDetails(offer, kind);
  rows.push(`(${[offer.id, link.url, offer.store ?? "Unknown", link.network, kind, model, seenAt].map(sql).join(", ")})`);
};
for (const offer of Object.values(state.offers ?? {})) add(offer, offer?.modelKey === "other-sale" ? "sale" : "racquet");
for (const list of offerLists) for (const offer of Array.isArray(state[list]) ? state[list] : []) add(offer, listKinds[list]);

const statements = [];
// D1 limits statement size, so insert in batches.
for (let index = 0; index < rows.length; index += 200) {
  statements.push(`INSERT INTO offers (id, url, store, network, kind, model, seen_at) VALUES ${rows.slice(index, index + 200).join(", ")} ON CONFLICT (id) DO UPDATE SET url = excluded.url, store = excluded.store, network = excluded.network, kind = excluded.kind, model = excluded.model, seen_at = excluded.seen_at;`);
}
// Links on pages loaded earlier keep working for a week, as on the NAS.
statements.push(`DELETE FROM offers WHERE seen_at < ${seenAt - 7 * 24 * 60 * 60 * 1000};`);
statements.push("DELETE FROM model_prices;");
const prices = [...bestPrices(state)].map(([modelKey, best]) => `(${[modelKey, best.price, best.store].map(sql).join(", ")})`);
for (let index = 0; index < prices.length; index += 200) {
  statements.push(`INSERT INTO model_prices (model_key, price, store) VALUES ${prices.slice(index, index + 200).join(", ")};`);
}
// Click records follow the privacy page: 90 days.
statements.push(`DELETE FROM clicks WHERE ts < '${new Date(seenAt - 90 * 24 * 60 * 60 * 1000).toISOString()}';`);
statements.push(`DELETE FROM analytics WHERE day < '${new Date(seenAt - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}';`);

// Today's lows: the cheaper of an earlier check today and this one is kept.
const historyStatements = [];
const historyValues = [...todaysLows].map(([modelKey, best]) => `(${[modelKey, today, best.price, best.store].map(sql).join(", ")})`);
for (let index = 0; index < historyValues.length; index += 200) {
  historyStatements.push(`INSERT INTO price_history (model_key, day, low, store) VALUES ${historyValues.slice(index, index + 200).join(", ")} ON CONFLICT (model_key, day) DO UPDATE SET low = excluded.low, store = excluded.store WHERE excluded.low < price_history.low;`);
}
historyStatements.push(`DELETE FROM price_history WHERE day < '${torontoDay(seenAt - 400 * 24 * 60 * 60 * 1000)}';`);

// One page per racquet, built with the site's own spec and offer helpers.
let pageData = null;
try { pageData = await import(pathToFileURL(resolve(pageDataPath)).href); }
catch (error) { console.warn(`Racquet pages skipped (no page-data bundle): ${error.message}`); }
const pageStatements = [];
let indexHtml = null;
let sitemap = null;
if (pageData) {
  const preorder = /pre[- ]?order|preorder|reserve now|coming soon/i;
  const gripInches = { L0: "4 in", L1: "4 1/8 in", L2: "4 1/4 in", L3: "4 3/8 in", L4: "4 1/2 in", L5: "4 5/8 in" };
  const specRowsOf = [["Head size", "head"], ["Length", "length"], ["Unstrung weight", "weight"], ["Strung weight", "strungWeight"], ["Unstrung balance", "balance"], ["Strung balance", "strungBalance"], ["Swingweight", "swingweight"], ["Stiffness / flex", "stiffness"], ["Beam width", "beam"], ["Composition", "composition"], ["String pattern", "pattern"], ["Grip sizes", "gripSizes"], ["Recommended strings", "recommendedStrings"], ["Recommended tension", "tension"], ["Colour", "color"], ["Made in", "madeIn"], ["Product code", "productCode"], ["Notable player (endorsed line)", "notablePlayer"], ["Playing profile", "profile"]];
  const specs = pageData.resolveRacquetSpecs(dashboard);
  const slugs = racquetSlugs(dashboard.modelNames);
  const models = Object.entries(dashboard.modelNames).map(([modelKey, name]) => {
    const offers = pageData.uniqueRetailerOffers(dashboard.offers.filter((offer) => offer.modelKey === modelKey && offer.currentPrice != null && (offer.inStock || preorder.test(offer.title))))
      // Freshly checked prices first, then by price, so a stale price never headlines.
      .sort((a, b) => Number(a.sourceState === "stale") - Number(b.sourceState === "stale") || a.currentPrice - b.currentPrice);
    const fresh = offers.filter((offer) => offer.sourceState !== "stale");
    return { modelKey, name, slug: slugs[modelKey], brand: pageData.modelBrand(modelKey), offers, low: (fresh[0] ?? offers[0])?.currentPrice ?? null };
  });
  for (const model of models) {
    const spec = specs[model.modelKey] ?? {};
    const image = pageData.modelImage(model.modelKey, spec.imageUrl);
    const imageUrl = /racquet-photo-pending/.test(image) ? null : image.startsWith("/") ? `${siteUrl}${image}` : image;
    const specRows = specRowsOf.flatMap(([label, field]) => {
      if (field === "pattern") {
        const pattern = pageData.patternPresentation(spec.pattern);
        return pattern ? [{ label, value: `${pattern.label} (${pattern.detail.toLowerCase()})` }] : [];
      }
      const value = pageData.standardizedSpecDisplay(field, spec[field]);
      return value ? [{ label, value: String(value) }] : [];
    });
    const pointHistory = historyFor(model.modelKey);
    const html = renderRacquetPage({
      siteUrl,
      slug: model.slug,
      modelKey: model.modelKey,
      name: model.name,
      brand: model.brand,
      imageUrl,
      mpn: spec.productCode,
      fit: playerFit(spec),
      specRows,
      specSource: spec.source ? { name: spec.source, url: /^https:\/\//.test(spec.sourceUrl ?? "") ? spec.sourceUrl : null } : null,
      offers: model.offers.map((offer) => ({ id: offer.id, store: offer.store, price: offer.currentPrice, grips: offer.gripSizes?.length ?? 0, preorder: preorder.test(offer.title) && !offer.inStock, stale: offer.sourceState === "stale" })),
      gripLabel: `${dashboard.gripSize ?? "L3"} (${gripInches[dashboard.gripSize] ?? "4 3/8 in"})`,
      history: pointHistory,
      summary: historySummary(pointHistory, model.low, today),
      checkedAt: state.checkedAt,
      affiliateOn: affiliate.retailers.length > 0,
      related: models.filter((other) => other.brand === model.brand && other.modelKey !== model.modelKey)
        .sort((a, b) => Number(b.low !== null) - Number(a.low !== null) || a.name.localeCompare(b.name, "en-CA")).slice(0, 8)
        .map((other) => ({ slug: other.slug, name: other.name, low: other.low })),
    });
    // D1 limits one SQL statement to 100 KB.
    if (html.length > 90_000) { console.warn(`Racquet page skipped (too large): ${model.slug}`); continue; }
    pageStatements.push(`INSERT INTO racquet_pages (slug, model_key, html, updated_at) VALUES (${[model.slug, model.modelKey, html, seenAt].map(sql).join(", ")}) ON CONFLICT (slug) DO UPDATE SET model_key = excluded.model_key, html = excluded.html, updated_at = excluded.updated_at;`);
  }
  // Pages for racquets that left the catalogue (or changed address) are removed.
  pageStatements.push(`DELETE FROM racquet_pages WHERE updated_at < ${seenAt};`);
  indexHtml = renderRacquetIndex(models.map((model) => ({ slug: model.slug, name: model.name, brand: model.brand, low: model.low, stores: model.offers.length })), { siteUrl, checkedAt: state.checkedAt });
  sitemap = renderSitemap([{ path: "/", lastmod: today }, { path: "/tennis-racquets/", lastmod: today }, ...models.map((model) => ({ path: racquetPagePath(model.slug), lastmod: today })), { path: "/privacy" }], siteUrl);
}

await mkdir(outDir, { recursive: true });
await writeFile(`${outDir}/history.sql`, `${historyStatements.join("\n")}\n`);
if (pageData) {
  await writeFile(`${outDir}/pages.sql`, `${pageStatements.join("\n")}\n`);
  await writeFile(`${outDir}/racquets-index.html`, indexHtml);
  await writeFile(`${outDir}/sitemap.xml`, sitemap);
}
await writeFile(`${outDir}/dashboard.json`, JSON.stringify(dashboard));
await writeFile(`${outDir}/dashboard-admin.json`, JSON.stringify({ ...dashboard, publicPreview: false }));
await writeFile(`${outDir}/operations.json`, JSON.stringify({ sourceHealth: dashboard.sourceHealth, dropsLast24Hours: dashboard.dropsLast24Hours, lastCheck: dashboard.lastCheck }));
await writeFile(`${outDir}/offers.sql`, `${statements.join("\n")}\n`);
console.log(`Dashboard: ${dashboard.offers.length} racquet listings, ${dashboard.saleOffers.length} on sale. Links: ${rows.length}. Racquet prices: ${prices.length}. History: ${history.size} racquets. Pages: ${pageData ? pageStatements.length - 1 : "skipped"}.`);
