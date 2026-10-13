import { mkdir, readFile, writeFile } from "node:fs/promises";
import { loadAffiliateLinks } from "./affiliate-links.mjs";
import { applyPersistentSettings, catalogueDashboard, mergeMonitorState } from "./dashboard-build.mjs";
import { clickDetails, listKinds, offerDestination, offerLists } from "./outbound-rules.mjs";
import { bestPrices } from "./price-alerts.mjs";

// After a price check on GitHub, writes what Cloudflare serves:
//   out/dashboard.json  the public dashboard (KV key "dashboard.json")
//   out/offers.sql      every listing /go/ can open, with the affiliate link
//                       applied, plus each racquet's lowest price (D1)
// The workflow uploads them with Wrangler.
//
// Usage: node scripts/publish-cloudflare.mjs <state.json> <settings.json> <out dir>

const [statePath = ".data/baseline-monitor.json", settingsPath = ".data/baseline-settings.json", outDir = "out"] = process.argv.slice(2);
const market = /^[A-Z]{2}$/.test(process.env.BASELINE_MARKET ?? "") ? process.env.BASELINE_MARKET : "CA";

const state = JSON.parse(await readFile(statePath, "utf8"));
let settings = null;
try { settings = JSON.parse(await readFile(settingsPath, "utf8")); } catch { /* defaults */ }
const affiliate = await loadAffiliateLinks({ market, warn: (message) => console.warn(message) });

const dashboard = applyPersistentSettings(mergeMonitorState(catalogueDashboard(true), state), settings);
dashboard.affiliateRetailers = affiliate.retailers;
dashboard.modelRefresh = null;

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

await mkdir(outDir, { recursive: true });
await writeFile(`${outDir}/dashboard.json`, JSON.stringify(dashboard));
await writeFile(`${outDir}/offers.sql`, `${statements.join("\n")}\n`);
console.log(`Dashboard: ${dashboard.offers.length} racquet listings, ${dashboard.saleOffers.length} on sale. Links: ${rows.length}. Racquet prices: ${prices.length}.`);
