import { mkdir, readFile, writeFile } from "node:fs/promises";

const nativeFetch = globalThis.fetch.bind(globalThis);
const transientHttpStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resilientFetch(input, init = {}) {
  const attempts = /localhost|127[.]0[.]0[.]1|192[.]168[.]/.test(String(input)) ? 1 : 3;
  let lastResponse;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await nativeFetch(input, init);
      lastResponse = response;
      if (!transientHttpStatuses.has(response.status) || attempt === attempts - 1) return response;
      await response.body?.cancel().catch(() => undefined);
      const retryAfter = Number(response.headers.get("retry-after"));
      await delay(Number.isFinite(retryAfter) ? Math.min(retryAfter * 1000, 5000) : 450 * (2 ** attempt) + Math.floor(Math.random() * 180));
    } catch (error) {
      if (init.signal?.aborted || attempt === attempts - 1) throw error;
      await delay(450 * (2 ** attempt) + Math.floor(Math.random() * 180));
    }
  }
  return lastResponse;
}

const fetch = resilientFetch;

async function settleInPool(items, worker, concurrency = 6) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      const startedAt = Date.now();
      try {
        results[index] = { status: "fulfilled", value: await worker(items[index]), durationMs: Date.now() - startedAt };
      } catch (reason) {
        results[index] = { status: "rejected", reason, durationMs: Date.now() - startedAt };
      }
    }
  });
  await Promise.all(runners);
  return results;
}

const feeds = [
  ["ATR Sports", "https://atrsports.com/en-ca", "https://atrsports.com/en-ca/collections/tennis-racquets/products.json?limit=250"],
  ["Just Tennis", "https://www.justtennis.ca", "https://www.justtennis.ca/collections/racquets/products.json?limit=250"],
  ["Brown's Sports", "https://www.brownssports.ca", "https://www.brownssports.ca/collections/tennis-racquets/products.json?limit=250"],
  ["Tads Sporting Goods", "https://tadssportinggoods.ca", "https://tadssportinggoods.ca/collections/tennis-rackets/products.json?limit=250"],
  ["Courtside Racquets", "https://courtsideracquets.ca", "https://courtsideracquets.ca/collections/racquets/products.json?limit=250"],
  ["RacquetGuys", "https://racquetguys.ca", "https://racquetguys.ca/collections/adult-tennis-racquets/products.json?limit=250"],
  ["Merchant of Tennis", "https://www.merchantoftennis.com", "https://www.merchantoftennis.com/collections/tennis-racquets/products.json?limit=250"],
  ["RaquetteVille", "https://raquetteville.ca", "https://raquetteville.ca/collections/tennis-racquets/products.json?limit=250"],
  ["Yumo Pro Shop", "https://yumo.ca", "https://yumo.ca/collections/tennis-rackets/products.json?limit=250"],
  ["Prince Canada", "https://princecanada.ca", "https://princecanada.ca/collections/racquets/products.json?limit=250"],
  ["HiSports", "https://hisports.ca", "https://hisports.ca/collections/tennis-racquets/products.json?limit=250"],
  ["Sports Virtuoso", "https://sportsvirtuoso.com", "https://sportsvirtuoso.com/collections/tennis-racquets/products.json?limit=250"],
  ["Racquet Science", "https://racquetscience.ca", "https://racquetscience.ca/collections/tennis-racquets/products.json?limit=250"],
  ["TennisNetPro", "https://tennisnetpro.com", "https://tennisnetpro.com/products.json?limit=250"],
  ["Max Sports", "https://maxsports.ca", "https://maxsports.ca/collections/tennis-racquets/products.json?limit=250"],
  ["Babolat Canada", "https://www.babolat.ca", "https://www.babolat.ca/collections/tennis-rackets/products.json?limit=250"],
  ["Premier Racquet Store", "https://premierracquetstore.com", "https://premierracquetstore.com/collections/racquets/products.json?limit=250"],
  ["Racquet Network", "https://racquetnetwork.com", "https://racquetnetwork.com/wp-json/wc/store/v1/products?per_page=100&category=7739", "woocommerce"],
  ["Amazon.ca", "https://www.amazon.ca", "https://www.amazon.ca/s?k=tennis+racket+grip+3+sale", "amazon"],
  ["Amazon.com", "https://www.amazon.com", "https://www.amazon.com/s?k=tennis+racket+grip+3+sale", "amazon"],
  ["Sport Chek", "https://www.sportchek.ca", "https://www.sportchek.ca/en/cat/sports-tennis/tennis/racquets-DC200002.html", "structured"],
  ["Sporting Life", "https://www.sportinglife.ca", "https://www.sportinglife.ca/en-CA/tennis/tennis-racquets/", "manual"],
  ["Altitude Sports", "https://www.altitude-sports.com", "https://www.altitude-sports.com/c/tennis", "structured"],
  ["Canadian Tire", "https://www.canadiantire.ca", "https://www.canadiantire.ca/en/cat/sports-recreation/tennis/tennis-racquets-DC0002487.html", "structured"],
  ["Decathlon Canada", "https://www.decathlon.ca", "https://www.decathlon.ca/en/c/tennis/racquets", "manual"],
  ["Racquets Pro Shop", "https://www.racquetsproshop.ca", "https://www.racquetsproshop.ca/tennis-racquet", "wix"],
  ["Tennis Central", "https://www.tenniscentral.ca", "https://www.tenniscentral.ca/collections/tennis-racquets/products.json?limit=250"],
  ["Tennis Giant", "https://www.tennisgiant.com", "https://www.tennisgiant.com/collections/tennis-racquets/products.json?limit=250"],
  ["TCC Pro Shop", "https://proshop.tennisclubs.ca", "https://proshop.tennisclubs.ca/collections/tennis-racquets/products.json?limit=250"],
  ["Matchpoint", "https://www.matchpointstore.com", "https://www.matchpointstore.com/racquets/", "lightspeed"],
  ["Tenniszon", "https://www.tenniszon.com", "https://www.tenniszon.com/collections/tennis-racquets/products.json?limit=250"],
  ["Rackets & Runners", "https://racketsandrunners.ca", "https://racketsandrunners.ca/collections/tennis-racquets/products.json?limit=250"],
  ["Game Set Match", "https://gamesetmatch.ca", "https://gamesetmatch.ca/", "manual"],
  ["Racquet Vault", "https://racquetvault.ca", "https://racquetvault.ca/collections/tennis-racquets/products.json?limit=250"],
  ["Courtside Tennis Academy", "https://courtsidetennisacademy.ca", "https://courtsidetennisacademy.ca/products.json?limit=250"],
  ["Performance Tennis Ottawa", "https://www.performancetennis.ca", "https://www.performancetennis.ca/products.json?limit=250"],
  ["Plock Tennis Club Shop", "https://www.plocktennisclub.ca", "https://www.plocktennisclub.ca/category/wilson-racquet", "wix"],
  ["Kevin Martin Tennis", "https://www.kevinmartinsport.com", "https://www.kevinmartinsport.com/tennis", "manual"],
  ["HEAD Canada", "https://www.head.com", "https://www.head.com/en_CA/shop-tennis/racquets", "structured"],
  ["Tennis ProSport", "https://tennisprosport.com", "https://tennisprosport.com/", "manual"],
  ["TennisTek", "https://shop.tennistek.ca", "https://shop.tennistek.ca/us/catalog/", "structured"],
  ["ORC Pro Shop", "https://orcproshop.com", "https://orcproshop.com/collections/adult-tennis-racquets/products.json?limit=250"],
  ["T1 Sports", "https://t1sports.net", "https://t1sports.net/collections/tennis-rackets/products.json?limit=250"],
  ["JJ Sports Specialist", "https://www.jjsports.ca", "https://www.jjsports.ca/collections/tennis/products.json?limit=250"],
  ["Courtside Sports", "https://www.courtsidesports.com", "https://www.courtsidesports.com/court/tennis/tennis-racquets/", "lightspeed"],
  ["Sports Experts", "https://www.sportsexperts.ca", "https://www.sportsexperts.ca/en-CA/sports/racquet-sports/tennis", "manual"],
  ["Walmart Canada", "https://www.walmart.ca", "https://www.walmart.ca/en/c/kp/tennis-racquets", "manual"],
  ["Source for Sports", "https://www.sourceforsports.ca", "https://www.sourceforsports.ca/search?q=tennis%20racquet", "manual"],
  ["SVP Sports", "https://www.svpsports.ca", "https://www.svpsports.ca/search?q=tennis%20racquet&type=product", "manual"],
  ["Aforza Pro Shop", "https://www.aforzashop.ca", "https://www.aforzashop.ca/", "manual"],
  ["The Sweet Spot", "https://sweetspotcanada.com", "https://sweetspotcanada.com/", "manual"],
];

// Some Shopify stores rename or split their catalogue collections over time.
// Keep the verified adult/performance, new-release and sale collections here
// and merge them by product handle so coverage does not depend on one stale URL.
const shopifyRacquetCatalogOverrides = new Map([
  ["Tennis Central", ["https://www.tenniscentral.ca/collections/racquets/products.json?limit=250"]],
  ["Tennis Giant", ["https://www.tennisgiant.com/collections/all-racquets/products.json?limit=250"]],
  ["TCC Pro Shop", ["https://proshop.tennisclubs.ca/collections/racquets-balls/products.json?limit=250"]],
  ["Tenniszon", [
    "https://www.tenniszon.com/collections/new-gear/products.json?limit=250",
    "https://www.tenniszon.com/collections/tennis-racquets-regular-price-only/products.json?limit=250",
    "https://www.tenniszon.com/collections/racquet-sale/products.json?limit=250",
  ]],
  ["Rackets & Runners", ["https://racketsandrunners.ca/collections/adult-tennis-rackets/products.json?limit=250"]],
  ["TennisNetPro", ["https://tennisnetpro.com/collections/tennis-racquets-1/products.json?limit=250"]],
]);

async function fetchShopifyCatalogs(store, catalogUrl, timeoutMs = 20000) {
  const catalogUrls = shopifyRacquetCatalogOverrides.get(store) ?? [catalogUrl];
  const catalogues = await Promise.all(catalogUrls.map(async (sourceUrl) => {
    const products = [];
    for (let page = 1; page <= 4; page += 1) {
      const pageUrl = new URL(sourceUrl);
      pageUrl.searchParams.set("limit", "250");
      pageUrl.searchParams.set("page", String(page));
      const response = await fetch(pageUrl, {
        headers: { accept: "application/json", "user-agent": "BaselinePriceTracker/1.0" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`${store}: HTTP ${response.status}`);
      const batch = (await response.json()).products ?? [];
      products.push(...batch);
      if (batch.length < 250) break;
    }
    return products;
  }));
  return [...new Map(catalogues.flat().map((product) => [product.handle, product])).values()];
}
const stringFeeds = [
  ["ATR Sports", "https://atrsports.com/en-ca", "https://atrsports.com/en-ca/collections/tennis-strings/products.json?limit=250"],
  ["Just Tennis", "https://www.justtennis.ca", "https://www.justtennis.ca/collections/string/products.json?limit=250"],
  ["Tads Sporting Goods", "https://tadssportinggoods.ca", "https://tadssportinggoods.ca/collections/tennis-strings/products.json?limit=250"],
  ["Merchant of Tennis", "https://www.merchantoftennis.com", "https://www.merchantoftennis.com/collections/strings/products.json?limit=250"],
  ["RaquetteVille", "https://raquetteville.ca", "https://raquetteville.ca/collections/strings/products.json?limit=250"],
  ["Yumo Pro Shop", "https://yumo.ca", "https://yumo.ca/collections/tennis-strings/products.json?limit=250"],
  ["Sports Virtuoso", "https://sportsvirtuoso.com", "https://sportsvirtuoso.com/collections/tennis-strings/products.json?limit=250"],
  ["Racquet Science", "https://racquetscience.ca", "https://racquetscience.ca/collections/tennis-strings/products.json?limit=250"],
  ["TennisNetPro", "https://tennisnetpro.com", "https://tennisnetpro.com/collections/polyester/products.json?limit=250"],
  ["Max Sports", "https://maxsports.ca", "https://maxsports.ca/collections/tennis-strings/products.json?limit=250"],
  ["Babolat Canada", "https://www.babolat.ca", "https://www.babolat.ca/collections/tennis-strings-1/products.json?limit=250"],
  ["Premier Racquet Store", "https://premierracquetstore.com", "https://premierracquetstore.com/collections/strings/products.json?limit=250"],
  ["Tennis Giant", "https://www.tennisgiant.com", "https://www.tennisgiant.com/collections/all-tennis-strings/products.json?limit=250"],
  ["TCC Pro Shop", "https://proshop.tennisclubs.ca", "https://proshop.tennisclubs.ca/collections/strings/products.json?limit=250"],
  ["Tenniszon", "https://www.tenniszon.com", "https://www.tenniszon.com/collections/polyester-tennis-strings/products.json?limit=250"],
  ["Rackets & Runners", "https://racketsandrunners.ca", "https://racketsandrunners.ca/products.json?limit=250"],
  ["Racquet Vault", "https://racquetvault.ca", "https://racquetvault.ca/collections/solinco-tennis-strings/products.json?limit=250"],
  ["T1 Sports", "https://t1sports.net", "https://t1sports.net/collections/tennis-strings/products.json?limit=250"],
  ["JJ Sports Specialist", "https://www.jjsports.ca", "https://www.jjsports.ca/collections/tennis-strings/products.json?limit=250"],
];
const accessoryFeeds = [
  ["ATR Sports", "https://atrsports.com/en-ca", "https://atrsports.com/en-ca/collections/accessories/products.json?limit=250"],
  ["ATR Sports", "https://atrsports.com/en-ca", "https://atrsports.com/en-ca/collections/bags/products.json?limit=250"],
  ["ATR Sports", "https://atrsports.com/en-ca", "https://atrsports.com/en-ca/collections/grommets/products.json?limit=250"],
  ["Just Tennis", "https://www.justtennis.ca", "https://www.justtennis.ca/collections/accessories/products.json?limit=250"],
  ["Just Tennis", "https://www.justtennis.ca", "https://www.justtennis.ca/collections/bags/products.json?limit=250"],
  ["Merchant of Tennis", "https://www.merchantoftennis.com", "https://www.merchantoftennis.com/collections/tennis-accessories/products.json?limit=250"],
  ["Merchant of Tennis", "https://www.merchantoftennis.com", "https://www.merchantoftennis.com/collections/bags/products.json?limit=250"],
  ["RaquetteVille", "https://raquetteville.ca", "https://raquetteville.ca/collections/tennis-accessories/products.json?limit=250"],
  ["RaquetteVille", "https://raquetteville.ca", "https://raquetteville.ca/collections/tennis-bags/products.json?limit=250"],
  ["Yumo Pro Shop", "https://yumo.ca", "https://yumo.ca/collections/tennis-accessories/products.json?limit=250"],
  ["Yumo Pro Shop", "https://yumo.ca", "https://yumo.ca/collections/babolat-racquet-bags/products.json?limit=250"],
  ["Sports Virtuoso", "https://sportsvirtuoso.com", "https://sportsvirtuoso.com/collections/tennis-accessories/products.json?limit=250"],
  ["Sports Virtuoso", "https://sportsvirtuoso.com", "https://sportsvirtuoso.com/collections/sport-bags/products.json?limit=250"],
  ["Sports Virtuoso", "https://sportsvirtuoso.com", "https://sportsvirtuoso.com/collections/bumper-guard-sets-for-tennis-racquets/products.json?limit=250"],
  ["Racquet Science", "https://racquetscience.ca", "https://racquetscience.ca/collections/tennis-accessories/products.json?limit=250"],
  ["Racquet Science", "https://racquetscience.ca", "https://racquetscience.ca/collections/bags/products.json?limit=250"],
  ["Max Sports", "https://maxsports.ca", "https://maxsports.ca/collections/accessories/products.json?limit=250"],
  ["Max Sports", "https://maxsports.ca", "https://maxsports.ca/collections/racquet-bags/products.json?limit=250"],
  ["Babolat Canada", "https://www.babolat.ca", "https://www.babolat.ca/collections/tennis-accessories-all/products.json?limit=250"],
  ["Babolat Canada", "https://www.babolat.ca", "https://www.babolat.ca/collections/tennis-accessories-bags/products.json?limit=250"],
  ["Tennis Giant", "https://www.tennisgiant.com", "https://www.tennisgiant.com/collections/complete-your-setup-with-accessories/products.json?limit=250"],
  ["Tenniszon", "https://www.tenniszon.com", "https://www.tenniszon.com/collections/grips-overgrips/products.json?limit=250"],
  ["Tenniszon", "https://www.tenniszon.com", "https://www.tenniszon.com/collections/dampener/products.json?limit=250"],
  ["T1 Sports", "https://t1sports.net", "https://t1sports.net/collections/accessories/products.json?limit=250"],
  ["T1 Sports", "https://t1sports.net", "https://t1sports.net/collections/racket-bags/products.json?limit=250"],
  ["JJ Sports Specialist", "https://www.jjsports.ca", "https://www.jjsports.ca/collections/accessories/products.json?limit=250"],
  ["JJ Sports Specialist", "https://www.jjsports.ca", "https://www.jjsports.ca/collections/racquet-bag/products.json?limit=250"],
  ["Rackets & Runners", "https://racketsandrunners.ca", "https://racketsandrunners.ca/collections/accessories/products.json?limit=250"],
  ["Rackets & Runners", "https://racketsandrunners.ca", "https://racketsandrunners.ca/collections/court-bags/products.json?limit=250"],
  ["Tennis Central", "https://www.tenniscentral.ca", "https://www.tenniscentral.ca/collections/accessories/products.json?limit=250"],
  ["Tennis Central", "https://www.tenniscentral.ca", "https://www.tenniscentral.ca/collections/bags/products.json?limit=250"],
  ["TennisNetPro", "https://tennisnetpro.com", "https://tennisnetpro.com/collections/accessories/products.json?limit=250"],
  ["TennisNetPro", "https://tennisnetpro.com", "https://tennisnetpro.com/collections/bags/products.json?limit=250"],
];
const ballFeeds = [
  ["ATR Sports", "https://atrsports.com/en-ca", "https://atrsports.com/en-ca/collections/tennis-balls/products.json?limit=250"],
  ["Just Tennis", "https://www.justtennis.ca", "https://www.justtennis.ca/collections/balls/products.json?limit=250"],
  ["Merchant of Tennis", "https://www.merchantoftennis.com", "https://www.merchantoftennis.com/collections/tennis-balls/products.json?limit=250"],
  ["RaquetteVille", "https://raquetteville.ca", "https://raquetteville.ca/collections/tennis-balls/products.json?limit=250"],
  ["Yumo Pro Shop", "https://yumo.ca", "https://yumo.ca/collections/tennis-balls/products.json?limit=250"],
  ["Sports Virtuoso", "https://sportsvirtuoso.com", "https://sportsvirtuoso.com/collections/tennis-balls/products.json?limit=250"],
  ["Racquet Science", "https://racquetscience.ca", "https://racquetscience.ca/collections/tennis-balls/products.json?limit=250"],
  ["Max Sports", "https://maxsports.ca", "https://maxsports.ca/collections/tennis-balls/products.json?limit=250"],
  ["Babolat Canada", "https://www.babolat.ca", "https://www.babolat.ca/products.json?limit=250"],
  ["Tennis Giant", "https://www.tennisgiant.com", "https://www.tennisgiant.com/products.json?limit=250"],
  ["Tenniszon", "https://www.tenniszon.com", "https://www.tenniszon.com/collections/balls/products.json?limit=250"],
  ["T1 Sports", "https://t1sports.net", "https://t1sports.net/collections/tennis-balls-and-tennis-ball-machines/products.json?limit=250"],
  ["JJ Sports Specialist", "https://www.jjsports.ca", "https://www.jjsports.ca/collections/tennis-balls/products.json?limit=250"],
  ["Rackets & Runners", "https://racketsandrunners.ca", "https://racketsandrunners.ca/collections/tennis-balls/products.json?limit=250"],
  ["Tennis Central", "https://www.tenniscentral.ca", "https://www.tenniscentral.ca/collections/tennis-balls/products.json?limit=250"],
];
const amazonSearches = [
  "Wilson Blade 98 v10", "Wilson Blade Pro Defyer 98 100", "Wilson Pro Staff Classic", "Yonex EZONE 98 100 Tour Plus", "Babolat Pure Aero 98 Gen9",
  "Babolat Pure Strike 98", "Babolat Pure Strike 100", "Babolat Boost Evo Aero Drive Wimbledon", "Yonex Percept 97",
  "Wilson Clash Ultra Pro Staff RF 01", "Wilson Shift 99", "Yonex VCORE Tour VCORE Pro",
  "Yonex MUSE", "Babolat Pure Drive AeroPro Pure Control", "Head Speed Gravity Radical",
  "Head SQUARED Extreme XL Boom Elite Prestige", "Tecnifibre FIRE T-Fight TF40 TF-X1 Tempo",
];
const amazonSpecialEditionSearches = [
  "Wilson Defyer Concept Edition tennis racquet",
  "Wilson Roland Garros special edition tennis racquet",
  "Head Legend special edition tennis racquet",
  "Babolat Wimbledon special edition tennis racquet",
  "Yonex limited edition tennis racquet",
  "Tecnifibre limited edition tennis racquet",
];
const gripMeasurements = { L0: "4", L1: "4 1/8", L2: "4 1/4", L3: "4 3/8", L4: "4 1/2", L5: "4 5/8" };
let targetGripSize = Object.hasOwn(gripMeasurements, process.env.BASELINE_GRIP_SIZE) ? process.env.BASELINE_GRIP_SIZE : "L3";
// Marketplace search engines often return zero results when the grip is placed
// in the query. Search broadly, then require exact grip evidence in each ad.
const usedMarketplaceQueries = () => ["Wilson", "Yonex", "Babolat", "Head", "Tecnifibre", ""]
  .map((brand) => `${brand} tennis racquet`.trim());
let facebookModelKeys = ["blade-v10", "blade-v9", "ezone-98", "pure-aero-98", "speed-pro-2026", "tfight-300s"];
const facebookMarketplaceQueries = () => facebookModelKeys.map((modelKey) => modelNames[modelKey]).filter(Boolean);

const modelNames = {
  "defyer-98-pro-v1": "Wilson Defyer 98 Pro v1",
  "defyer-100-v1": "Wilson Defyer 100 v1",
  "defyer-100l-v1": "Wilson Defyer 100L v1",
  "defyer-100ul-v1": "Wilson Defyer 100UL v1",
  "blade-pro-98-v10": "Wilson Blade 98 Pro 16x19 v10",
  "blade-pro-98-18x20-v10": "Wilson Blade 98 Pro 18x20 v10",
  "blade-pro-100-v10": "Wilson Blade 100 Pro v10",
  "blade-v10": "Wilson Blade 98 16x19 v10",
  "blade-98-18x20-v10": "Wilson Blade 98 18x20 v10",
  "blade-v9": "Wilson Blade 98 16x19 v9",
  "blade-98-18x20-v9": "Wilson Blade 98 18x20 v9",
  "blade-v8": "Wilson Blade 98 16x19 v8",
  "blade-98-18x20-v8": "Wilson Blade 98 18x20 v8",
  "blade-v7": "Wilson Blade 98 v7",
  "blade-100-v10": "Wilson Blade 100 v10",
  "blade-100l-v10": "Wilson Blade 100L v10",
  "blade-100ul-v10": "Wilson Blade 100UL v10",
  "blade-104-v10": "Wilson Blade 104 v10",
  "blade-100-v9": "Wilson Blade 100 v9",
  "clash-100-pro": "Wilson Clash 100 Pro v3",
  "clash-100l-v3": "Wilson Clash 100L v3",
  "clash-100ul-v3": "Wilson Clash 100UL v3",
  "clash-108-v3": "Wilson Clash 108 v3",
  "clash-100-pro-v2": "Wilson Clash 100 Pro v2",
  "clash-100-v2": "Wilson Clash 100 v2",
  "clash-100l-v2": "Wilson Clash 100L v2",
  "clash-98-v2": "Wilson Clash 98 v2",
  "clash-100ul-v2": "Wilson Clash 100UL v2",
  "clash-108-v2": "Wilson Clash 108 v2",
  "clash-100-tour-v1": "Wilson Clash 100 Tour v1",
  "clash-100-v1": "Wilson Clash 100 v1",
  "clash-98-v1": "Wilson Clash 98 v1",
  "clash-100l-v1": "Wilson Clash 100L v1",
  "clash-100ul-v1": "Wilson Clash 100UL v1",
  "clash-108-v1": "Wilson Clash 108 v1",
  "ultra-100-v5": "Wilson Ultra 100 v5",
  "ultra-99-pro-v5": "Wilson Ultra 99 Pro v5",
  "ultra-100l-v5": "Wilson Ultra 100L v5",
  "ultra-100ul-v5": "Wilson Ultra 100UL v5",
  "ultra-111-v5": "Wilson Ultra 111 v5",
  "pro-staff-x": "Wilson Pro Staff X v14",
  "pro-staff-97-classic": "Wilson Pro Staff 97 Classic (2026)",
  "pro-staff-97l-classic": "Wilson Pro Staff 97L Classic (2026)",
  "pro-staff-team-classic": "Wilson Pro Staff Team Classic (2026)",
  "pro-staff-rf97-v13": "Wilson Pro Staff RF97 v13",
  "rf-01": "Wilson RF 01",
  "shift-99": "Wilson Shift 99 v1",
  "ezone-98": "Yonex EZONE 98 (2025)",
  "ezone-98l": "Yonex EZONE 98L (2025)",
  "ezone-98-tour": "Yonex EZONE 98 Tour",
  "ezone-98-plus": "Yonex EZONE 98+",
  "ezone-98-2022": "Yonex EZONE 98 7th Gen (2022)",
  "ezone-100": "Yonex EZONE 100 (2025)",
  "ezone-100l": "Yonex EZONE 100L (2025)",
  "ezone-100sl": "Yonex EZONE 100SL 8th Gen",
  "ezone-alpha": "Yonex EZONE Alpha 8th Gen",
  "ezone-100-plus": "Yonex EZONE 100+ (2025)",
  "ezone-105": "Yonex EZONE 105",
  "vcore-95": "Yonex VCORE 95",
  "vcore-98l": "Yonex VCORE 98L (2026)",
  "vcore-98-plus": "Yonex VCORE 98+ (2026)",
  "vcore-98-tour": "Yonex VCORE 98 Tour",
  "vcore-98-2023": "Yonex VCORE 98 7th Gen (2023)",
  "vcore-100d": "Yonex VCORE 100D",
  "vcore-100l": "Yonex VCORE 100L (2026)",
  "vcore-100-plus": "Yonex VCORE 100+ (2026)",
  "vcore-alpha": "Yonex VCORE Alpha 8th Gen",
  "vcore-ace": "Yonex VCORE ACE 8th Gen",
  "vcore-play": "Yonex VCORE Play 8th Gen",
  "percept-100": "Yonex Percept 100",
  "percept-100d": "Yonex Percept 100D",
  "percept-97d": "Yonex Percept 97D",
  "percept-97h": "Yonex Percept 97H",
  "vcore-pro-97-2021": "Yonex VCORE Pro 97 (2021)",
  "muse-98": "Yonex MUSE 98",
  "muse-100": "Yonex MUSE 100",
  "muse-100l": "Yonex MUSE 100L",
  "muse-100sl": "Yonex MUSE 100SL",
  "muse-107": "Yonex MUSE 107",
  "pure-aero-98": "Babolat Pure Aero 98 Gen9 (2026)",
  "pure-aero-100": "Babolat Pure Aero 100 Gen9 (2026)",
  "pure-aero-team-2026": "Babolat Pure Aero Team Gen9 (2026)",
  "pure-aero-lite-2026": "Babolat Pure Aero Lite Gen9 (2026)",
  "pure-aero-super-lite-2026": "Babolat Pure Aero Super Lite Gen9 (2026)",
  "pure-aero-2023": "Babolat Pure Aero (2023)",
  "pure-aero-rafa-2023": "Babolat Pure Aero Rafa (2023)",
  "pure-aero-vs": "Babolat Pure Aero VS",
  "aeropro-drive": "Babolat AeroPro Drive",
  "pure-control-tour": "Babolat Pure Control Tour",
  "pure-aero-plus": "Babolat Pure Aero+ Gen9 (2026)",
  "pure-aero-rafa-origin": "Babolat Pure Aero Rafa Origin",
  "boost-aero-2026": "Babolat Boost Aero (2026)",
  "boost-strike-2026": "Babolat Boost Strike (2026)",
  "boost-wimbledon-2026": "Babolat Boost Wimbledon (2026)",
  "evo-aero-gen2": "Babolat Evo Aero Gen2",
  "evo-drive-gen2": "Babolat Evo Drive Gen2",
  "clash-100": "Wilson Clash 100 v3",
  "vcore-98": "Yonex VCORE 98 (2026)",
  "vcore-100": "Yonex VCORE 100 8th Gen",
  "pure-drive-98": "Babolat Pure Drive 98",
  "pure-drive-100": "Babolat Pure Drive (2025)",
  "pure-drive-team-2025": "Babolat Pure Drive Team Gen11 (2025)",
  "pure-drive-lite-2025": "Babolat Pure Drive Lite Gen11 (2025)",
  "pure-drive-107-2025": "Babolat Pure Drive 107 Gen11 (2025)",
  "pure-drive-2021": "Babolat Pure Drive (2021)",
  "pure-drive-plus": "Babolat Pure Drive+",
  "pure-strike-97": "Babolat Pure Strike 97",
  "pure-strike-98": "Babolat Pure Strike 98 16x19",
  "pure-strike-98-18x20": "Babolat Pure Strike 98 18x20",
  "pure-strike-100": "Babolat Pure Strike 100",
  "pure-strike-100-16x20": "Babolat Pure Strike 100 16x20",
  "pro-staff-97": "Wilson Pro Staff 97 v14",
  "percept-97": "Yonex Percept 97",
  "speed-mp": "Head Speed MP 2026",
  "speed-mp-l-2026": "Head Speed MP L 2026",
  "speed-mp-ul-2026": "Head Speed MP UL 2026",
  "speed-team-2026": "Head Speed Team 2026",
  "speed-elite-2026": "Head Speed Elite 2026",
  "speed-mp-2024": "Head Speed MP 2024",
  "speed-pro-2024": "Head Speed Pro 2024",
  "speed-tour": "Head Speed Tour 2026",
  "gravity-pro-2025": "Head Gravity Pro 2025",
  "gravity-mp-2025": "Head Gravity MP 2025",
  "gravity-mp-l-2025": "Head Gravity MP L 2025",
  "gravity-team-2025": "Head Gravity Team 2025",
  "gravity-pro-2023": "Head Gravity Pro 2023",
  "gravity-mp-2023": "Head Gravity MP 2023",
  "tf40-290": "Tecnifibre TF40 290",
  "tf40-305": "Tecnifibre TF40 305 16x19",
  "tf40-305-18x20": "Tecnifibre TF40 305 18x20",
  "tf40-315": "Tecnifibre TF40 315",
  "tfight-285": "Tecnifibre T-Fight 285",
  "tfight-300": "Tecnifibre T-Fight 300",
  "tfight-300s": "Tecnifibre T-Fight 300S",
  "tfight-305s": "Tecnifibre T-Fight 305S",
  "tfight-315s": "Tecnifibre T-Fight 315S",
  "tfight-iso-305": "Tecnifibre T-Fight ISO 305",
  "fire-305s": "Tecnifibre FIRE 305S (2026)",
  "fire-300": "Tecnifibre FIRE 300 (2026)",
  "fire-285": "Tecnifibre FIRE 285 (2026)",
  "fire-270": "Tecnifibre FIRE 270 (2026)",
  "tfx1-300": "Tecnifibre TF-X1 300",
  "tfx1-285": "Tecnifibre TF-X1 285",
  "tfx1-305": "Tecnifibre TF-X1 305",
  "tempo-298": "Tecnifibre Tempo 298",
  "tempo-285": "Tecnifibre Tempo 285",
  "radical-mp-2025": "Head Radical MP 2025",
  "radical-pro-2025": "Head Radical Pro 2025",
  "radical-team-2025": "Head Radical Team 2025",
  "radical-elite-2025": "Head Radical Elite 2025",
  "radical-mp-2023": "Head Radical MP 2023",
  "radical-pro-2023": "Head Radical Pro 2023",
  "speed-pro-2026": "Head Speed Pro 2026",
  "extreme-pro-2026": "Head Extreme Pro 2026",
  "extreme-mp-2026": "Head Extreme MP 2026",
  "extreme-mp-xl-2026": "Head Extreme MP XL 2026",
  "extreme-mp-l-2026": "Head Extreme MP L 2026",
  "extreme-mp-ul-2026": "Head Extreme MP UL 2026",
  "extreme-team-2026": "Head Extreme Team 2026",
  "extreme-elite-2026": "Head Extreme Elite 2026",
  "boom-pro": "Head Boom Pro 2026",
  "boom-mp": "Head Boom MP 2026",
  "boom-mp-l-2026": "Head Boom MP L 2026",
  "boom-mp-ul-2026": "Head Boom MP UL 2026",
  "boom-team-2026": "Head Boom Team 2026",
  "boom-elite-2026": "Head Boom Elite 2026",
  "boom-pro-2022": "Head Boom Pro 2022",
  "boom-mp-2022": "Head Boom MP 2022",
  "prestige-pro": "Head Prestige Pro 2023",
  "prestige-tour": "Head Prestige Tour 2023",
  "prestige-mp-2023": "Head Prestige MP 2023",
  "instinct-mp": "Head Instinct MP",
  "instinct-pwr-110-2025": "Head Instinct PWR 110 2025",
  "instinct-pwr-115-2025": "Head Instinct PWR 115 2025",
  "instinct-team-l-2025": "Head Instinct Team L 2025",
  "extreme-tour-2022": "Head Extreme Tour 2022",
  "rf-01-pro": "Wilson RF 01 Pro",
  "gravity-tour-2025": "Head Gravity Tour 2025",
  "squared-2026": "Head SQUARED 2026",
  "ig-speed-xceed-2026": "Head IG Speed XCEED 2026",
  "ig-boom-xceed-2026": "Head IG Boom XCEED 2026",
  "ig-gravity-xceed-2026": "Head IG Gravity XCEED 2026",
  "ig-radical-xceed-2026": "Head IG Radical XCEED 2026",
  "dunlop-cx-200": "Dunlop CX 200",
  "dunlop-cx-200-tour-16x19": "Dunlop CX 200 Tour 16x19",
  "dunlop-cx-200-tour-18x20": "Dunlop CX 200 Tour 18x20",
  "dunlop-cx-400": "Dunlop CX 400",
  "dunlop-cx-400-tour": "Dunlop CX 400 Tour",
  "dunlop-fx-500-lite-2026": "Dunlop FX 500 Lite 2026",
  "prince-vortex-100-310": "Prince Vortex 100 310g",
  "prince-vortex-100-300": "Prince Vortex 100 300g",
  "prince-tour-100p-305": "Prince ATS Textreme Tour 100P 305g",
  "prince-o3-ripstick-100-280": "Prince O3 RipStick 100 280g",
  "prince-legacy-110": "Prince Legacy 110",
  "prince-warrior-100-265": "Prince Warrior 100 265g",
  "volkl-c10-evo": "Volkl C10 EVO",
  "volkl-v1-evo": "Volkl V1 EVO",
  "volkl-v1-classic": "Volkl V1 Classic",
  "volkl-vcell-v1-mp": "Volkl V-Cell V1 MP",
  "volkl-vcell-10-320": "Volkl V-Cell 10 320g",
  "volkl-vcell-10-300": "Volkl V-Cell 10 300g",
};

const targets = {
  "defyer-98-pro-v1": 340, "defyer-100-v1": 300, "defyer-100l-v1": 285, "defyer-100ul-v1": 260,
  "blade-pro-98-v10": 325, "blade-pro-98-18x20-v10": 325, "blade-pro-100-v10": 315,
  "blade-v10": 275, "blade-98-18x20-v10": 275, "blade-v9": 275, "blade-98-18x20-v9": 275,
  "blade-v8": 225, "blade-98-18x20-v8": 225,
  "blade-100-v10": 275, "blade-100l-v10": 250, "blade-100ul-v10": 230, "blade-104-v10": 260,
  "blade-v7": 190, "blade-100-v9": 230,
  "clash-100-pro": 275, "clash-100l-v3": 235, "clash-100ul-v3": 210, "clash-108-v3": 240,
  "clash-100-pro-v2": 225, "clash-100-v2": 200, "clash-100l-v2": 185, "clash-98-v2": 215, "clash-100ul-v2": 170, "clash-108-v2": 180,
  "clash-100-tour-v1": 175, "clash-100-v1": 160, "clash-98-v1": 175, "clash-100l-v1": 145, "clash-100ul-v1": 130, "clash-108-v1": 145,
  "ultra-100-v5": 275, "ultra-99-pro-v5": 300,
  "ultra-100l-v5": 245, "ultra-100ul-v5": 225, "ultra-111-v5": 230,
  "pro-staff-x": 285, "pro-staff-97-classic": 300, "pro-staff-97l-classic": 255, "pro-staff-team-classic": 230,
  "pro-staff-rf97-v13": 240, "rf-01": 285, "shift-99": 275,
  "ezone-98": 300, "ezone-98l": 260, "ezone-98-tour": 300, "ezone-98-plus": 285, "ezone-98-2022": 220,
  "ezone-100": 260, "ezone-100l": 250, "ezone-100sl": 230, "ezone-alpha": 175, "ezone-100-plus": 285, "ezone-105": 260,
  "vcore-95": 285, "vcore-98l": 260, "vcore-98-plus": 285, "vcore-98-tour": 300, "vcore-98-2023": 220,
  "vcore-100d": 285, "vcore-100l": 250, "vcore-100-plus": 285, "vcore-alpha": 175, "vcore-ace": 150, "vcore-play": 130,
  "percept-100": 285, "percept-100d": 285, "percept-97d": 300, "percept-97h": 300, "vcore-pro-97-2021": 200,
  "muse-98": 300, "muse-100": 300, "muse-100l": 285, "muse-100sl": 265, "muse-107": 285,
  "pure-aero-98": 300, "pure-aero-100": 260, "pure-aero-team-2026": 250, "pure-aero-lite-2026": 230, "pure-aero-super-lite-2026": 220,
  "pure-aero-2023": 220, "pure-aero-rafa-2023": 225,
  "pure-aero-vs": 210, "aeropro-drive": 175, "pure-control-tour": 175,
  "pure-aero-plus": 275, "pure-aero-rafa-origin": 285,
  "boost-aero-2026": 135, "boost-strike-2026": 135, "boost-wimbledon-2026": 145,
  "evo-aero-gen2": 220, "evo-drive-gen2": 220,
  "clash-100": 250, "vcore-98": 275, "vcore-100": 260,
  "pure-drive-98": 275, "pure-drive-100": 260, "pure-drive-team-2025": 240, "pure-drive-lite-2025": 225, "pure-drive-107-2025": 240,
  "pure-drive-2021": 210, "pure-drive-plus": 275,
  "pure-strike-97": 285, "pro-staff-97": 275,
  "pure-strike-98": 285, "pure-strike-98-18x20": 285, "pure-strike-100": 275, "pure-strike-100-16x20": 275, "percept-97": 275,
  "speed-mp": 275, "speed-mp-l-2026": 250, "speed-mp-ul-2026": 230,
  "speed-team-2026": 225, "speed-elite-2026": 195, "speed-mp-2024": 220, "speed-pro-2024": 235,
  "speed-tour": 285, "gravity-pro-2025": 285, "gravity-mp-2025": 260, "gravity-mp-l-2025": 245, "gravity-team-2025": 225,
  "gravity-pro-2023": 225, "gravity-mp-2023": 210,
  "tf40-290": 230, "tf40-305": 260, "tf40-305-18x20": 260, "tf40-315": 265, "tfight-285": 230, "tfight-300": 250,
  "tfight-300s": 275, "tfight-305s": 285, "tfight-315s": 285, "tfight-iso-305": 210,
  "fire-305s": 275, "fire-300": 260, "fire-285": 240, "fire-270": 215,
  "tfx1-300": 260, "tfx1-285": 225, "tfx1-305": 250, "tempo-298": 260, "tempo-285": 220,
  "radical-mp-2025": 260, "radical-pro-2025": 285, "radical-team-2025": 225, "radical-elite-2025": 160,
  "radical-mp-2023": 210, "radical-pro-2023": 225,
  "speed-pro-2026": 275,
  "extreme-pro-2026": 285, "extreme-mp-2026": 275, "extreme-mp-xl-2026": 285,
  "extreme-mp-l-2026": 250, "extreme-mp-ul-2026": 230, "extreme-team-2026": 225, "extreme-elite-2026": 195,
  "boom-pro": 285, "boom-mp": 275, "boom-mp-l-2026": 250, "boom-mp-ul-2026": 230, "boom-team-2026": 225,
  "boom-elite-2026": 160,
  "boom-pro-2022": 205, "boom-mp-2022": 190,
  "prestige-pro": 285, "prestige-tour": 285, "prestige-mp-2023": 245, "instinct-mp": 250,
  "instinct-pwr-110-2025": 220, "instinct-pwr-115-2025": 220, "instinct-team-l-2025": 205,
  "extreme-tour-2022": 210,
  "rf-01-pro": 300,
  "gravity-tour-2025": 275, "squared-2026": 275,
  "ig-speed-xceed-2026": 135, "ig-boom-xceed-2026": 135, "ig-gravity-xceed-2026": 135, "ig-radical-xceed-2026": 135,
  "dunlop-cx-200": 220, "dunlop-cx-200-tour-16x19": 230, "dunlop-cx-200-tour-18x20": 230,
  "dunlop-cx-400": 210, "dunlop-cx-400-tour": 225, "dunlop-fx-500-lite-2026": 210,
  "prince-vortex-100-310": 200, "prince-vortex-100-300": 195, "prince-tour-100p-305": 200,
  "prince-o3-ripstick-100-280": 175, "prince-legacy-110": 155, "prince-warrior-100-265": 155,
  "volkl-c10-evo": 225, "volkl-v1-evo": 210, "volkl-v1-classic": 210,
  "volkl-vcell-v1-mp": 210, "volkl-vcell-10-320": 225, "volkl-vcell-10-300": 220,
};
const statePath = new URL("../.data/baseline-monitor.json", import.meta.url);
const apifyFacebookCachePath = new URL("../.data/apify-facebook-used.json", import.meta.url);

const manufacturerModelCodes = new Map([
  ["WR207811", "blade-v10"], ["WR207911", "blade-98-18x20-v10"],
  ["WR149811", "blade-v9"], ["WR149911", "blade-98-18x20-v9"],
  ["WR078711", "blade-v8"], ["WR078811", "blade-98-18x20-v8"],
  ["101574", "pure-strike-97"], ["101576", "pure-strike-100-16x20"], ["101579", "pure-strike-100"],
  ["101577", "pure-strike-98"], ["101524", "pure-strike-98"], ["101406", "pure-strike-98"],
  ["101578", "pure-strike-98-18x20"], ["101526", "pure-strike-98-18x20"], ["101404", "pure-strike-98-18x20"],
  ["14TF44056", "tf40-305"], ["14TF43056", "tf40-305"],
  ["14TF44058", "tf40-305-18x20"], ["14TF43058", "tf40-305-18x20"],
]);

function manufacturerModelKey(evidence) {
  const compact = String(evidence ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return [...manufacturerModelCodes].find(([code]) => compact.includes(code))?.[1] ?? null;
}

function hasStringPattern(evidence, mains, crosses) {
  return new RegExp(`(?:^|[^0-9])${mains}\\s*(?:x|×|/|by)\\s*${crosses}(?:$|[^0-9])`, "i").test(String(evidence));
}

function classify(title) {
  const codeMatch = manufacturerModelKey(title);
  if (codeMatch) return codeMatch;
  const raw = title.toLowerCase();
  const value = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (/\b(demo|used|grommet|junior|jr)\b/.test(value)) return null;
  if (/dunlop cx 200 tour/.test(value) && hasStringPattern(raw, 18, 20)) return "dunlop-cx-200-tour-18x20";
  if (/dunlop cx 200 tour/.test(value)) return "dunlop-cx-200-tour-16x19";
  if (/dunlop cx 400 tour/.test(value)) return "dunlop-cx-400-tour";
  if (/dunlop cx 400/.test(value)) return "dunlop-cx-400";
  if (/dunlop cx 200/.test(value)) return "dunlop-cx-200";
  if (/dunlop fx 500 lite/.test(value)) return "dunlop-fx-500-lite-2026";
  if (/prince vortex 100/.test(value) && /310\s*g/.test(value)) return "prince-vortex-100-310";
  if (/prince vortex 100/.test(value) && /300\s*g/.test(value)) return "prince-vortex-100-300";
  if (/prince.*(?:ats textreme )?tour 100p/.test(value)) return "prince-tour-100p-305";
  if (/prince.*(?:o3 )?ripstick 100/.test(value)) return "prince-o3-ripstick-100-280";
  if (/prince legacy 110/.test(value)) return "prince-legacy-110";
  if (/prince warrior 100/.test(value)) return "prince-warrior-100-265";
  if (/volkl c10 evo/.test(value)) return "volkl-c10-evo";
  if (/volkl v1 evo/.test(value)) return "volkl-v1-evo";
  if (/volkl v1 classic/.test(value)) return "volkl-v1-classic";
  if (/volkl v cell v1 mp/.test(value)) return "volkl-vcell-v1-mp";
  if (/volkl v cell 10/.test(value) && /320\s*g/.test(value)) return "volkl-vcell-10-320";
  if (/volkl v cell 10/.test(value) && /300\s*g/.test(value)) return "volkl-vcell-10-300";
  if (/defyer 98 pro\b/.test(value)) return "defyer-98-pro-v1";
  if (/defyer 100ul\b|defyer 100 ul\b/.test(value)) return "defyer-100ul-v1";
  if (/defyer 100l\b|defyer 100 l\b/.test(value)) return "defyer-100l-v1";
  if (/ultra 100ul\b.*\bv5\b|ultra 100 ul\b.*\bv5\b/.test(value)) return "ultra-100ul-v5";
  if (/ultra 100l\b.*\bv5\b|ultra 100 l\b.*\bv5\b/.test(value)) return "ultra-100l-v5";
  if (/ultra 111\b.*\bv5\b/.test(value)) return "ultra-111-v5";
  if (/blade/.test(value) && /(?:pro 98|98 pro)/.test(value) && hasStringPattern(raw, 18, 20) && /\bv10\b/.test(value)) return "blade-pro-98-18x20-v10";
  if (/blade 98\b/.test(value) && hasStringPattern(raw, 18, 20) && /\bv10\b/.test(value)) return "blade-98-18x20-v10";
  if (/blade 98\b/.test(value) && hasStringPattern(raw, 18, 20) && /\bv9\b/.test(value)) return "blade-98-18x20-v9";
  if (/blade 98\b/.test(value) && hasStringPattern(raw, 18, 20) && /\bv8\b/.test(value)) return "blade-98-18x20-v8";
  if (/blade 100ul\b.*\bv10\b|blade 100 ul\b.*\bv10\b/.test(value)) return "blade-100ul-v10";
  if (/blade 100l\b.*\bv10\b|blade 100 l\b.*\bv10\b/.test(value)) return "blade-100l-v10";
  if (/pro staff 97l classic\b/.test(value)) return "pro-staff-97l-classic";
  if (/pro staff 97 classic\b/.test(value)) return "pro-staff-97-classic";
  if (/pro staff team classic\b/.test(value)) return "pro-staff-team-classic";
  if (/ezone 98l\b|ezone 98 l\b/.test(value)) return "ezone-98l";
  if (/ezone 100l\b|ezone 100 l\b/.test(value)) return "ezone-100l";
  if (/ezone 100sl\b|ezone 100 sl\b/.test(value)) return "ezone-100sl";
  if (/ezone alpha\b/.test(value)) return "ezone-alpha";
  if (/vcore 98l\b|vcore 98 l\b/.test(value)) return "vcore-98l";
  if (/vcore 100l\b|vcore 100 l\b/.test(value)) return "vcore-100l";
  if (/vcore alpha\b/.test(value)) return "vcore-alpha";
  if (/vcore ace\b/.test(value)) return "vcore-ace";
  if (/vcore play\b/.test(value)) return "vcore-play";
  if (/pure drive team\b.*\b(?:2025|gen ?11)\b/.test(value)) return "pure-drive-team-2025";
  if (/pure drive lite\b.*\b(?:2025|gen ?11)\b/.test(value)) return "pure-drive-lite-2025";
  if (/pure drive 107\b.*\b(?:2025|gen ?11)\b/.test(value)) return "pure-drive-107-2025";
  if (/pure aero team\b.*\b(?:2026|gen ?9)\b/.test(value)) return "pure-aero-team-2026";
  if (/pure aero (?:s ?lite|super l(?:ite|ight))\b.*\b(?:2026|gen ?9)\b/.test(value)) return "pure-aero-super-lite-2026";
  if (/pure aero lite\b.*\b(?:2026|gen ?9)\b/.test(value)) return "pure-aero-lite-2026";
  if (/muse 100\s*l\b/.test(value)) return "muse-100l";
  if (/muse 100\s*(?:sl|s l|super light)\b/.test(value)) return "muse-100sl";
  if (/muse 107\b/.test(value)) return "muse-107";
  if (/speed mp ul\b.*\b2026\b/.test(value)) return "speed-mp-ul-2026";
  if (/speed mp l\b.*\b2026\b/.test(value)) return "speed-mp-l-2026";
  if (/speed team\b.*\b2026\b/.test(value)) return "speed-team-2026";
  if (/speed elite\b.*\b2026\b/.test(value)) return "speed-elite-2026";
  if (/ig speed xceed\b/.test(value)) return "ig-speed-xceed-2026";
  if (/ig boom xceed\b/.test(value)) return "ig-boom-xceed-2026";
  if (/ig gravity xceed\b/.test(value)) return "ig-gravity-xceed-2026";
  if (/ig radical xceed\b/.test(value)) return "ig-radical-xceed-2026";
  if (/gravity mp l\b.*\b2025\b/.test(value)) return "gravity-mp-l-2025";
  if (/gravity team\b.*\b2025\b/.test(value)) return "gravity-team-2025";
  if (/radical team\b.*\b2025\b/.test(value)) return "radical-team-2025";
  if (/radical elite\b.*\b2025\b/.test(value)) return "radical-elite-2025";
  if (/instinct pwr 110\b.*\b2025\b/.test(value)) return "instinct-pwr-110-2025";
  if (/instinct pwr 115\b.*\b2025\b/.test(value)) return "instinct-pwr-115-2025";
  if (/instinct team l\b.*\b2025\b/.test(value)) return "instinct-team-l-2025";
  if (/extreme mp xl\b.*\b2026\b/.test(value)) return "extreme-mp-xl-2026";
  if (/extreme mp ul\b.*\b2026\b/.test(value)) return "extreme-mp-ul-2026";
  if (/extreme mp l\b.*\b2026\b/.test(value)) return "extreme-mp-l-2026";
  if (/extreme team\b.*\b2026\b/.test(value)) return "extreme-team-2026";
  if (/extreme elite\b.*\b2026\b/.test(value)) return "extreme-elite-2026";
  if (/boom mp ul\b.*\b2026\b/.test(value)) return "boom-mp-ul-2026";
  if (/boom mp l\b.*\b2026\b/.test(value)) return "boom-mp-l-2026";
  if (/boom mp l neon\b/.test(value)) return "boom-mp-l-2026";
  if (/boom team\b.*\b2026\b/.test(value)) return "boom-team-2026";
  if (/boom elite\b/.test(value)) return "boom-elite-2026";
  if (/(?:head )?squared\b/.test(value)) return "squared-2026";
  if (/boost wimbledon\b.*\b2026\b/.test(value)) return "boost-wimbledon-2026";
  if (/boost aero\b/.test(value)) return "boost-aero-2026";
  if (/boost strike\b/.test(value)) return "boost-strike-2026";
  if (/evo aero\b.*\b(?:gen ?2|2026)\b/.test(value)) return "evo-aero-gen2";
  if (/evo drive\b.*\b(?:gen ?2|2025|2026)\b/.test(value)) return "evo-drive-gen2";
  if (/\bclash\b/.test(value) && /\b(?:x2|2 pack|two pack|bundle)\b/.test(value)) return null;
  if (/clash (?:100 )?pro\b.*\b(?:v ?3|2025)\b/.test(value) || /clash pro 100\b.*\b(?:v ?3|2025)\b/.test(value)) return "clash-100-pro";
  if (/clash 100 ?ul\b.*\b(?:v ?3|2025)\b/.test(value)) return "clash-100ul-v3";
  if (/clash 100 ?l\b.*\b(?:v ?3|2025)\b/.test(value)) return "clash-100l-v3";
  if (/clash 108\b.*\b(?:v ?3|2025)\b/.test(value)) return "clash-108-v3";
  if (/clash 100\b.*\b(?:v ?3|2025)\b/.test(value)) return "clash-100";
  if (/clash (?:100 )?pro\b.*\b(?:v ?2|2022)\b/.test(value)) return "clash-100-pro-v2";
  if (/clash 100 ?ul\b.*\b(?:v ?2|2022)\b/.test(value)) return "clash-100ul-v2";
  if (/clash 100 ?l\b.*\b(?:v ?2|2022)\b/.test(value)) return "clash-100l-v2";
  if (/clash 108\b.*\b(?:v ?2|2022)\b/.test(value)) return "clash-108-v2";
  if (/clash 98\b.*\b(?:v ?2|2022)\b/.test(value)) return "clash-98-v2";
  if (/clash 100\b.*\b(?:v ?2|2022)\b/.test(value)) return "clash-100-v2";
  if (/clash 100 tour\b/.test(value)) return "clash-100-tour-v1";
  if (/clash 100 ?ul\b.*\b(?:v ?1|2019)\b/.test(value)) return "clash-100ul-v1";
  if (/clash 100 ?l\b.*\b(?:v ?1|2019)\b/.test(value)) return "clash-100l-v1";
  if (/clash 108\b.*\b(?:v ?1|2019)\b/.test(value)) return "clash-108-v1";
  if (/clash 98\b.*\b(?:v ?1|2019)\b/.test(value)) return "clash-98-v1";
  if (/clash 100\b.*\b(?:v ?1|2019)\b/.test(value)) return "clash-100-v1";
  if (/\b(98l|100l|100 l|100ul|100 ul|100sl|100 sl|mp l|team|lite|x2|2 pack)\b/.test(value)) return null;
  if (/pure drive (?:107|110)\b/.test(value)) return null;
  if (/defyer 100\b/.test(value)) return "defyer-100-v1";
  if (/blade 100 pro\b.*\bv10\b|blade pro 100\b.*\bv10\b/.test(value)) return "blade-pro-100-v10";
  if (/blade 98 pro\b.*\bv10\b|blade pro 98\b.*\bv10\b/.test(value)) return "blade-pro-98-v10";
  if (/blade 100/.test(value) && /\bv10\b/.test(value)) return "blade-100-v10";
  if (/blade 104\b.*\bv10\b/.test(value)) return "blade-104-v10";
  if (/blade 100/.test(value) && /\bv9\b/.test(value)) return "blade-100-v9";
  if (/blade 98/.test(value) && /\bv10\b/.test(value)) return "blade-v10";
  if (/blade 98/.test(value) && /\bv9\b/.test(value)) return "blade-v9";
  if (/blade 98/.test(value) && /\bv8\b/.test(value)) return "blade-v8";
  if (/blade 98/.test(value) && /\bv7\b/.test(value)) return "blade-v7";
  if (/ultra 99 pro\b.*\bv5\b/.test(value)) return "ultra-99-pro-v5";
  if (/ultra 100\b.*\bv5\b/.test(value)) return "ultra-100-v5";
  if (/pro staff x\b/.test(value)) return "pro-staff-x";
  if (/pro staff rf ?97\b.*\bv13\b|rf ?97\b.*\bv13\b/.test(value)) return "pro-staff-rf97-v13";
  if (/rf 01 pro\b/.test(value)) return "rf-01-pro";
  if (/rf 01\b/.test(value)) return "rf-01";
  if (/shift 99\b/.test(value)) return "shift-99";
  if (/ezone 98\b.*\b(?:7th gen|2022)\b|07ezone 98\b/.test(value)) return "ezone-98-2022";
  if (/ezone 98 tour\b/.test(value)) return "ezone-98-tour";
  if (/ezone 98\s*(?:plus|\+)/.test(raw) || /ezone 98 plus\b/.test(value)) return "ezone-98-plus";
  if (/ezone 98\b/.test(value)) return "ezone-98";
  if (/ezone 105\b/.test(value)) return "ezone-105";
  if (/ezone 100\s*(?:plus|\+)/.test(raw) || /ezone 100 plus\b/.test(value)) return "ezone-100-plus";
  if (/ezone 100\b.*\b(?:8th gen|2025|2026|blast blue)\b/.test(value)) return "ezone-100";
  if (/vcore 98\b.*\b(?:7th gen|2023)\b|07vcore 98\b/.test(value)) return "vcore-98-2023";
  if (/vcore 98 tour\b/.test(value)) return "vcore-98-tour";
  if (/vcore 98\s*(?:plus|\+)/.test(raw) || /vcore 98 plus\b/.test(value)) return "vcore-98-plus";
  if (/vcore 95\b/.test(value)) return "vcore-95";
  if (/vcore 100d\b|vcore 100 d\b/.test(value)) return "vcore-100d";
  if (/vcore 100\s*(?:plus|\+)/.test(raw) || /vcore 100 plus\b/.test(value)) return "vcore-100-plus";
  if (/percept 97d\b|percept 97 d\b/.test(value)) return "percept-97d";
  if (/percept 97h\b|percept 97 h\b/.test(value)) return "percept-97h";
  if (/percept 100d\b|percept 100 d\b/.test(value)) return "percept-100d";
  if (/percept 100\b/.test(value)) return "percept-100";
  if (/vcore pro 97\b.*\b(?:2021|v ?3)\b/.test(value)) return "vcore-pro-97-2021";
  if (/muse 98\b/.test(value)) return "muse-98";
  if (/muse 100\s*l\b/.test(value)) return "muse-100l";
  if (/muse 100\s*(?:sl|s l|super light)\b/.test(value)) return "muse-100sl";
  if (/muse 107\b/.test(value)) return "muse-107";
  if (/muse 100\b/.test(value)) return "muse-100";
  if (/aeropro drive\b|aero pro drive\b/.test(value)) return "aeropro-drive";
  if (/pure control tour\b/.test(value)) return "pure-control-tour";
  if (/pure aero rafa origin\b/.test(value)) return "pure-aero-rafa-origin";
  if (/pure aero rafa\b.*\b(?:2023|6th gen)\b/.test(value)) return "pure-aero-rafa-2023";
  if (/pure aero vs\b/.test(value)) return "pure-aero-vs";
  if (/pure aero(?: 100)? (?:plus\b|\+)/.test(raw) || /pure aero plus\b/.test(value)) return "pure-aero-plus";
  if (/pure aero 98\b/.test(value)) return "pure-aero-98";
  if (/pure aero (?:s ?lite|super l(?:ite|ight))\b.*\b(?:2026|gen ?9|9th generation)\b/.test(value)) return "pure-aero-super-lite-2026";
  if (/pure aero(?: 100)?\b.*\b(?:2023|gen ?8|8th generation)\b/.test(value)) return "pure-aero-2023";
  if (/pure aero(?: 100)?\b.*\b(?:2026|gen ?9|9th generation)\b/.test(value)) return "pure-aero-100";
  if (/vcore 98\b/.test(value)) return "vcore-98";
  if (/vcore 100\b.*\b(?:8th gen|2026)\b/.test(value)) return "vcore-100";
  if (/pure drive(?: 100)? (?:plus\b|\+)/.test(raw) || /pure drive plus\b/.test(value)) return "pure-drive-plus";
  if (/pure drive 98\b/.test(value)) return "pure-drive-98";
  if (/pure drive(?: 100)? wimbledon\b.*\b2026\b/.test(value)) return "pure-drive-100";
  if (/pure drive(?: 100)?\b.*\b(?:2021|gen ?10|10th generation)\b/.test(value)) return "pure-drive-2021";
  if (/pure drive(?: 100)?\b.*\b(?:2025|gen 11|generation 11)\b/.test(value)) return "pure-drive-100";
  if (/pure strike 97\b/.test(value)) return "pure-strike-97";
  if (/pure strike 100\b/.test(value) && hasStringPattern(raw, 16, 20)) return "pure-strike-100-16x20";
  if (/pure strike 100\b/.test(value)) return "pure-strike-100";
  if (/pure strike (?:103|vs)\b/.test(value)) return null;
  if (/pure strike(?: 98)?\b/.test(value) && hasStringPattern(raw, 18, 20)) return "pure-strike-98-18x20";
  if (/pure strike(?: 98)?\b/.test(value) && hasStringPattern(raw, 16, 19)) return "pure-strike-98";
  if (/pure strike 98\b/.test(value)) return "pure-strike-98";
  if (/pure strike\b/.test(value)) return "pure-strike-98";
  if (/pro staff 97\b/.test(value)) return "pro-staff-97";
  if (/percept 97\b/.test(value)) return "percept-97";
  if (/speed pro 2024\b/.test(value)) return "speed-pro-2024";
  if (/speed mp 2024\b/.test(value)) return "speed-mp-2024";
  if (/speed tour\b/.test(value)) return "speed-tour";
  if (/speed mp\b/.test(value)) return "speed-mp";
  if (/gravity pro 2023\b/.test(value)) return "gravity-pro-2023";
  if (/gravity mp 2023\b/.test(value)) return "gravity-mp-2023";
  if (/gravity pro 2025\b/.test(value)) return "gravity-pro-2025";
  if (/gravity mp 2025\b/.test(value)) return "gravity-mp-2025";
  if (/t fight iso 305\b|tfight iso 305\b/.test(value)) return "tfight-iso-305";
  if (/t fight 315s\b|tfight 315s\b/.test(value)) return "tfight-315s";
  if (/t fight 305s\b|tfight 305s\b/.test(value)) return "tfight-305s";
  if (/t fight 300s\b|tfight 300s\b/.test(value)) return "tfight-300s";
  if (/t fight 300\b|tfight 300\b/.test(value)) return "tfight-300";
  if (/t fight 285\b|tfight 285\b/.test(value)) return "tfight-285";
  if (/tf x1(?: v2)? 305\b|tfx1(?: v2)? 305\b/.test(value)) return "tfx1-305";
  if (/tf x1(?: v2)? 285\b|tfx1(?: v2)? 285\b/.test(value)) return "tfx1-285";
  if (/tf x1 300\b|tfx1 300\b/.test(value)) return "tfx1-300";
  if (/tempo 298\b/.test(value)) return "tempo-298";
  if (/tempo 285\b/.test(value)) return "tempo-285";
  if (/tf 40 315\b|tf40 315\b/.test(value)) return "tf40-315";
  if ((/tf 40 305\b|tf40 305\b/.test(value)) && hasStringPattern(raw, 18, 20)) return "tf40-305-18x20";
  if (/tf 40 305\b|tf40 305\b/.test(value)) return "tf40-305";
  if (/tf 40 290\b|tf40 290\b/.test(value)) return "tf40-290";
  if (/fire 305s\b|fire 305 s\b/.test(value)) return "fire-305s";
  if (/fire 300\b/.test(value)) return "fire-300";
  if (/fire 285\b/.test(value)) return "fire-285";
  if (/fire 270\b/.test(value)) return "fire-270";
  if (/radical pro 2023\b/.test(value)) return "radical-pro-2023";
  if (/radical mp 2023\b/.test(value)) return "radical-mp-2023";
  if (/radical pro 2025\b/.test(value)) return "radical-pro-2025";
  if (/radical mp 2025\b/.test(value)) return "radical-mp-2025";
  if (/speed pro (?:2026|legend 2025)\b/.test(value)) return "speed-pro-2026";
  if (/extreme pro (?:2026|2024)\b/.test(value)) return "extreme-pro-2026";
  if (/extreme mp (?:2026|2024)\b/.test(value)) return "extreme-mp-2026";
  if (/extreme tour 2022\b/.test(value)) return "extreme-tour-2022";
  if (/boom pro 2022\b/.test(value)) return "boom-pro-2022";
  if (/boom mp 2022\b/.test(value)) return "boom-mp-2022";
  if (/boom pro\b/.test(value)) return "boom-pro";
  if (/boom mp\b/.test(value)) return "boom-mp";
  if (/prestige mp 2023\b/.test(value)) return "prestige-mp-2023";
  if (/prestige pro\b/.test(value)) return "prestige-pro";
  if (/prestige tour\b/.test(value)) return "prestige-tour";
  if (/instinct mp\b/.test(value)) return "instinct-mp";
  if (/gravity tour 2025\b/.test(value)) return "gravity-tour-2025";
  return null;
}

function classifyUsed(title) {
  if (/\b(pro ?stock|paint ?job|signed|autograph|replica)\b/i.test(title)) return null;
  if (/pure strike/i.test(title) && !/pure strike\s+(?:97|98|100)\b/i.test(title)) return null;
  return classify(title.replace(/\b(demo|used|pre[- ]owned|preowned|demo racquet|demo frame)\b/gi, " "));
}

function matchesGripSize(value, gripSize) {
  const normalized = value.toLowerCase().replaceAll("⅛", "1/8").replaceAll("¼", "1/4").replaceAll("⅜", "3/8").replaceAll("½", "1/2").replaceAll("⅝", "5/8");
  const number = gripSize.slice(1);
  return new RegExp(`(?:^|[^a-z0-9])(?:l|g|grip\\s*|size\\s*)${number}(?:$|[^0-9])`, "i").test(normalized)
    || (gripSize === "L0"
      ? /(?:^|[^0-9])4(?:[.]0)?\s*(?:in(?:ch(?:es)?)?|\")?(?:$|[^0-9/])/.test(normalized)
      : normalized.includes(gripMeasurements[gripSize]));
}

function isGripThree(value) {
  return matchesGripSize(value, targetGripSize);
}

function specialEditionName(title) {
  const editions = [
    [/\bconcept edition\b|\bredline\b/i, "Concept Edition"],
    [/\bneon\b/i, "Neon"],
    [/session de soir[eé]e|night session/i, "Night Session"],
    [/roland garros|french open|\bRG\b/i, "Roland Garros"],
    [/wimbledon/i, "Wimbledon"],
    [/\bus open\b/i, "US Open"],
    [/\blegend\b/i, "Legend"],
    [/\breverse\b/i, "Reverse"],
    [/\bnoir\b|blackout/i, "Noir / Blackout"],
    [/\b(?:30th|100th)\b|anniversary|centennial/i, "Anniversary"],
    [/limited edition|\bLTD\b|special edition/i, "Limited edition"],
    [/rafa origin/i, "Rafa Origin"],
    [/aqua night/i, "Aqua Night"],
    [/naomi osaka|\bosaka\b/i, "Naomi Osaka"],
    [/laver cup/i, "Laver Cup"],
    [/stars?\s*(?:&|and)\s*stripes/i, "Stars & Stripes"],
    [/\bsakura\b/i, "Sakura"],
  ];
  return editions.find(([pattern]) => pattern.test(title))?.[1] ?? null;
}

function offerGripSizes(title, evidenceValues) {
  const evidence = evidenceValues.join(" ");
  return Object.keys(gripMeasurements).filter((gripSize) => matchesGripSize(evidence, gripSize));
}

function mergeOffersById(offers) {
  const merged = new Map();
  for (const offer of offers) {
    const existing = merged.get(offer.id);
    if (!existing) {
      merged.set(offer.id, { ...offer, gripSizes: [...new Set(offer.gripSizes ?? [])] });
      continue;
    }
    const price = Math.min(existing.price ?? Infinity, offer.price ?? Infinity);
    const comparePrices = [existing.compareAtPrice, offer.compareAtPrice]
      .filter((candidate) => Number.isFinite(candidate) && candidate > price);
    merged.set(offer.id, {
      ...existing,
      price,
      compareAtPrice: comparePrices.length ? Math.min(...comparePrices) : null,
      gripSizes: [...new Set([...(existing.gripSizes ?? []), ...(offer.gripSizes ?? [])])],
    });
  }
  return [...merged.values()];
}

function isAccessory(title) {
  return /\b(demo|used|grommet|junior|jr|bag|cover|case|string|grip|overgrip|shoe|sock|apparel|hat)\b/i.test(title);
}

function plainText(value = "") {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replaceAll("&nbsp;", " ").replaceAll("&amp;", "&")
    .replaceAll("&sup2;", "²").replaceAll("&#178;", "²")
    .replace(/\s+/g, " ").trim();
}

function officialImageUrl(value, sourceUrl) {
  const html = String(value ?? "");
  const candidates = [
    ...[...html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/gi)].map((match) => match[1]),
    ...[...html.matchAll(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/gi)].map((match) => match[1]),
    ...[...html.matchAll(/"(?:image|image_url|src)"\s*:\s*"(https?:\\?\/\\?\/[^"\\]+(?:\\.[^"\\]*)?)"/gi)].map((match) => match[1].replaceAll("\\/", "/")),
  ];
  for (const candidate of candidates) {
    try {
      const url = new URL(decodeHtmlAttribute(candidate), sourceUrl);
      if (url.protocol !== "https:" || /(?:logo|icon|sprite|placeholder|swatch)/i.test(url.pathname) || /\.svg(?:$|\?)/i.test(url.href)) continue;
      return url.href;
    } catch { /* Ignore malformed image metadata. */ }
  }
  return undefined;
}

function extractRacquetSpecs(value, source, sourceUrl) {
  const text = plainText(value);
  const imageUrl = /official/i.test(source) ? officialImageUrl(value, sourceUrl) : undefined;
  const head = text.match(/(?:head\s*size|tamis|racquet\s*face)[^0-9]{0,90}(?:\d{3,4}\s*cm\s*[²2]\s*[/|·-]\s*)?(\d{2,3})\s*(?:sq\.?\s*in\.?|in\s*[²2])/i)?.[1]
    ?? text.match(/head\s*\(\s*sq\.?\s*in\.?\s*\)[^0-9]{0,30}(\d{2,3})/i)?.[1];
  const weight = text.match(/(?:unstrung\s*weight|weight\s*\(\s*unstrung\s*\)|poids\s*non\s*cord[ée])[\s\S]{0,80}?(\d{3})\s*g\b/i)?.[1]
    ?? text.match(/(?:weight|poids)[^0-9]{0,55}(\d{3})\s*g\b(?![^.]{0,25}\bstrung\b)/i)?.[1];
  const strungWeight = text.match(/(?:^|[^a-z])strung\s*weight[\s\S]{0,80}?(\d{3})\s*g\b/i)?.[1]
    ?? text.match(/weight\s*\(\s*strung\s*\)[^0-9]{0,50}(\d{3})\s*g\b/i)?.[1];
  const balanceMatch = text.match(/(?:unstrung\s*balance|balance\s*\(\s*unstrung\s*\)|(?:balance|équilibre)(?![^0-9]{0,25}\bstrung\b))[^0-9]{0,70}(\d{3})\s*mm\b/i)
    ?? text.match(/(?:unstrung\s*balance|balance\s*\(\s*unstrung\s*\)|(?:balance|équilibre)(?![^0-9]{0,25}\bstrung\b))[^0-9]{0,70}(\d{2}(?:\.\d+)?)\s*cm\b/i);
  const strungBalance = text.match(/(?:^|[^a-z])strung\s*balance[^0-9]{0,70}((?:\d+(?:\.\d+)?\s*(?:pts?\.?\s*)?(?:head\s*light|head\s*heavy|hl|hh))|(?:\d{2,3}(?:\.\d+)?\s*(?:cm|mm)))/i)?.[1];
  const swingweight = text.match(/(?:swing\s*weight|swingweight|sw\s*\(\s*kg[^)]*\))[^0-9]{0,45}(\d{3})\b/i)?.[1];
  const pattern = text.match(/(?:string(?:ing)?\s*pattern|plan\s*de\s*cordage)[^0-9]{0,70}(\d{2})(?:\s*(?:mains?|m))?\s*[x×/]\s*(\d{2})(?:\s*(?:crosses?|c))?/i);
  const beamMatch = text.match(/(?:beam(?:\s*width)?|section|width\s*range)[^0-9]{0,70}([0-9]{2}(?:\.[0-9]+)?)\s*mm?(?:\s*[-–/]\s*([0-9]{2}(?:\.[0-9]+)?)\s*mm?)?(?:\s*[-–/]\s*([0-9]{2}(?:\.[0-9]+)?)\s*mm?)?/i);
  const beam = beamMatch ? beamMatch.slice(1).filter(Boolean).join("–") : undefined;
  const length = text.match(/(?:length|longueur)[^0-9]{0,70}(\d{2}(?:\.\d+)?)\s*(?:in(?:ches)?\.?|\")/i)?.[1];
  const stiffnessMatch = text.match(/(?:stiffness|flex(?!\s*force\b)(?:\s*rating)?|ra\s*rating|rigidity|rigidit[ée])(?:\s*\(\s*ra\s*\))?[^0-9]{0,28}(\d{2}(?:\.\d+)?)(?!\d)(?:\s*(?:\+\s*\/\s*-|±)\s*(\d+(?:\.\d+)?))?/i);
  const stiffness = stiffnessMatch && Number(stiffnessMatch[1]) >= 40 && Number(stiffnessMatch[1]) <= 85 ? stiffnessMatch : null;
  const composition = text.match(/(?:composition|material(?:s)?)[^a-z0-9]{0,20}([a-z][a-z0-9 +/&.™()-]{2,110}?)(?=\s+(?:color|colour|grip\s*size|string(?:ing)?\s*pattern|recommended\s*(?:string(?:ing)?\s*)?(?:tension|strings?)|made\s*in|product\s*code|item\s*code|sku|$))/i)?.[1]?.trim();
  const tensionMatch = text.match(/(?:recommended\s*)?(?:stringing\s*)?tension[^0-9]{0,45}(\d{2})\s*[-–/]\s*(\d{2})\s*(lbs?|kg)\b/i);
  const productCode = text.match(/(?:product\s*code|item\s*code|model\s*(?:number|no\.?|#)|sku)[^a-z0-9]{0,30}([a-z]{1,5}\d[a-z0-9-]{3,20})\b/i)?.[1]?.toUpperCase();
  const gripSizes = text.match(/grip\s*size[^a-z0-9]{0,20}([glo]?\s*\d(?:\s*[-–,/]\s*[glo]?\s*\d){0,5})/i)?.[1]?.replace(/\s+/g, " ").trim();
  const color = text.match(/colou?r(?:\(s\))?[^a-z0-9]{0,20}([a-z][a-z /&.-]{2,55}?)(?=\s+(?:head\s*size|weight|balance|length|width|beam|grip|material|string|made\s*in|$))/i)?.[1]?.replace(/[.\s]+$/, "").trim();
  const madeIn = text.match(/made\s*in[^a-z]{0,12}([a-z][a-z .]{2,30}?)(?=\s+(?:item\s*code|product\s*code|sku|description|$))/i)?.[1]?.replace(/[.\s]+$/, "").trim();
  const recommendedStrings = text.match(/recommended\s*strings?[^a-z0-9]{0,20}([a-z0-9™ +/&.,-]{3,120}?)(?=\s+(?:string(?:ing)?\s*pattern|(?:recommended\s*)?(?:stringing\s*)?tension|made\s*in|item\s*code|product\s*code|sku|$))/i)?.[1]?.trim();
  if (!head && !weight && !strungWeight && !pattern && !swingweight && !stiffness) return null;
  const balanceValue = balanceMatch?.[1];
  const balance = balanceValue ? `${Number(balanceValue) >= 100 ? (Number(balanceValue) / 10).toFixed(1) : Number(balanceValue).toFixed(1)} cm` : undefined;
  const tension = tensionMatch
    ? tensionMatch[3].toLowerCase() === "kg"
      ? `${Math.round(Number(tensionMatch[1]) * 2.20462)}–${Math.round(Number(tensionMatch[2]) * 2.20462)} lbs`
      : `${tensionMatch[1]}–${tensionMatch[2]} lbs`
    : undefined;
  return {
    ...(head ? { head: `${head} in²` } : {}),
    ...(weight ? { weight: `${weight} g` } : {}),
    ...(strungWeight ? { strungWeight: `${strungWeight} g` } : {}),
    ...(balance ? { balance } : {}),
    ...(strungBalance ? { strungBalance: strungBalance.replace(/\bhl\b/i, "pts head light").replace(/\bhh\b/i, "pts head heavy") } : {}),
    ...(swingweight ? { swingweight: `${swingweight} kg·cm²${/unstrung\s*(?:swing\s*weight|swingweight)|(?:swing\s*weight|swingweight)[^0-9]{0,25}unstrung/i.test(text) ? " · unstrung" : /(?:^|[^a-z])strung\s*(?:swing\s*weight|swingweight)/i.test(text) ? " · strung" : " · published"}` } : {}),
    ...(pattern ? { pattern: `${pattern[1]} × ${pattern[2]}` } : {}),
    ...(beam ? { beam: `${beam} mm` } : {}),
    ...(length ? { length: `${length} in` } : {}),
    ...(stiffness ? { stiffness: `${Math.round(Number(stiffness[1]))} RA${stiffness[2] ? ` ±${stiffness[2]}` : ""}` } : {}),
    ...(composition ? { composition } : {}),
    ...(tension ? { tension } : {}),
    ...(productCode ? { productCode } : {}),
    ...(gripSizes ? { gripSizes } : {}),
    ...(color ? { color } : {}),
    ...(madeIn ? { madeIn } : {}),
    ...(recommendedStrings ? { recommendedStrings } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    source,
    sourceUrl,
  };
}

function manufacturerFor(modelKey) {
  if (/^(blade|clash|ultra|pro-staff|rf-01|shift|defyer)/.test(modelKey)) return "Wilson";
  if (/^(ezone|vcore|percept|muse)/.test(modelKey)) return "Yonex";
  if (/^(pure-|aeropro|boost-|evo-)/.test(modelKey)) return "Babolat";
  if (/^(speed|gravity|radical|extreme|boom|prestige|instinct|squared|ig-)/.test(modelKey)) return "Head";
  if (/^(tf40|tfight|tfx1|tempo|fire)/.test(modelKey)) return "Tecnifibre";
  if (/^dunlop-/.test(modelKey)) return "Dunlop";
  if (/^prince-/.test(modelKey)) return "Prince";
  if (/^volkl-/.test(modelKey)) return "Volkl";
  return null;
}

function officialSearchUrl(manufacturer, modelName) {
  const query = encodeURIComponent(modelName.replace(`${manufacturer} `, ""));
  if (manufacturer === "Wilson") return `https://www.wilson.com/en-ca/search?q=${query}`;
  if (manufacturer === "Yonex") {
    if (/ezone/i.test(modelName)) return "https://www.yonex.com/ezone";
    if (/vcore/i.test(modelName)) return "https://www.yonex.com/vcore";
    if (/percept/i.test(modelName)) return "https://www.yonex.com/percept";
    return `https://www.yonex.com/catalogsearch/result/?q=${query}`;
  }
  if (manufacturer === "Babolat") return "https://www.babolat.ca/collections/tennis-rackets/products.json?limit=250";
  if (manufacturer === "Head") return `https://www.head.com/en_CA/search?q=${query}`;
  if (manufacturer === "Tecnifibre") return `https://www.tecnifibre.com/en/search?controller=search&s=${query}`;
  if (manufacturer === "Dunlop") return `https://dunlopsports.com/search?q=${query}`;
  if (manufacturer === "Prince") return `https://princetennis.com/search?q=${query}`;
  return "https://volkltennis.com/products.json?limit=250";
}

function officialModelLabel(manufacturer, modelName) {
  return modelName.replace(new RegExp(`^${manufacturer}\\s+`, "i"), " ")
    .replace(/\s*\((?:20\d{2})\)\s*/g, " ")
    .replace(/\b(?:20\d{2}|gen(?:eration)?\s*\d+|\d+(?:st|nd|rd|th)\s+gen)\b/gi, " ")
    .replace(/\s+/g, " ").trim();
}

const officialProductUrls = {
  "defyer-100-v1": "https://ph.wilson.com/products/wilson-defyer-100-v1-tennis-racket",
  "defyer-98-pro-v1": "https://sg.wilson.com/products/wilson-defyer-98-pro-v1-tennis-racket",
  "pro-staff-97-classic": "https://au.wilson.com/products/pro-staff-97-classic-tennis-racket",
  "rf-01-pro": "https://www.wilson.com/en-us/product/rf-01-pro-frm-wr15130",
  "blade-v9": "https://www.wilson.com/en-us/custom/rackets/blade/blade-98-16x19-v9/customize",
  "clash-100": "https://id.wilson.com/en/products/clash-100-v3.0",
  "clash-100-pro": "https://www.wilson.com/en-us/product/clash-100-pro-v3-0-frm-wr17270",
  "clash-100l-v3": "https://www.wilson.com/en-us/explore/help/product/stringing-instructions",
  "clash-100ul-v3": "https://jp.wilson.com/products/tennis-racket-clash-100-ul-v-3-0",
  "clash-108-v3": "https://sg.wilson.com/products/wilson-clash-v3-108-performance-tennis-racket-unstrung-wr173111u",
  "pro-staff-x": "https://ph.wilson.com/products/pro-staff-x-v14-professional-tennis-racket-wr125811u",
  "prestige-tour": "https://www.head.com/en_US/product/prestige-tour-2023-236113",
  "prestige-pro": "https://www.head.com/en_US/product/prestige-pro-2023-236103",
  "gravity-pro-2025": "https://www.head.com/en_CA/product/gravity-pro-2025-231105",
  "gravity-tour-2025": "https://www.head.com/en_CA/product/gravity-tour-2025-231115",
  "squared-2026": "https://www.head.com/en_US/product/squared-232606",
  "boom-elite-2026": "https://www.head.com/en_US/product/boom-elite-2026-232276",
  "ig-speed-xceed-2026": "https://www.head.com/en_NO/product/ig-speed-xceed-231226",
  "ig-boom-xceed-2026": "https://www.head.com/en_DK/product/ig-boom-xceed-231216",
  "ig-gravity-xceed-2026": "https://www.head.com/en_PT/product/ig-gravity-xceed-231236",
  "ig-radical-xceed-2026": "https://www.head.com/en_PT/product/ig-radical-xceed-231246",
  "boost-aero-2026": "https://www.babolat.com/us/boost-aero-strung/121266.html",
  "boost-strike-2026": "https://www.babolat.com/us/boost-strike-strung/121247.html",
  "boost-wimbledon-2026": "https://www.babolat.com/us/boost-wimbledon-2026-strung/121270.html",
  "evo-aero-gen2": "https://www.babolat.com/us/evo-aero-gen2-strung/102562.html",
  "evo-drive-gen2": "https://www.babolat.com/us/evo-drive-gen2-strung/102545.html",
  "fire-305s": "https://www.tecnifibre.com/en/products/fire-305s",
  "fire-300": "https://b2b.tecnifibre.com/en/p/14FIR3006.html",
  "fire-285": "https://www.tecnifibre.com/en-uee/products/fire-285",
  "dunlop-cx-200-tour-16x19": "https://dunlopsports.com/en-gb/tennis/rackets/cx200-tour-16x19/2",
  "prince-vortex-100-310": "https://princetennis-hk.com/en/products/7t53s101ul2",
};

const manufacturerPageCache = new Map();

async function fetchOfficialPage(url, accept = "text/html") {
  const cacheKey = `${accept}:${url}`;
  if (!manufacturerPageCache.has(cacheKey)) {
    manufacturerPageCache.set(cacheKey, (async () => {
      const response = await fetch(url, {
        headers: { accept, "accept-language": "en-CA,en;q=.8", "user-agent": "Mozilla/5.0 (compatible; BaselinePriceTracker/1.0)" },
        signal: AbortSignal.timeout(16000),
      });
      if (!response.ok) throw new Error(`Official source HTTP ${response.status}: ${url}`);
      return accept.includes("json") ? response.json() : response.text();
    })());
  }
  return manufacturerPageCache.get(cacheKey);
}

function candidateOfficialLinks(html, pageUrl, modelName) {
  const tokens = modelName.toLowerCase().replace(/\b(wilson|yonex|babolat|head|tecnifibre|dunlop|prince|volkl|tennis|racquet|racket|gen(?:eration)?|20\d{2}|\d+(?:st|nd|rd|th))\b/g, " ")
    .split(/[^a-z0-9]+/).filter((token) => token.length > 1);
  const links = new Map();
  for (const match of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    let url;
    try { url = new URL(decodeHtmlAttribute(match[1]), pageUrl); } catch { continue; }
    if (url.origin !== new URL(pageUrl).origin || !/product|racquet|racket|tennis/i.test(url.pathname)) continue;
    const haystack = decodeURIComponent(url.pathname).toLowerCase();
    const score = tokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0);
    if (score >= Math.min(2, tokens.length)) links.set(url.href, score);
  }
  return [...links.entries()].sort((a, b) => b[1] - a[1]).map(([url]) => url).slice(0, 4);
}

function officialSectionMedia(html, pageUrl, modelLabel) {
  const normalizedHtml = String(html ?? "").toLowerCase();
  const labelIndex = normalizedHtml.indexOf(String(modelLabel ?? "").toLowerCase());
  if (labelIndex < 0) return {};
  // Manufacturer series pages generally place the product link/image immediately
  // before the visible model heading. Keep the window tight so adjacent models do
  // not donate their artwork to one another.
  const nearby = String(html).slice(Math.max(0, labelIndex - 2200), labelIndex + 500);
  const images = [...nearby.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)];
  const links = [...nearby.matchAll(/<a\b[^>]*\bhref=["']([^"'#]+)["']/gi)];
  const toAbsolute = (value) => {
    try { return new URL(decodeHtmlAttribute(value), pageUrl).href; } catch { return null; }
  };
  const imageUrl = toAbsolute(images.at(-1)?.[1]);
  const productUrl = toAbsolute(links.at(-1)?.[1]);
  return {
    ...(imageUrl ? { imageUrl } : {}),
    ...(productUrl ? { productUrl } : {}),
  };
}

function exactOfficialLabelIndex(text, label, fromIndex = 0) {
  const haystack = String(text ?? "").toLowerCase();
  const needle = String(label ?? "").toLowerCase();
  let index = haystack.indexOf(needle, fromIndex);
  while (index >= 0) {
    const before = haystack[index - 1] ?? " ";
    const after = haystack[index + needle.length] ?? " ";
    if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) return index;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return -1;
}

function officialModelSection(text, manufacturer, modelKey, modelLabel) {
  const modelIndex = exactOfficialLabelIndex(text, modelLabel);
  if (modelIndex < 0) return null;
  let end = Math.min(String(text).length, modelIndex + 4500);
  for (const [candidateKey, candidateName] of Object.entries(modelNames)) {
    if (candidateKey === modelKey || manufacturerFor(candidateKey) !== manufacturer) continue;
    const candidateLabel = officialModelLabel(manufacturer, candidateName);
    const candidateIndex = exactOfficialLabelIndex(text, candidateLabel, modelIndex + modelLabel.length);
    if (candidateIndex > modelIndex && candidateIndex < end) end = candidateIndex;
  }
  return String(text).slice(modelIndex, end);
}

async function fetchManufacturerSpec(modelKey) {
  const manufacturer = manufacturerFor(modelKey);
  const modelName = modelNames[modelKey];
  if (!manufacturer || !modelName) return null;
  const searchUrl = officialSearchUrl(manufacturer, modelName);
  const directUrl = officialProductUrls[modelKey];
  if (directUrl) {
    try {
      const directHtml = await fetchOfficialPage(directUrl);
      let directSpec = extractRacquetSpecs(directHtml, `${manufacturer} official`, directUrl);
      if (!directSpec?.head || !directSpec?.weight) {
        try { directSpec = extractRacquetSpecs(await renderedMarketplaceHtml(directUrl), `${manufacturer} official`, directUrl); }
        catch { /* Browser rendering is an optional fallback for JavaScript storefronts. */ }
      }
      if (directSpec?.head && directSpec?.weight) return directSpec;
    } catch {
      try {
        const rendered = await renderedMarketplaceHtml(directUrl);
        const directSpec = extractRacquetSpecs(rendered, `${manufacturer} official`, directUrl);
        if (directSpec?.head && directSpec?.weight) return directSpec;
      } catch { /* Continue to the manufacturer's catalogue/search page. */ }
    }
  }
  if (manufacturer === "Babolat" || manufacturer === "Volkl") {
    const { products = [] } = await fetchOfficialPage(searchUrl, "application/json");
    const product = products.find((candidate) => classify(`${manufacturer} ${candidate.title}`) === modelKey);
    if (!product) return null;
    const sourceUrl = `${new URL(searchUrl).origin}/products/${product.handle}`;
    const spec = extractRacquetSpecs(`${product.title} ${product.body_html ?? ""}`, `${manufacturer} official`, sourceUrl);
    const productImage = product.images?.[0]?.src ?? product.image?.src;
    return spec ? { ...spec, ...(productImage ? { imageUrl: new URL(productImage, sourceUrl).href } : {}) } : null;
  }
  let html;
  try { html = await fetchOfficialPage(searchUrl); }
  catch { html = await renderedMarketplaceHtml(searchUrl); }
  const text = plainText(html);
  const officialLabel = officialModelLabel(manufacturer, modelName);
  const modelSection = officialModelSection(text, manufacturer, modelKey, officialLabel);
  if (modelSection) {
    const sectionSpec = extractRacquetSpecs(modelSection, `${manufacturer} official`, searchUrl);
    if (sectionSpec?.head && sectionSpec?.weight) {
      const media = officialSectionMedia(html, searchUrl, officialLabel);
      return { ...sectionSpec, ...(media.imageUrl ? { imageUrl: media.imageUrl } : {}) };
    }
  }
  for (const productUrl of candidateOfficialLinks(html, searchUrl, modelName)) {
    let pageHtml;
    try { pageHtml = await fetchOfficialPage(productUrl); } catch { continue; }
    if (classify(plainText(pageHtml).slice(0, 5000)) !== modelKey) continue;
    const spec = extractRacquetSpecs(pageHtml, `${manufacturer} official`, productUrl);
    if (spec) return spec;
  }
  try {
    const renderedHtml = await renderedMarketplaceHtml(searchUrl);
    const renderedText = plainText(renderedHtml);
    const renderedSection = officialModelSection(renderedText, manufacturer, modelKey, officialLabel);
    if (renderedSection) {
      const sectionSpec = extractRacquetSpecs(renderedSection, `${manufacturer} official`, searchUrl);
      if (sectionSpec?.head && sectionSpec?.weight) {
        const media = officialSectionMedia(renderedHtml, searchUrl, officialLabel);
        return { ...sectionSpec, ...(media.imageUrl ? { imageUrl: media.imageUrl } : {}) };
      }
    }
    for (const productUrl of candidateOfficialLinks(renderedHtml, searchUrl, modelName)) {
      let pageHtml;
      try { pageHtml = await renderedMarketplaceHtml(productUrl); } catch { continue; }
      if (classify(plainText(pageHtml).slice(0, 5000)) !== modelKey) continue;
      const spec = extractRacquetSpecs(pageHtml, `${manufacturer} official`, productUrl);
      if (spec) return spec;
    }
  } catch { /* Some manufacturer sites block automated browsers; the next audit will retry. */ }
  return null;
}

function parseAmazonPrice(block) {
  const offscreen = block.match(/a-offscreen[^>]*>\s*[$€£]?\s*([\d,]+(?:\.\d{2})?)/i)?.[1];
  if (offscreen) {
    const parsed = Number(offscreen.replace(/,/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  const whole = block.match(/a-price-whole[^>]*>\s*([\d,]+)/i)?.[1];
  if (!whole) return null;
  const fraction = block.match(/a-price-fraction[^>]*>\s*(\d{2})/i)?.[1] ?? "00";
  const price = Number(`${whole.replace(/,/g, "")}.${fraction}`);
  return Number.isFinite(price) ? price : null;
}

async function fetchAmazon(store, origin) {
  const offers = [];
  const searches = [
    ...amazonSearches.map((search) => ({ search, gripSize: targetGripSize, specialOnly: false })),
    ...amazonSpecialEditionSearches.flatMap((search) => Object.keys(gripMeasurements).map((gripSize) => ({ search, gripSize, specialOnly: true }))),
  ];
  for (const { search, gripSize, specialOnly } of searches) {
    const response = await fetch(`${origin}/s?k=${encodeURIComponent(`${search} ${gripSize} ${gripMeasurements[gripSize]}`)}`, {
      headers: { accept: "text/html,application/xhtml+xml", "accept-language": "en-CA,en;q=0.8", "user-agent": "Mozilla/5.0 (compatible; BaselinePriceTracker/1.0)" },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`${store}: HTTP ${response.status}`);
    const html = await response.text();
    for (const block of html.split(/data-asin="/i).slice(1)) {
      const asin = block.split('"', 1)[0];
      if (!/^[A-Z0-9]{10}$/.test(asin)) continue;
      const title = block.match(/(?:a-truncate-full|a-size-(?:medium|base-plus)[^>]*a-text-normal)[^>]*>\s*([^<]{8,180})/i)?.[1]?.trim();
      const price = title ? parseAmazonPrice(block) : null;
      if (!title || price === null) continue;
      const modelKey = classify(title);
      const edition = specialEditionName(title);
      if ((!modelKey && !edition) || (specialOnly && !edition)) continue;
      offers.push({
        id: `${store}:${asin}`, modelKey: modelKey ?? "other-sale", store, title, price,
        compareAtPrice: null, url: `${origin}/dp/${asin}`, gripSizes: [gripSize],
      });
    }
  }
  return mergeOffersById(offers);
}

async function fetchWooCommerce(store, origin, url) {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "BaselinePriceTracker/1.0 (+Canadian tennis price comparison)" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`${store}: HTTP ${response.status}`);
  const products = await response.json();
  return products.flatMap((product) => {
    const modelKey = classify(product.name) ?? "other-sale";
    if (modelKey === "other-sale" && isAccessory(product.name)) return [];
    const gripTerms = (product.attributes ?? [])
      .filter((attribute) => /grip/i.test(attribute.name))
      .flatMap((attribute) => attribute.terms ?? [])
      .map((term) => term.name);
    const gripSizes = offerGripSizes(product.name, gripTerms);
    if (!product.is_in_stock || !gripSizes.length) return [];
    const divisor = 10 ** (product.prices?.currency_minor_unit ?? 2);
    const price = Number(product.prices?.price) / divisor;
    const regular = Number(product.prices?.regular_price) / divisor;
    if (!Number.isFinite(price) || price <= 0 || (modelKey === "other-sale" && !specialEditionName(product.name) && !(regular > price))) return [];
    return [{
      id: `${store}:${product.id}`, modelKey, store, title: product.name,
      price, compareAtPrice: regular > price ? regular : null,
      url: product.permalink ?? `${origin}/?p=${product.id}`,
      gripSizes,
    }];
  });
}

function decodeHtmlAttribute(value) {
  return value.replaceAll("&amp;", "&").replaceAll("&#39;", "'").replaceAll("&quot;", '"');
}

async function fetchMatchpoint(store, origin, categoryUrl) {
  const productJsonUrls = new Set();
  let pageUrl = categoryUrl;
  for (let page = 0; page < 8 && pageUrl; page += 1) {
    const response = await fetch(pageUrl, {
      headers: { accept: "text/html,application/xhtml+xml", "user-agent": "Mozilla/5.0 (compatible; BaselinePriceTracker/1.0)" },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`${store}: catalog HTTP ${response.status}`);
    const html = await response.text();
    for (const match of html.matchAll(/data-url=["']([^"']+\.html\?format=json[^"']*)["']/gi)) {
      productJsonUrls.add(new URL(decodeHtmlAttribute(match[1]), pageUrl).href);
    }
    for (const anchor of html.matchAll(/<a\b[^>]*>/gi)) {
      const tag = anchor[0];
      const href = tag.match(/href=["']([^"']+\.html(?:\?[^"']*)?)["']/i)?.[1];
      const className = tag.match(/class=["']([^"']*)["']/i)?.[1] ?? "";
      if (!href || !/(?:prod-card__img-link|product-card__title)/i.test(className)) continue;
      const productUrl = new URL(decodeHtmlAttribute(href), pageUrl);
      productUrl.search = "?format=json";
      productJsonUrls.add(productUrl.href);
    }
    const next = html.match(/<link[^>]+rel=["']next["'][^>]+href=["']([^"']+)["']/i)
      ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']next["']/i);
    pageUrl = next ? new URL(decodeHtmlAttribute(next[1]), pageUrl).href : "";
  }

  const urls = [...productJsonUrls];
  const offers = [];
  for (let offset = 0; offset < urls.length; offset += 6) {
    const products = await Promise.all(urls.slice(offset, offset + 6).map(async (jsonUrl) => {
      const response = await fetch(jsonUrl, {
        headers: { accept: "application/json", "user-agent": "Mozilla/5.0 (compatible; BaselinePriceTracker/1.0)" },
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error(`${store}: product HTTP ${response.status}`);
      return (await response.json()).product;
    }));
    for (const product of products) {
      if (!product?.title) continue;
      const modelKey = classify(product.title) ?? "other-sale";
      if (modelKey === "other-sale" && isAccessory(product.title)) continue;
      const variants = Object.values(product.variants ?? {}).map((variant) => ({
        variant,
        gripSizes: offerGripSizes(product.title, [variant?.title ?? ""]),
      })).filter(({ variant, gripSizes }) =>
        variant?.active !== false && variant?.stock?.available && gripSizes.length);
      const prices = variants.map(({ variant }) => Number(variant.price?.price)).filter((price) => Number.isFinite(price) && price > 0);
      if (!prices.length) continue;
      const oldPrices = variants.map(({ variant }) => Number(variant.price?.price_old))
        .filter((price) => Number.isFinite(price) && price > 0);
      const price = Math.min(...prices);
      const compareAtPrice = oldPrices.filter((oldPrice) => oldPrice > price).sort((a, b) => a - b)[0] ?? null;
      if (modelKey === "other-sale" && !specialEditionName(product.title) && compareAtPrice === null) continue;
      offers.push({
        id: `${store}:${product.id ?? product.url}`,
        modelKey,
        store,
        title: product.title,
        price,
        compareAtPrice,
        url: new URL(product.url, `${origin}/`).href,
        gripSizes: [...new Set(variants.flatMap(({ gripSizes }) => gripSizes))],
      });
    }
  }
  return offers;
}

function productJsonLd(html) {
  const products = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const value = JSON.parse(match[1].replaceAll("&quot;", '"').replaceAll("&amp;", "&"));
      const queue = Array.isArray(value) ? [...value] : [value];
      while (queue.length) {
        const item = queue.shift();
        if (!item || typeof item !== "object") continue;
        if (item["@type"] === "Product") products.push(item);
        if (Array.isArray(item["@graph"])) queue.push(...item["@graph"]);
        if (Array.isArray(item.itemListElement)) queue.push(...item.itemListElement.map((entry) => entry.item ?? entry));
      }
    } catch { /* malformed merchant metadata is ignored */ }
  }
  return products;
}

function jsonLdOffer(product) {
  const source = product.offers ?? product.Offers;
  const offers = Array.isArray(source) ? source : source ? [source] : [];
  return offers.find((offer) => /InStock/i.test(String(offer.availability ?? offer.Availability ?? ""))) ?? offers[0];
}

async function fetchWix(store, origin, categoryUrl) {
  const response = await fetch(categoryUrl, {
    headers: { accept: "text/html,application/xhtml+xml", "user-agent": "Mozilla/5.0 (compatible; BaselinePriceTracker/1.0)" },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`${store}: catalog HTTP ${response.status}`);
  const catalog = await response.text();
  const urls = [...new Set([...catalog.matchAll(/href=["'](https?:\/\/[^"']+\/product-page\/[^"'?#]+)/gi)].map((match) => decodeHtmlAttribute(match[1])))]
    .filter((url) => /defyer|blade|clash|ultra|pro-staff|rf-01|shift|ezone|vcore|percept|muse|pure-aero|pure-drive|pure-strike|speed|gravity|radical|extreme|boom|prestige|instinct|tf40|t-fight|tfight|tf-x1|tfx1|tempo|fire|wimbledon|roland-garros|legend|limited|concept|anniversary|osaka|laver-cup/i.test(decodeURIComponent(url.split("/").pop() ?? "")))
    .slice(0, 40);
  const offers = [];
  for (let offset = 0; offset < urls.length; offset += 4) {
    const pages = await Promise.all(urls.slice(offset, offset + 4).map(async (url) => {
      const page = await fetch(url, { headers: { accept: "text/html", "user-agent": "Mozilla/5.0 (compatible; BaselinePriceTracker/1.0)" }, signal: AbortSignal.timeout(25000) });
      return page.ok ? { url, html: await page.text() } : null;
    }));
    for (const page of pages) {
      if (!page) continue;
      const product = productJsonLd(page.html)[0];
      const title = product?.name;
      const modelKey = title ? classify(title) ?? (specialEditionName(title) ? "other-sale" : null) : null;
      if (!modelKey || !title) continue;
      const gripSelections = [...page.html.matchAll(/"id":(\d+),"value":"([^"]+)"/g)]
        .map((match) => ({ id: Number(match[1]), value: match[2].replaceAll("\\/", "/") }))
        .map((selection) => ({ ...selection, gripSizes: offerGripSizes(title, [selection.value]) }))
        .filter((selection) => selection.gripSizes.length);
      const itemMatch = page.html.match(/"productItems":(\[[\s\S]*?\]),"name":/);
      const matchedItems = [];
      if (gripSelections.length && itemMatch) {
        try {
          const items = JSON.parse(itemMatch[1]);
          for (const selection of gripSelections) {
            const item = items.find((candidate) => candidate.optionsSelections?.includes(selection.id)
              && (candidate.inventory?.status === "in_stock" || candidate.availableForPreOrder));
            if (item) matchedItems.push({ item, gripSizes: selection.gripSizes });
          }
        } catch { /* skip malformed hydration state */ }
      }
      const prices = matchedItems.map(({ item }) => Number(item.price)).filter((price) => Number.isFinite(price) && price > 0);
      if (!prices.length) continue;
      const price = Math.min(...prices);
      const compareAtPrice = matchedItems.map(({ item }) => Number(item.comparePrice))
        .filter((candidate) => Number.isFinite(candidate) && candidate > price)
        .sort((a, b) => a - b)[0] ?? null;
      offers.push({
        id: `${store}:${page.url}`, modelKey, store, title, price, compareAtPrice, url: page.url,
        gripSizes: [...new Set(matchedItems.flatMap(({ gripSizes }) => gripSizes))],
      });
    }
  }
  return offers;
}

async function fetchStructured(store, origin, categoryUrl) {
  const response = await fetch(categoryUrl, {
    headers: { accept: "text/html,application/xhtml+xml", "accept-language": "en-CA,en;q=.8", "user-agent": "Mozilla/5.0 (compatible; BaselinePriceTracker/1.0)" },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`${store}: catalog HTTP ${response.status}`);
  const html = await response.text();
  const candidates = productJsonLd(html);
  const offers = [];
  for (const product of candidates) {
    const title = product.name;
    const modelKey = title ? classify(title) : null;
    const offer = jsonLdOffer(product);
    const price = Number(offer?.price ?? offer?.lowPrice);
    const text = JSON.stringify(product);
    const gripSizes = offerGripSizes(title ?? "", [text]);
    const resolvedModelKey = modelKey ?? (specialEditionName(title ?? "") ? "other-sale" : null);
    if (!resolvedModelKey || !gripSizes.length || !Number.isFinite(price) || price <= 0 || /OutOfStock/i.test(String(offer?.availability ?? ""))) continue;
    offers.push({
      id: `${store}:${product.sku ?? offer?.url ?? title}`, modelKey: resolvedModelKey, store, title, price,
      compareAtPrice: null, url: new URL(offer?.url ?? product.url ?? categoryUrl, origin).href, gripSizes,
    });
  }
  return offers;
}

function nextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error("Marketplace page did not include public listing data");
  return JSON.parse(match[1]);
}

function decodeMarketplaceText(value) {
  return value.replace(/<[^>]+>/g, " ").replaceAll("&amp;", "&").replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'").replaceAll("&nbsp;", " ").replace(/\s+/g, " ").trim();
}

async function renderedMarketplaceHtml(url) {
  let endpoint = process.env.MARKETPLACE_BROWSER_URL;
  if (!endpoint) {
    let token = process.env.BROWSERLESS_TOKEN;
    if (!token) {
      try { token = (await readFile(process.env.BROWSERLESS_TOKEN_FILE ?? "/app/.data/browserless-token", "utf8")).trim(); }
      catch { /* Reported as a source failure below. */ }
    }
    if (!token) throw new Error("Facebook browser connector is not configured");
    endpoint = `https://production-sfo.browserless.io/content?token=${encodeURIComponent(token)}`;
    let profile = process.env.BROWSERLESS_PROFILE;
    if (!profile) {
      try { profile = (await readFile(process.env.BROWSERLESS_PROFILE_FILE ?? "/app/.data/browserless-profile", "utf8")).trim(); }
      catch { /* An authenticated profile is optional until Facebook requests login. */ }
    }
    if (profile) endpoint += `&profile=${encodeURIComponent(profile)}`;
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      url,
      gotoOptions: { waitUntil: "networkidle2", timeout: 45000 },
      waitForTimeout: 2500,
      rejectResourceTypes: ["image", "media", "font"],
      bestAttempt: true,
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Marketplace browser: HTTP ${response.status}`);
  const html = await response.text();
  const visibleText = decodeMarketplaceText(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " "));
  if (/Log into Facebook/i.test(visibleText) && !/\/marketplace\/item\//i.test(html)) {
    throw new Error("Facebook login required: create or refresh the Browserless authenticated profile");
  }
  return html;
}

async function fetchFacebookUsed(query) {
  const searchUrl = `https://www.facebook.com/marketplace/category/search/?query=${encodeURIComponent(query)}`;
  const html = await renderedMarketplaceHtml(searchUrl);
  const listings = [];
  for (const match of html.matchAll(/<a[^>]+href="([^"]*\/marketplace\/item\/(\d+)\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = decodeMarketplaceText(match[3]);
    const priceText = text.match(/CA\$\s*([\d,.]+)/i)?.[1];
    const price = priceText ? Number(priceText.replaceAll(",", "")) : NaN;
    const title = text.replace(/CA\$\s*[\d,.]+/ig, " ").replace(/(?:Toronto|Ottawa|Mississauga|Brampton|Hamilton|London|Markham|Vaughan|Oakville|Kitchener|Richmond Hill|Montreal|Calgary|Edmonton|Vancouver)[^·|]*$/i, "").trim();
    const modelKey = classifyUsed(title);
    if (!modelKey || !isGripThree(title) || !Number.isFinite(price) || price < 20 || price > 1200) continue;
    listings.push({
      id: `used:facebook:${match[2]}`, modelKey, store: "Facebook Marketplace", title,
      price, compareAtPrice: null, url: new URL(match[1].replaceAll("&amp;", "&"), "https://www.facebook.com").href,
      condition: "Used · local marketplace", currency: "CAD", gripSizes: [targetGripSize],
    });
  }
  return [...new Map(listings.map((listing) => [listing.id, listing])).values()];
}

async function apifyToken() {
  if (process.env.APIFY_TOKEN) return process.env.APIFY_TOKEN.trim();
  try { return (await readFile(process.env.APIFY_TOKEN_FILE ?? "/app/.data/apify-token", "utf8")).trim(); }
  catch { return ""; }
}

async function ebayCredentials() {
  if (process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET) {
    return { clientId: process.env.EBAY_CLIENT_ID.trim(), clientSecret: process.env.EBAY_CLIENT_SECRET.trim() };
  }
  try {
    const credentials = JSON.parse(await readFile(process.env.EBAY_CREDENTIALS_FILE ?? "/app/.data/ebay-credentials.json", "utf8"));
    if (typeof credentials.clientId === "string" && typeof credentials.clientSecret === "string") {
      return { clientId: credentials.clientId.trim(), clientSecret: credentials.clientSecret.trim() };
    }
  } catch { /* eBay remains disabled until production credentials are installed. */ }
  return null;
}

async function ebayApplicationToken(credentials) {
  const authorization = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`, "utf8").toString("base64");
  const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      authorization: `Basic ${authorization}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
    signal: AbortSignal.timeout(20000),
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new Error(`eBay OAuth: ${payload.error_description ?? payload.error ?? `HTTP ${response.status}`}`);
  }
  return payload.access_token;
}

async function fetchEbayUsed(modelKeys, credentials) {
  const token = await ebayApplicationToken(credentials);
  const offers = [];
  const gripQueries = [targetGripSize, gripMeasurements[targetGripSize]];
  for (const modelKey of modelKeys) {
    for (const gripQuery of gripQueries) {
      const params = new URLSearchParams({
        q: `${modelNames[modelKey]} ${gripQuery}`,
        limit: "50",
        sort: "newlyListed",
        filter: "deliveryCountry:CA",
      });
      const response = await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`, {
        headers: {
          authorization: `Bearer ${token}`,
          "x-ebay-c-marketplace-id": "EBAY_CA",
          "accept-language": "en-CA",
        },
        signal: AbortSignal.timeout(25000),
      });
      const payload = await response.json();
      if (!response.ok) {
        const message = payload.errors?.map((error) => error.message).filter(Boolean).join("; ");
        throw new Error(`eBay Canada: ${message || `HTTP ${response.status}`}`);
      }
      for (const item of payload.itemSummaries ?? []) {
        const title = item.title ?? "";
        const detectedModelKey = classifyUsed(title);
        const condition = item.condition ?? "";
        const evidence = `${title} ${item.shortDescription ?? ""} ${(item.localizedAspects ?? []).map((aspect) => `${aspect.name} ${aspect.value}`).join(" ")}`;
        const price = Number(item.price?.value);
        if (detectedModelKey !== modelKey || !/\b(?:used|pre[- ]?owned|open box|refurbished)\b/i.test(condition)
          || (!isGripThree(evidence) && !evidence.toLowerCase().includes(gripQuery.toLowerCase()))
          || !Number.isFinite(price) || price < 20 || price > 1200 || !item.itemWebUrl) continue;
        const city = item.itemLocation?.city;
        const country = item.itemLocation?.country;
        offers.push({
          id: `used:ebay:${item.itemId}`, modelKey, store: "eBay Canada", title,
          price, compareAtPrice: null, url: item.itemWebUrl,
          condition: `${condition}${city ? ` · ${city}` : ""}${country && country !== "CA" ? ` · ships from ${country}` : ""}`,
          currency: item.price.currency ?? "CAD", gripSizes: [targetGripSize],
          listedAt: item.itemCreationDate ?? null,
        });
      }
    }
  }
  return [...new Map(offers.map((offer) => [offer.id, offer])).values()];
}

async function fetchApifyFacebookUsed(queries, token) {
  const intervalHours = Math.max(3, Number(process.env.APIFY_FACEBOOK_INTERVAL_HOURS ?? 12) || 12);
  const cacheKey = `apify-v2:${targetGripSize}:${queries.join("|")}`;
  try {
    const cached = JSON.parse(await readFile(apifyFacebookCachePath, "utf8"));
    if (cached.cacheKey === cacheKey && Date.now() - Date.parse(cached.checkedAt) < intervalHours * 60 * 60 * 1000) {
      return cached.offers ?? [];
    }
  } catch { /* A missing or stale cache is refreshed below. */ }

  const startUrls = queries.map((query) => ({
    url: `https://www.facebook.com/marketplace/toronto/search/?query=${encodeURIComponent(query)}`,
  }));
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const runResponse = await fetch("https://api.apify.com/v2/acts/apify~facebook-marketplace-scraper/runs?memory=4096&timeout=180", {
    method: "POST", headers,
    body: JSON.stringify({ startUrls, resultsLimit: 2, includeListingDetails: false }),
    signal: AbortSignal.timeout(30000),
  });
  const runPayload = await runResponse.json();
  if (!runResponse.ok || !runPayload.data?.id) throw new Error(`Apify Facebook: ${runPayload.error?.message ?? `HTTP ${runResponse.status}`}`);

  let run = runPayload.data;
  for (let attempt = 0; attempt < 60 && !["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(run.status); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const statusResponse = await fetch(`https://api.apify.com/v2/actor-runs/${run.id}`, {
      headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000),
    });
    run = (await statusResponse.json()).data ?? run;
  }
  if (run.status !== "SUCCEEDED" || !run.defaultDatasetId) {
    throw new Error(`Apify Facebook: ${run.statusMessage ?? run.status ?? "run did not finish"}`);
  }

  const itemsResponse = await fetch(`https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?clean=true&limit=100`, {
    headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000),
  });
  if (!itemsResponse.ok) throw new Error(`Apify Facebook dataset: HTTP ${itemsResponse.status}`);
  const items = await itemsResponse.json();
  const offers = items.flatMap((item) => {
    const title = item.marketplace_listing_title ?? item.title ?? "";
    const modelKey = classifyUsed(title);
    const price = Number(item.listing_price?.amount ?? item.price?.amount ?? item.price);
    const evidence = `${title} ${item.custom_title ?? ""} ${JSON.stringify(item.custom_sub_titles_with_rendering_flags ?? [])}`;
    if (!modelKey || !isGripThree(evidence) || !Number.isFinite(price) || price < 20 || price > 1200
      || item.is_live === false || item.is_sold || item.is_pending) return [];
    const url = item.listingUrl ?? item.listing_url ?? item.url;
    if (!url || !/^https:\/\/(?:www\.)?facebook\.com\/marketplace\/item\//i.test(url)) return [];
    const location = item.location?.reverse_geocode?.city ?? item.location?.city ?? item.location?.name;
    return [{
      id: `used:facebook:${item.id ?? item.marketplace_listing_id ?? url}`, modelKey,
      store: "Facebook Marketplace", title, price, compareAtPrice: null, url,
      condition: `Used · local marketplace${location ? ` · ${location}` : ""}`,
      currency: "CAD", gripSizes: [targetGripSize],
    }];
  });
  const uniqueOffers = [...new Map(offers.map((offer) => [offer.id, offer])).values()];
  await mkdir(new URL("../.data/", import.meta.url), { recursive: true });
  await writeFile(apifyFacebookCachePath, JSON.stringify({ checkedAt: new Date().toISOString(), cacheKey, offers: uniqueOffers }, null, 2));
  return uniqueOffers;
}

async function fetchKijijiUsed(query) {
  const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const response = await fetch(`https://www.kijiji.ca/b-canada/${slug}/k0l0`, {
    headers: { accept: "text/html", "accept-language": "en-CA,en;q=.8", "user-agent": "Mozilla/5.0 (compatible; BaselinePriceTracker/1.0)" },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`Kijiji Canada: HTTP ${response.status}`);
  const state = nextData(await response.text())?.props?.pageProps?.__APOLLO_STATE__ ?? {};
  return Object.entries(state).flatMap(([key, listing]) => {
    if (!key.startsWith("StandardListing:") || !listing?.title || !listing?.url) return [];
    const evidence = `${listing.title} ${listing.description ?? ""}`;
    const modelKey = classifyUsed(listing.title);
    const price = Number(listing.price?.amount) / 100;
    if (!modelKey || !isGripThree(evidence) || /\b(brand new|new sealed|unused)\b/i.test(evidence)
      || !Number.isFinite(price) || price < 25 || price > 1200) return [];
    return [{
      id: `used:kijiji:${listing.id ?? key}`, modelKey, store: "Kijiji Canada", title: listing.title,
      price, compareAtPrice: null, url: listing.url, condition: "Used · local listing",
      currency: "CAD", gripSizes: [targetGripSize],
    }];
  });
}

async function fetchSidelineUsed(query) {
  const url = `https://sidelineswap.com/search?q=${encodeURIComponent(query)}&condition%5B%5D=17`;
  const response = await fetch(url, {
    headers: { accept: "text/html", "accept-language": "en-US,en;q=.8", "user-agent": "Mozilla/5.0 (compatible; BaselinePriceTracker/1.0)" },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`SidelineSwap: HTTP ${response.status}`);
  const root = nextData(await response.text());
  const candidates = [];
  const seen = new Set();
  const queue = [root];
  while (queue.length) {
    const value = queue.shift();
    if (!value || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);
    if (value.id && value.name && value.url && value.state === "available"
      && value.category_1 === "tennis-racquet-sports" && value.category_2 === "tennis") candidates.push(value);
    queue.push(...Object.values(value));
  }
  return candidates.flatMap((listing) => {
    const modelKey = classifyUsed(listing.name);
    const price = Number(listing.price);
    if (!modelKey || !isGripThree(listing.name) || !Number.isFinite(price) || price < 20 || price > 1000) return [];
    return [{
      id: `used:sideline:${listing.id}`, modelKey, store: "SidelineSwap", title: listing.name,
      price, compareAtPrice: Number(listing.list_price) > price ? Number(listing.list_price) : null,
      url: listing.url, condition: "Used · marketplace", currency: "USD", gripSizes: [targetGripSize],
    }];
  });
}

async function fetchUsedRetailer([store, origin, url, kind]) {
  if (kind) return [];
  const catalogUrl = store === "RacquetGuys" ? "https://racquetguys.ca/collections/used-tennis-racquets/products.json?limit=250" : url;
  const products = [];
  for (let page = 1; page <= 4; page += 1) {
    const pageUrl = new URL(catalogUrl);
    pageUrl.searchParams.set("limit", "250");
    pageUrl.searchParams.set("page", String(page));
    const response = await fetch(pageUrl, {
      headers: { accept: "application/json", "user-agent": "BaselinePriceTracker/1.0" },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`${store} used inventory: HTTP ${response.status}`);
    const batch = (await response.json()).products ?? [];
    products.push(...batch);
    if (batch.length < 250) break;
  }
  return products.flatMap((product) => {
    if (!/\b(demo|used|pre[- ]owned|preowned)\b/i.test(product.title)) return [];
    const modelKey = classifyUsed(product.title);
    if (!modelKey) return [];
    const variants = product.variants.filter((variant) => variant.available && isGripThree(`${variant.option1 ?? ""} ${variant.title}`));
    const prices = variants.map((variant) => Number(variant.price)).filter((price) => Number.isFinite(price) && price > 0);
    if (!prices.length) return [];
    return [{
      id: `used:${store}:${product.handle}`, modelKey, store, title: product.title,
      price: Math.min(...prices), compareAtPrice: null, url: `${origin}/products/${product.handle}`,
      condition: /demo/i.test(product.title) ? "Demo" : "Used", currency: "CAD", gripSizes: [targetGripSize],
    }];
  });
}

const stringGaugeOrder = ["15", "15L", "16", "16L", "17", "17L", "18", "18L", "19", "20", "22"];

function stringBrand(value, title = "") {
  const raw = String(value ?? "").trim();
  const knownBrands = new Map([
    ["ashaway", "Ashaway"], ["babolat", "Babolat"], ["diadem", "Diadem"],
    ["dunlop", "Dunlop"], ["forten", "Forten"], ["gamma", "Gamma"],
    ["gosen", "Gosen"], ["grapplesnake", "Grapplesnake"], ["head", "Head"],
    ["kirschbaum", "Kirschbaum"], ["klip", "Klip"], ["luxilon", "Luxilon"],
    ["prince", "Prince"], ["restring", "ReString"], ["solinco", "Solinco"],
    ["tecnifibre", "Tecnifibre"], ["toroline", "Toroline"], ["tourna", "Tourna"],
    ["volkl", "Volkl"], ["völkl", "Volkl"], ["weiss cannon", "Weiss Cannon"],
    ["wilson", "Wilson"], ["yonex", "Yonex"],
  ]);
  const normalizedTitle = String(title ?? "").trim().toLocaleLowerCase("en-CA");
  for (const [key, brand] of knownBrands) {
    if (normalizedTitle === key || normalizedTitle.startsWith(`${key} `)) return brand;
  }
  const aliases = new Map([
    ["babolat canada", "Babolat"], ["toroline string", "Toroline"],
  ]);
  const normalizedRaw = raw.toLocaleLowerCase("en-CA");
  return knownBrands.get(normalizedRaw) ?? aliases.get(normalizedRaw) ?? (raw || "Unknown");
}

function stringGauges(...parts) {
  const gauges = new Set();
  const text = parts.filter(Boolean).join(" ").replaceAll(",", ".");
  for (const match of text.matchAll(/\b(15L|16L|17L|18L|15|16|17|18|19|20|22)\s*(?:g|ga|gauge)\b/gi)) gauges.add(match[1].toUpperCase());
  for (const match of text.matchAll(/\b(15L|16L|17L|18L|15|16|17|18|19|20|22)\s*\/\s*(?:1[.]?\d{2})\b/gi)) gauges.add(match[1].toUpperCase());
  for (const match of text.matchAll(/\b(15L|16L|17L|18L|15|16|17|18|19|20|22)\s+(?=tennis\b|string\b)/gi)) gauges.add(match[1].toUpperCase());
  for (const match of text.matchAll(/\b(15L|16L|17L|18L|15|16|17|18|19|20|22)\s*\/\s*(15L|16L|17L|18L|15|16|17|18|19|20|22)\b/gi)) {
    gauges.add(match[1].toUpperCase());
    gauges.add(match[2].toUpperCase());
  }
  for (const part of parts) {
    const exact = String(part ?? "").trim().match(/^(15L|16L|17L|18L|15|16|17|18|19|20|22)$/i);
    if (exact) gauges.add(exact[1].toUpperCase());
  }
  const metricMap = new Map([
    ["105", "20"], ["110", "19"], ["115", "18"], ["118", "18"],
    ["120", "17L"], ["122", "17L"], ["123", "17"], ["124", "17"], ["125", "17"],
    ["127", "16L"], ["128", "16L"], ["129", "16L"], ["130", "16"], ["132", "16"],
    ["135", "15L"], ["138", "15L"], ["140", "15"],
  ]);
  for (const match of text.matchAll(/\b1[.](05|10|15|18|20|22|23|24|25|27|28|29|30|32|35|38|40)\s*(?:mm)?\b/gi)) {
    const gauge = metricMap.get(`1${match[1]}`);
    if (gauge) gauges.add(gauge);
  }
  for (const match of text.matchAll(/(?:^|[\s/(])(105|110|115|118|120|122|123|124|125|127|128|129|130|132|135|138|140)(?=$|[\s/)])/g)) {
    const gauge = metricMap.get(match[1]);
    if (gauge) gauges.add(gauge);
  }
  return [...gauges].sort((a, b) => stringGaugeOrder.indexOf(a) - stringGaugeOrder.indexOf(b));
}

function stringType(evidence) {
  if (/\bhybrid\b|champion'?s choice|\bduo (?:power|control|feel)\b/i.test(evidence)) return "Hybrid";
  if (/natural gut|\bvs touch\b|\btonic[+<]?\b|wilson gut|\bklip legend\b/i.test(evidence)) return "Natural gut";
  if (/synthetic gut|syn gut|syn\. gut|\bduraflex\b|og[- ]sheep|\bgosen micro\b/i.test(evidence)) return "Synthetic gut";
  if (/multifilament|\bmultifeel\b|\bvelocity mlt\b|\bnxt\b|\bsensation\b|\bx[- ]?one biphase\b|\bnrg2\b|\btgv\b|\bxcel\b|\bxalt\b|\baddixion\b|\biconic\b|\brip control\b|\breflex mlt\b|\btriax\b|\bhdmx\b|\bpremier control\b/i.test(evidence)) return "Multifilament";
  if (/polyester|co[- ]?poly|\bpoly ?tour\b|\brpm (?:blast|rough|team|power|hurricane)\b|\balu power\b|\bbig banger\b|\b4g\b|\belement\b|\bhyper[- ]g\b|\btour bite\b|\bconfidential\b|\brevolution\b|\boutlast\b|\blynx\b|\bhawk\b|\bsonic pro\b|\brazor (?:code|soft|spin)\b|\bblack code\b|\bred code\b|\bice code\b|\bcyclone\b|\brevolve\b|\bexplosive\b|\bsolstice\b|\bflash\b/i.test(evidence)) return "Polyester";
  if (/monofilament|\brpm soft\b|\borigin\b/i.test(evidence)) return "Monofilament";
  return "Other";
}

function stringFormat(evidence) {
  if (/half[- ]?set|1\/2\s*set|\b(?:5[.]5|6|6[.]1|6[.]5|7)\s*m\b|\b(?:18|19|20|21|22)\s*(?:ft|feet|['’])\b/i.test(evidence)) return "Half set";
  if (/\breel\b|\b(?:100|110|200|220|330)\s*m\b|\b(?:328|360|656|660|722|726|1000)\s*(?:ft|feet|['’])\b/i.test(evidence)) return "Reel";
  if (/\b(?:full\s*)?set\b|\b(?:10|11|11[.]5|12|12[.]2|12[.]8|13|13[.]5|13[.]7)\s*m\b|\b(?:33|36|39|40|42|45)\s*(?:ft|feet|['’])\b/i.test(evidence)) return "Set";
  return "Single package";
}

function isTennisStringProduct(product) {
  const evidence = `${product.title ?? ""} ${product.product_type ?? ""} ${product.tags ?? ""} ${product.vendor ?? ""}`;
  if (/badminton|pickleball|squash|stringing (?:service|machine)|rental|replacement grip|overgrip|dampener|vibration|grommet|\b(?:14|15[.]5|16)mm\b/i.test(evidence)) return false;
  return /tennis string|\bstrings?\b|polyester|co[- ]?poly|multifilament|synthetic gut|natural gut|\bhybrid\b|champion'?s choice|\bpoly ?tour\b|\brpm (?:blast|rough|team|power|soft|hurricane)\b|\bhyper[- ]g\b|\btour bite\b|\bconfidential\b|\bvelocity mlt\b|\bnxt\b|\bx[- ]?one biphase\b|\balu power\b|\blynx\b|\bhawk\b/i.test(evidence);
}

async function fetchStringStore([store, origin, catalogUrl]) {
  const products = [];
  for (let page = 1; page <= 4; page += 1) {
    const url = new URL(catalogUrl);
    url.searchParams.set("limit", "250");
    url.searchParams.set("page", String(page));
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "BaselinePriceTracker/1.0" },
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) throw new Error(`${store} strings: HTTP ${response.status}`);
    const batch = (await response.json()).products ?? [];
    products.push(...batch);
    if (batch.length < 250) break;
  }
  return products.flatMap((product) => {
    if (!isTennisStringProduct(product)) return [];
    const variants = (product.variants ?? []).filter((variant) => variant.available && Number(variant.price) > 0);
    if (!variants.length) return [];
    const catalogueEvidence = `${product.title ?? ""} ${product.product_type ?? ""} ${product.tags ?? ""} ${product.vendor ?? ""}`;
    const variantsByFormat = new Map();
    for (const variant of variants) {
      const variantEvidence = [variant.title, variant.option1, variant.option2, variant.option3]
        .filter((value) => value && !/^default title$/i.test(String(value))).join(" ");
      const variantFormat = stringFormat(variantEvidence);
      const format = variantFormat === "Single package" ? stringFormat(catalogueEvidence) : variantFormat;
      variantsByFormat.set(format, [...(variantsByFormat.get(format) ?? []), variant]);
    }
    return [...variantsByFormat.entries()].map(([format, formatVariants]) => {
      const variantEvidence = formatVariants.flatMap((variant) => [variant.title, variant.option1, variant.option2, variant.option3]);
      const gauges = stringGauges(catalogueEvidence, ...variantEvidence);
      const currentPrice = Math.min(...formatVariants.map((variant) => Number(variant.price)).filter(Number.isFinite));
      const comparePrices = formatVariants.map((variant) => Number(variant.compare_at_price))
        .filter((price) => Number.isFinite(price) && price > currentPrice);
      return {
        id: `string:${store}:${product.handle}:${format.toLowerCase().replaceAll(" ", "-")}`,
        store,
        title: product.title,
        url: `${origin}/products/${product.handle}`,
        price: currentPrice,
        compareAtPrice: comparePrices.length ? Math.min(...comparePrices) : null,
        inStock: true,
        brand: stringBrand(product.vendor || product.title.split(/\s+/)[0], product.title),
        type: stringType(catalogueEvidence),
        gauges: gauges.length ? gauges : ["Not listed"],
        format,
      };
    });
  });
}

const accessoryCategoryOrder = [
  "Replacement grips", "Overgrips", "Grommets & bumpers", "Dampeners",
  "Racquet bags", "Customization", "Racquet care",
];

function accessoryCategory(evidence) {
  const text = String(evidence ?? "");
  if (/\bgrommets?\b|bumper\s*(?:guard|set|kit)|grommet\s*(?:set|kit)|replacement\s+bumper/i.test(text)) return "Grommets & bumpers";
  if (/\bover[- ]?grips?\b|super\s+grap|pro\s+overgrip|tourna\s+grip|grap\s+overgrip/i.test(text)) return "Overgrips";
  if (/replacement\s+grip|base\s+grip|leather\s+grip|synthetic\s+grip|comfort\s+grip|cushion\s+grip|hydrosorb|syntec|resipro|sublime\s+grip|premium\s+grip/i.test(text)) return "Replacement grips";
  if (/\bdampen(?:er|ers|or|ors)\b|vibration\s*(?:dampener|dampening|stopper|absorber)|shock\s*(?:trap|absorber)|pro\s+feel/i.test(text)) return "Dampeners";
  if (/racquet\s*(?:bag|backpack|case)|racket\s*(?:bag|backpack|case)|tennis\s*(?:bag|backpack)|\b(?:bags?|backpacks?|racqpacks?|duffels?|duffles?)\b.*\b(?:tennis|racquet|racket)\b|\b(?:tennis|racquet|racket)\b.*\b(?:bags?|backpacks?|racqpacks?|duffels?|duffles?)\b|\b(?:3|6|8|9|10|12|15)\s*(?:racquet|racket)\b/i.test(text)) return "Racquet bags";
  if (/lead\s*(?:tape|strips?)|tungsten\s*tape|weighted?\s*tape|balancer\s*tape|power\s*balance\s*(?:slim\s*)?tape|racquet\s*weight|racket\s*weight|balance\s*weight|customi[sz](?:ation|ing)|weight\s*(?:strip|system)|heat\s*shrink\s*sleeve/i.test(text)) return "Customization";
  if (/head\s*(?:guard|tape)|protective\s*tape|protection\s*tape|super\s*tape|finishing\s*tape|grip\s*(?:band|ring)|butt\s*cap|racquet\s*cover|racket\s*cover|stencil\s*(?:ink|card)|grip\s*powder|rosin\s*bag/i.test(text)) return "Racquet care";
  return null;
}

function accessoryBrand(value, title = "") {
  const raw = String(value ?? "").trim();
  const knownBrands = new Map([
    ["babolat", "Babolat"], ["diadem", "Diadem"], ["dunlop", "Dunlop"],
    ["gamma", "Gamma"], ["head", "Head"], ["kimony", "Kimony"],
    ["luxilon", "Luxilon"], ["prince", "Prince"], ["pro kennex", "ProKennex"],
    ["prokennex", "ProKennex"], ["solinco", "Solinco"], ["tecnifibre", "Tecnifibre"],
    ["tourna", "Tourna"], ["volkl", "Volkl"], ["vÃ¶lkl", "Volkl"],
    ["wilson", "Wilson"], ["yonex", "Yonex"],
  ]);
  const normalizedTitle = String(title ?? "").trim().toLocaleLowerCase("en-CA");
  for (const [key, brand] of knownBrands) {
    if (normalizedTitle === key || normalizedTitle.startsWith(`${key} `)) return brand;
  }
  const normalizedRaw = raw.toLocaleLowerCase("en-CA");
  const aliases = new Map([["babolat canada", "Babolat"], ["head canada", "Head"]]);
  if (knownBrands.has(normalizedRaw)) return knownBrands.get(normalizedRaw);
  if (aliases.has(normalizedRaw)) return aliases.get(normalizedRaw);
  if (!raw || /tennis|sports|racquet|racket|shop|store|canada|science|runners/i.test(raw)) return "Other";
  return raw;
}

function accessoryDetail(evidence, category) {
  const text = String(evidence ?? "");
  const pack = text.match(/\b(?:pack\s+of\s+|)(\d{1,2})\s*(?:pack|pk|pieces?|pcs?|count|ct)\b/i)
    ?? text.match(/\b(\d{1,2})[- ]pack\b/i);
  if (pack) return `${pack[1]}-pack`;
  if (category === "Racquet bags") {
    const capacity = text.match(/\b(1|2|3|4|6|8|9|10|12|15)\s*(?:racquet|racket)s?\b/i);
    if (capacity) return `${capacity[1]}-racquet`;
    if (/backpack/i.test(text)) return "Backpack";
    if (/duffel|duffle/i.test(text)) return "Duffel";
  }
  if (category === "Grommets & bumpers") return "Replacement set";
  if (category === "Customization") {
    const weight = text.match(/\b(\d+(?:[.]\d+)?)\s*g(?:ram)?s?\b/i);
    if (weight) return `${weight[1]} g`;
  }
  return "Single item";
}

function isTennisAccessoryProduct(product, catalogUrl = "") {
  const productEvidence = `${product.title ?? ""} ${product.product_type ?? ""} ${product.tags ?? ""} ${product.vendor ?? ""}`;
  const evidence = `${productEvidence} ${catalogUrl}`;
  if (/(?:badminton|pickleball|padel|squash|racquetball|table\s*tennis|ping\s*pong)/i.test(productEvidence) && !/\btennis\b/i.test(productEvidence)) return false;
  if (/shoe|sock|shirt|shorts?|skirt|dress|jacket|hoodie|tennis\s*balls?|\bball\s*bag\b|sub_balls|stringing\s*(?:service|machine)|tennis\s*strings?|gift\s*card/i.test(productEvidence)) return false;
  return accessoryCategory(evidence) !== null;
}

async function fetchAccessoryStore([store, origin, catalogUrl]) {
  const products = [];
  for (let page = 1; page <= 4; page += 1) {
    const url = new URL(catalogUrl);
    url.searchParams.set("limit", "250");
    url.searchParams.set("page", String(page));
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "BaselinePriceTracker/1.0" },
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) throw new Error(`${store} accessories: HTTP ${response.status}`);
    const batch = (await response.json()).products ?? [];
    products.push(...batch);
    if (batch.length < 250) break;
  }
  return products.flatMap((product) => {
    if (!isTennisAccessoryProduct(product, catalogUrl)) return [];
    const variants = (product.variants ?? []).filter((variant) => variant.available && Number(variant.price) > 0);
    if (!variants.length) return [];
    const evidence = `${product.title ?? ""} ${product.product_type ?? ""} ${product.tags ?? ""} ${product.vendor ?? ""} ${catalogUrl}`;
    const category = accessoryCategory(evidence);
    if (!category) return [];
    const prices = variants.map((variant) => Number(variant.price)).filter(Number.isFinite);
    const currentPrice = Math.min(...prices);
    const comparePrices = variants.map((variant) => Number(variant.compare_at_price))
      .filter((price) => Number.isFinite(price) && price > currentPrice);
    return [{
      id: `accessory:${store}:${product.handle}`,
      store,
      title: product.title,
      url: `${origin}/products/${product.handle}`,
      price: currentPrice,
      compareAtPrice: comparePrices.length ? Math.min(...comparePrices) : null,
      inStock: true,
      brand: accessoryBrand(product.vendor || product.title.split(/\s+/)[0], product.title),
      category,
      detail: accessoryDetail(`${evidence} ${variants.map((variant) => variant.title).join(" ")}`, category),
    }];
  });
}

const ballTypeOrder = ["Extra duty", "Regular duty", "All court", "Clay court", "Pressureless", "Junior", "Other"];

function tennisBallType(evidence) {
  const text = String(evidence ?? "");
  if (/extra\s*duty|hard\s*court/i.test(text)) return "Extra duty";
  if (/regular\s*duty|soft\s*court/i.test(text)) return "Regular duty";
  if (/clay(?:\s*court)?|roland\s*garros/i.test(text)) return "Clay court";
  if (/all\s*court/i.test(text)) return "All court";
  if (/pressureless/i.test(text)) return "Pressureless";
  if (/stage\s*[123]|red\s*(?:felt|dot)|orange\s*(?:felt|dot)|green\s*(?:felt|dot)|starter|junior|transition/i.test(text)) return "Junior";
  return "Other";
}

function tennisBallPackage(evidence) {
  const text = String(evidence ?? "").replace(/[×x]/g, " x ");
  const cans = text.match(/(?:case|carton|box)[^0-9]{0,12}(\d{1,3})\s*cans?/i)
    ?? text.match(/(\d{1,3})\s*cans?[^a-z]{0,8}(?:case|carton|box)/i);
  const ballsPerCan = text.match(/(\d{1,2})\s*(?:ball|balls)[- ]*(?:per\s*)?can/i)
    ?? text.match(/can[^0-9]{0,8}(?:of\s*)?(\d{1,2})/i);
  const totalBalls = text.match(/(?:bag|bucket|pack|case|box)[^0-9]{0,12}(?:of\s*)?(\d{1,3})\s*(?:tennis\s*)?balls?/i)
    ?? text.match(/(\d{1,3})\s*(?:tennis\s*)?balls?[^a-z]{0,8}(?:bag|bucket|pack|case|box)/i);
  if (cans) return ballsPerCan ? `Case · ${cans[1]} cans × ${ballsPerCan[1]} balls` : `Case · ${cans[1]} cans`;
  if (/\bcase|carton\b/i.test(text)) return "Case";
  if (ballsPerCan) return `Can · ${ballsPerCan[1]} balls`;
  if (totalBalls) return `${totalBalls[1]}-ball package`;
  if (/\bcan\b/i.test(text)) return "Can";
  return "Package size not listed";
}

function isTennisBallProduct(product, catalogUrl = "") {
  const productEvidence = `${product.title ?? ""} ${product.product_type ?? ""} ${product.tags ?? ""} ${product.vendor ?? ""}`;
  if (/(?:pickleball|padel|squash|racquetball|table\s*tennis|ping\s*pong|baseball|softball|golf)/i.test(productEvidence)) return false;
  if (/ball\s*(?:machine|hopper|cart|basket|collector|pickup|pick-up|tube|bag|clip|keychain)|dryer\s*balls?|dog\s*(?:toy|ball)/i.test(productEvidence)) return false;
  return /\btennis\s*balls?\b/i.test(productEvidence)
    || /\b(?:us\s*open|australian\s*open|roland\s*garros|wimbledon|championship|tour\s*premier|triniti|proPenn|marathon)\b/i.test(productEvidence)
    || /tennis-balls?/i.test(catalogUrl);
}

async function fetchBallStore([store, origin, catalogUrl]) {
  const products = [];
  for (let page = 1; page <= 4; page += 1) {
    const url = new URL(catalogUrl);
    url.searchParams.set("limit", "250");
    url.searchParams.set("page", String(page));
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "BaselinePriceTracker/1.0" },
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) throw new Error(`${store} tennis balls: HTTP ${response.status}`);
    const batch = (await response.json()).products ?? [];
    products.push(...batch);
    if (batch.length < 250) break;
  }
  return products.flatMap((product) => {
    if (!isTennisBallProduct(product, catalogUrl)) return [];
    const productEvidence = `${product.title ?? ""} ${product.product_type ?? ""} ${product.tags ?? ""} ${product.vendor ?? ""}`;
    return (product.variants ?? []).flatMap((variant) => {
      const price = Number(variant.price);
      if (!variant.available || !Number.isFinite(price) || price <= 0) return [];
      const variantEvidence = `${productEvidence} ${variant.title ?? ""}`;
      const compareAtPrice = Number(variant.compare_at_price);
      return [{
        id: `ball:${store}:${product.handle}:${variant.id ?? tennisBallPackage(variantEvidence)}`,
        store,
        title: product.title,
        url: `${origin}/products/${product.handle}`,
        price,
        compareAtPrice: Number.isFinite(compareAtPrice) && compareAtPrice > price ? compareAtPrice : null,
        inStock: true,
        brand: accessoryBrand(product.vendor || product.title.split(/\s+/)[0], product.title),
        type: tennisBallType(variantEvidence),
        package: tennisBallPackage(variantEvidence),
      }];
    });
  });
}

async function fetchStore([store, origin, url, kind]) {
  if (kind === "amazon") return fetchAmazon(store, origin);
  if (kind === "woocommerce") return fetchWooCommerce(store, origin, url);
  if (kind === "lightspeed") return fetchMatchpoint(store, origin, url);
  if (kind === "wix") return fetchWix(store, origin, url);
  if (kind === "structured") return fetchStructured(store, origin, url);
  const products = await fetchShopifyCatalogs(store, url);
  return products.flatMap((product) => {
    const productName = `${product.vendor ?? ""} ${product.title ?? ""}`.trim();
    if (isAccessory(productName)) return [];
    const parentModelKey = classify(productName);
    const matchingVariants = product.variants.map((variant) => ({
      variant,
      gripSizes: offerGripSizes(product.title, [`${variant.option1 ?? ""} ${variant.title}`]),
      modelKey: classify(`${productName} ${variant.title ?? ""} ${variant.sku ?? ""}`) ?? parentModelKey ?? "other-sale",
    })).filter(({ variant, gripSizes }) => variant.available && gripSizes.length);
    const groups = new Map();
    for (const item of matchingVariants) groups.set(item.modelKey, [...(groups.get(item.modelKey) ?? []), item]);
    return [...groups].flatMap(([modelKey, group]) => {
      const prices = group.map(({ variant }) => Number(variant.price)).filter(Number.isFinite);
      if (!prices.length) return [];
      const saleVariants = group.filter(({ variant }) => Number(variant.compare_at_price) > Number(variant.price));
      if (modelKey === "other-sale" && !specialEditionName(productName) && saleVariants.length === 0) return [];
      const comparePrices = group.map(({ variant }) => Number(variant.compare_at_price)).filter(Number.isFinite);
      const variantLabel = group[0]?.variant.title?.split(" / ")[0];
      return [{
      id: `${store}:${product.handle}:${modelKey}`,
      modelKey,
      store,
      title: groups.size > 1 && variantLabel ? `${product.title} — ${variantLabel}` : product.title,
      price: Math.min(...prices),
      compareAtPrice: comparePrices.length ? Math.min(...comparePrices) : null,
      url: `${origin}/products/${product.handle}`,
      specs: extractRacquetSpecs(`${productName} ${group.map(({ variant }) => `${variant.title ?? ""} ${variant.sku ?? ""}`).join(" ")} ${product.body_html ?? ""}`, store === "Babolat Canada" ? "Babolat official" : store, `${origin}/products/${product.handle}`),
      gripSizes: [...new Set(group.flatMap(({ gripSizes }) => gripSizes))],
    }];
    });
  });
}

async function readPrevious() {
  try { return JSON.parse(await readFile(statePath, "utf8")); }
  catch { return { offers: {}, belowTarget: [] }; }
}

function freshOffers(offers, checkedAt) {
  return offers.map((offer) => ({ ...offer, sourceState: "fresh", lastChecked: checkedAt }));
}

function staleFallback(offers, failedStores, previousCheckedAt, checkedAt) {
  const cutoff = Date.parse(checkedAt) - 24 * 60 * 60 * 1000;
  return offers.filter((offer) => {
    const seenAt = Date.parse(offer.lastChecked ?? previousCheckedAt ?? "");
    return failedStores.has(offer.store) && Number.isFinite(seenAt) && seenAt >= cutoff;
  }).map((offer) => ({ ...offer, sourceState: "stale", lastChecked: offer.lastChecked ?? previousCheckedAt }));
}

function mergeFreshWithFallback(fresh, stale) {
  const freshIds = new Set(fresh.map((offer) => offer.id));
  return mergeOffersById([...fresh, ...stale.filter((offer) => !freshIds.has(offer.id))]);
}

const previous = await readPrevious();
const checkedAt = new Date().toISOString();
let enabledNames = null;
let configuredApifyToken = "";
let configuredEbayCredentials = null;
try {
  let settings;
  try { settings = JSON.parse(await readFile(process.env.BASELINE_SETTINGS_FILE ?? "/app/.data/baseline-settings.json", "utf8")); }
  catch {
    const settingsResponse = await fetch(`${process.env.BASELINE_URL ?? "http://localhost:3000"}/api/tracker`, { signal: AbortSignal.timeout(3000) });
    settings = await settingsResponse.json();
  }
  if (Object.hasOwn(gripMeasurements, settings.gripSize)) targetGripSize = settings.gripSize;
  if (settings.targets && typeof settings.targets === "object") Object.assign(targets, settings.targets);
  if (Array.isArray(settings.modelOrder)) {
    const configuredModels = settings.modelOrder.filter((modelKey) => modelNames[modelKey]).slice(0, 6);
    if (configuredModels.length) facebookModelKeys = configuredModels;
  }
  enabledNames = new Set((settings.retailers ?? []).filter((retailer) => retailer.enabled).map((retailer) => retailer.name));
} catch {
  // The standalone monitor can still run when the local UI server is offline.
}
const targetedModelKey = String(process.env.BASELINE_TARGET_MODEL_KEY ?? "").trim();
if (targetedModelKey) {
  if (!modelNames[targetedModelKey] || !manufacturerFor(targetedModelKey)) throw new Error(`Unknown targeted model: ${targetedModelKey}`);
  const targetSpecFields = ["head", "weight", "strungWeight", "balance", "strungBalance", "swingweight", "pattern", "beam", "length", "stiffness", "composition", "tension", "productCode", "gripSizes", "color", "madeIn", "recommendedStrings", "imageUrl"];
  const previousOffers = Object.values(previous.offers ?? {});
  const targetOffers = previousOffers.filter((offer) => offer.modelKey === targetedModelKey && /^https?:\/\//.test(offer.url ?? ""));
  const retailerPages = [...new Map(targetOffers.map((offer) => [offer.store, offer])).values()].slice(0, 4);
  const retailerSettled = await Promise.allSettled(retailerPages.map(async (offer) => {
    const response = await fetch(offer.url, {
      headers: { accept: "text/html,application/xhtml+xml", "accept-language": "en-CA,en;q=.8", "user-agent": "Mozilla/5.0 (compatible; BaselinePriceTracker/1.0)" },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`${offer.store} HTTP ${response.status}`);
    const html = await response.text();
    const specs = extractRacquetSpecs(html, offer.store, offer.url);
    const imageUrl = officialImageUrl(html, offer.url);
    return specs || imageUrl ? { offer, specs: { ...(specs ?? {}), ...(imageUrl ? { imageUrl } : {}) } } : null;
  }));
  const retailerCandidates = retailerSettled
    .filter((result) => result.status === "fulfilled" && result.value?.specs)
    .map((result) => result.value)
    .sort((a, b) => targetSpecFields.filter((field) => b.specs[field]).length - targetSpecFields.filter((field) => a.specs[field]).length);
  let officialSpec = null;
  let officialError = null;
  try { officialSpec = await fetchManufacturerSpec(targetedModelKey); }
  catch (error) { officialError = error?.message ?? "Manufacturer request failed"; }
  const existingSpec = previous.racquetSpecs?.[targetedModelKey] ?? {};
  const retailerSpec = retailerCandidates[0]?.specs ?? {};
  const mergedSpec = {
    ...Object.fromEntries(Object.entries(existingSpec).filter(([, value]) => value)),
    ...Object.fromEntries(Object.entries(retailerSpec).filter(([, value]) => value)),
    ...Object.fromEntries(Object.entries(officialSpec ?? {}).filter(([, value]) => value)),
  };
  const refreshedOffers = Object.fromEntries(Object.entries(previous.offers ?? {}).map(([id, offer]) => {
    const refreshed = retailerCandidates.find((candidate) => candidate.offer.id === offer.id);
    return [id, refreshed ? { ...offer, specs: { ...(offer.specs ?? {}), ...refreshed.specs } } : offer];
  }));
  const racquetSpecs = { ...(previous.racquetSpecs ?? {}), [targetedModelKey]: mergedSpec };
  const refreshResult = {
    modelKey: targetedModelKey,
    manufacturer: manufacturerFor(targetedModelKey),
    ok: Boolean(officialSpec || retailerCandidates.length),
    fields: targetSpecFields.filter((field) => mergedSpec[field]).length,
    image: Boolean(mergedSpec.imageUrl),
    retailerSources: retailerCandidates.length,
    error: officialSpec || retailerCandidates.length ? null : (officialError ?? "No matching manufacturer or retailer record"),
    checkedAt,
  };
  const manufacturerSpecResults = [
    ...(previous.manufacturerSpecResults ?? []).filter((result) => result.modelKey !== targetedModelKey),
    refreshResult,
  ];
  await mkdir(new URL("../.data/", import.meta.url), { recursive: true });
  await writeFile(statePath, JSON.stringify({
    ...previous,
    offers: refreshedOffers,
    racquetSpecs,
    // A single-model refresh only changes descriptive specs and artwork. Keep
    // the last completed market-wide retailer consensus until the scheduled
    // catalogue pass can recompute it with a complete evidence set.
    specValidation: previous.specValidation ?? {},
    manufacturerSpecCheckedAt: { ...(previous.manufacturerSpecCheckedAt ?? {}), [targetedModelKey]: checkedAt },
    manufacturerSpecResults,
    modelSelectionRefreshes: { ...(previous.modelSelectionRefreshes ?? {}), [targetedModelKey]: refreshResult },
  }, null, 2));
  console.log(JSON.stringify(refreshResult));
  process.exit(refreshResult.ok ? 0 : 1);
}
configuredApifyToken = await apifyToken();
configuredEbayCredentials = await ebayCredentials();
const activeFeeds = (enabledNames ? feeds.filter(([store]) => enabledNames.has(store)) : feeds)
  .filter(([, , , kind]) => kind !== "manual");
const settled = await settleInPool(activeFeeds, fetchStore, 8);
const retailerResults = settled.map((result, index) => ({
  store: activeFeeds[index][0],
  ok: result.status === "fulfilled",
  offers: result.status === "fulfilled" ? result.value.length : 0,
  durationMs: result.durationMs,
  error: result.status === "rejected" ? (result.reason?.message ?? "Unknown store failure") : null,
}));
const failedRetailers = new Set(retailerResults.filter((result) => !result.ok).map((result) => result.store));
const freshRetailOffers = freshOffers(settled.flatMap((result) => result.status === "fulfilled" ? result.value : []), checkedAt);
const staleRetailOffers = staleFallback(Object.values(previous.offers ?? {}), failedRetailers, previous.checkedAt, checkedAt);
const collectedOffers = mergeFreshWithFallback(freshRetailOffers, staleRetailOffers);
const activeStringFeeds = enabledNames ? stringFeeds.filter(([store]) => enabledNames.has(store)) : stringFeeds;
const stringSettled = await settleInPool(activeStringFeeds, fetchStringStore, 5);
const stringSourceResults = stringSettled.map((result, index) => ({
  store: activeStringFeeds[index][0],
  ok: result.status === "fulfilled",
  offers: result.status === "fulfilled" ? result.value.length : 0,
  durationMs: result.durationMs,
  error: result.status === "rejected" ? (result.reason?.message ?? "Unknown string-feed failure") : null,
}));
const failedStringStores = new Set(stringSourceResults.filter((result) => !result.ok).map((result) => result.store));
const stringCandidates = mergeFreshWithFallback(
  freshOffers(stringSettled.flatMap((result) => result.status === "fulfilled" ? result.value : []), checkedAt),
  staleFallback(previous.stringOffers ?? [], failedStringStores, previous.checkedAt, checkedAt),
);
const stringOffers = [...new Map(stringCandidates
  .map((offer) => [offer.id, offer])).values()]
  .sort((a, b) => a.type.localeCompare(b.type) || a.title.localeCompare(b.title) || a.price - b.price);
const activeAccessoryFeeds = enabledNames ? accessoryFeeds.filter(([store]) => enabledNames.has(store)) : accessoryFeeds;
const accessorySettled = await settleInPool(activeAccessoryFeeds, fetchAccessoryStore, 5);
const accessorySourceResults = accessorySettled.map((result, index) => ({
  store: activeAccessoryFeeds[index][0],
  ok: result.status === "fulfilled",
  offers: result.status === "fulfilled" ? result.value.length : 0,
  durationMs: result.durationMs,
  error: result.status === "rejected" ? (result.reason?.message ?? "Unknown accessory-feed failure") : null,
}));
const failedAccessoryStores = new Set(accessorySourceResults.filter((result) => !result.ok).map((result) => result.store));
const accessoryCandidates = mergeFreshWithFallback(
  freshOffers(accessorySettled.flatMap((result) => result.status === "fulfilled" ? result.value : []), checkedAt),
  staleFallback(previous.accessoryOffers ?? [], failedAccessoryStores, previous.checkedAt, checkedAt),
);
const accessoryOffers = [...new Map(accessoryCandidates
  .map((offer) => [offer.id, offer])).values()]
  .sort((a, b) => accessoryCategoryOrder.indexOf(a.category) - accessoryCategoryOrder.indexOf(b.category)
    || a.brand.localeCompare(b.brand) || a.title.localeCompare(b.title) || a.price - b.price);
const activeBallFeeds = enabledNames ? ballFeeds.filter(([store]) => enabledNames.has(store)) : ballFeeds;
const ballSettled = await settleInPool(activeBallFeeds, fetchBallStore, 5);
const ballSourceResults = ballSettled.map((result, index) => ({
  store: activeBallFeeds[index][0],
  ok: result.status === "fulfilled",
  offers: result.status === "fulfilled" ? result.value.length : 0,
  durationMs: result.durationMs,
  error: result.status === "rejected" ? (result.reason?.message ?? "Unknown tennis-ball feed failure") : null,
}));
const failedBallStores = new Set(ballSourceResults.filter((result) => !result.ok).map((result) => result.store));
const ballCandidates = mergeFreshWithFallback(
  freshOffers(ballSettled.flatMap((result) => result.status === "fulfilled" ? result.value : []), checkedAt),
  staleFallback(previous.ballOffers ?? [], failedBallStores, previous.checkedAt, checkedAt),
);
const ballOffers = [...new Map(ballCandidates.map((offer) => [offer.id, offer])).values()]
  .sort((a, b) => ballTypeOrder.indexOf(a.type) - ballTypeOrder.indexOf(b.type)
    || a.brand.localeCompare(b.brand) || a.title.localeCompare(b.title) || a.price - b.price);
const specialOffers = collectedOffers
  .filter((offer) => specialEditionName(offer.title) && (offer.gripSizes ?? []).some((gripSize) => Object.hasOwn(gripMeasurements, gripSize)))
  .sort((a, b) => a.title.localeCompare(b.title) || a.price - b.price);
const offers = collectedOffers.filter((offer) => (offer.gripSizes ?? []).includes(targetGripSize));
const usedRetailerFeeds = activeFeeds.filter(([, , , kind]) => !kind);
const concurrentUsedTasks = [
  ...usedRetailerFeeds.map((feed) => ({ source: `${feed[0]} used inventory`, run: () => fetchUsedRetailer(feed) })),
  ...usedMarketplaceQueries().map((query) => ({ source: `Kijiji: ${query}`, run: () => fetchKijijiUsed(query) })),
  ...usedMarketplaceQueries().map((query) => ({ source: `SidelineSwap: ${query}`, run: () => fetchSidelineUsed(query) })),
  ...(configuredEbayCredentials
    ? [{ source: "eBay Canada (official Browse API · selected frames)", run: () => fetchEbayUsed(facebookModelKeys, configuredEbayCredentials) }]
    : []),
];
const facebookUsedTasks = configuredApifyToken
  ? [{ source: "Facebook Marketplace (Apify · selected frames)", run: () => fetchApifyFacebookUsed(facebookMarketplaceQueries(), configuredApifyToken) }]
  : facebookMarketplaceQueries().map((query) => ({ source: `Facebook Marketplace: ${query}`, run: () => fetchFacebookUsed(query) }));
const usedTasks = [...concurrentUsedTasks, ...facebookUsedTasks];
const concurrentUsedSettled = await settleInPool(concurrentUsedTasks, (task) => task.run(), 6);
// Browserless plans commonly limit simultaneous browser sessions. Run Facebook
// searches one at a time so a scan cannot consume its own concurrency allowance.
const facebookUsedSettled = [];
for (const task of facebookUsedTasks) {
  const startedAt = Date.now();
  try { facebookUsedSettled.push({ status: "fulfilled", value: await task.run(), durationMs: Date.now() - startedAt }); }
  catch (reason) { facebookUsedSettled.push({ status: "rejected", reason, durationMs: Date.now() - startedAt }); }
}
const usedSettled = [...concurrentUsedSettled, ...facebookUsedSettled];
const usedOffers = [...new Map(usedSettled.flatMap((result) => result.status === "fulfilled" ? result.value : [])
  .map((offer) => [offer.id, offer])).values()]
  .sort((a, b) => (a.currency === b.currency ? a.price - b.price : a.currency === "CAD" ? -1 : 1));
const usedSourceResults = usedSettled.map((result, index) => ({
  source: usedTasks[index].source, ok: result.status === "fulfilled",
  offers: result.status === "fulfilled" ? result.value.length : 0,
  durationMs: result.durationMs,
  configured: true,
  error: result.status === "rejected" ? (result.reason?.message ?? "Unknown used-source failure") : null,
}));
if (!configuredEbayCredentials) {
  usedSourceResults.push({
    source: "eBay Canada (official Browse API · selected frames)",
    ok: false,
    offers: 0,
    configured: false,
    error: "Browse API credentials are not configured",
  });
}
const current = Object.fromEntries(offers.map((offer) => [offer.id, offer]));
const comparablePrevious = previous.gripSize === targetGripSize ? previous : { offers: {}, belowTarget: [], dropHistory: [] };
const drops = offers.filter((offer) => comparablePrevious.offers[offer.id]?.price > offer.price).map((offer) => ({
  ...offer,
  previousPrice: comparablePrevious.offers[offer.id].price,
  saved: comparablePrevious.offers[offer.id].price - offer.price,
  detectedAt: checkedAt,
}));
const cutoff = Date.now() - 24 * 60 * 60 * 1000;
const dropHistory = [...(comparablePrevious.dropHistory ?? []).filter((drop) => Date.parse(drop.detectedAt) >= cutoff), ...drops]
  .filter((drop, index, all) => all.findIndex((candidate) => candidate.id === drop.id && candidate.detectedAt === drop.detectedAt) === index);
const belowTarget = offers.filter((offer) => offer.price <= targets[offer.modelKey]);
const previousHits = new Set(comparablePrevious.belowTarget ?? []);
const newTargetHits = belowTarget.filter((offer) => !previousHits.has(offer.id));
const otherSaleDeals = offers
  .filter((offer) => offer.modelKey === "other-sale" && offer.compareAtPrice > offer.price)
  .sort((a, b) => a.price - b.price)
  .slice(0, 18);

const racquetSpecs = { ...(previous.racquetSpecs ?? {}) };
for (const specs of Object.values(racquetSpecs)) {
  const stiffnessValue = Number.parseFloat(specs?.stiffness);
  if (specs?.stiffness && (!Number.isFinite(stiffnessValue) || stiffnessValue < 40 || stiffnessValue > 85)) delete specs.stiffness;
}
const manufacturerSpecAuditVersion = 5;
const manufacturerSpecCheckedAt = previous.manufacturerSpecAuditVersion === manufacturerSpecAuditVersion ? { ...(previous.manufacturerSpecCheckedAt ?? {}) } : {};
const forceModelAudit = process.env.BASELINE_FORCE_MODEL_AUDIT === "1";
const specFields = ["head", "weight", "strungWeight", "balance", "strungBalance", "swingweight", "pattern", "beam", "length", "stiffness", "composition", "tension", "productCode", "gripSizes", "color", "madeIn", "recommendedStrings", "imageUrl"];
const crossCheckFields = ["head", "weight", "strungWeight", "balance", "swingweight", "pattern", "beam", "length", "stiffness", "tension", "productCode"];

function normalizedSpecEvidence(field, value) {
  const raw = String(value ?? "").trim().toLowerCase()
    .replaceAll("×", "x").replaceAll("²", "2").replace(/[–—]/g, "-")
    .replace(/\s+/g, " ");
  if (!raw) return null;
  if (field === "productCode") return raw.replace(/[^a-z0-9]/g, "");
  if (field === "pattern") return raw.replace(/[^0-9x]/g, "");
  if (field === "beam") return raw.replace(/[^0-9.\-]/g, "");
  const number = Number(raw.match(/\d+(?:\.\d+)?/)?.[0]);
  if (field === "stiffness" && (!Number.isFinite(number) || number < 40 || number > 85)) return null;
  if (["head", "weight", "strungWeight", "balance", "swingweight", "length", "stiffness"].includes(field) && Number.isFinite(number)) {
    return `${field}:${number.toFixed(field === "balance" || field === "length" ? 1 : 0)}`;
  }
  return raw.replace(/[^a-z0-9.\-]/g, "");
}

function buildSpecValidation(allOffers, publishedSpecs) {
  const evidence = new Map();
  for (const offer of allOffers) {
    if (offer.modelKey === "other-sale" || !offer.specs || offer.sourceState === "stale" || /official/i.test(offer.specs.source ?? "")) continue;
    if (!evidence.has(offer.modelKey)) evidence.set(offer.modelKey, new Map());
    const byField = evidence.get(offer.modelKey);
    for (const field of crossCheckFields) {
      const value = offer.specs[field];
      const normalized = normalizedSpecEvidence(field, value);
      if (!normalized) continue;
      if (!byField.has(field)) byField.set(field, new Map());
      const groups = byField.get(field);
      const group = groups.get(normalized) ?? { value, stores: new Map() };
      group.stores.set(offer.store, offer.url);
      groups.set(normalized, group);
    }
  }

  const validation = {};
  for (const modelKey of Object.keys(modelNames)) {
    const byField = evidence.get(modelKey) ?? new Map();
    const official = /official/i.test(publishedSpecs[modelKey]?.source ?? "") ? publishedSpecs[modelKey] : null;
    const fieldChecks = {};
    const consensus = {};
    const sourceMap = new Map();
    let confirmedFields = 0;
    let conflictFields = 0;
    let consensusFields = 0;
    for (const field of crossCheckFields) {
      const groups = [...(byField.get(field)?.entries() ?? [])]
        .sort((a, b) => b[1].stores.size - a[1].stores.size || a[0].localeCompare(b[0]));
      const [consensusKey, bestGroup] = groups[0] ?? [];
      if (!bestGroup || bestGroup.stores.size < 2) continue;
      consensusFields += 1;
      consensus[field] = bestGroup.value;
      for (const [store, url] of bestGroup.stores) sourceMap.set(store, url);
      const officialValue = official?.[field];
      const officialKey = normalizedSpecEvidence(field, officialValue);
      const matchesOfficial = officialKey ? officialKey === consensusKey : null;
      if (matchesOfficial === true) confirmedFields += 1;
      if (matchesOfficial === false) conflictFields += 1;
      fieldChecks[field] = {
        status: matchesOfficial === true ? "confirmed" : matchesOfficial === false ? "conflict" : "retailer-consensus",
        official: officialValue ?? null,
        consensus: bestGroup.value,
        retailers: [...bestGroup.stores.keys()].sort((a, b) => a.localeCompare(b, "en-CA")),
      };
    }
    const sources = [...sourceMap.entries()].map(([store, url]) => ({ store, url }));
    const status = conflictFields > 0 ? "conflict"
      : official && confirmedFields >= 2 ? "confirmed"
      : !official && consensusFields >= 2 ? "retailer-consensus"
      : "insufficient";
    validation[modelKey] = { status, sources, confirmedFields, conflictFields, consensusFields, fieldChecks, consensus };
  }
  return validation;
}
for (const offer of offers) {
  if (offer.modelKey === "other-sale" || !offer.specs) continue;
  const existing = racquetSpecs[offer.modelKey] ?? {};
  const existingScore = specFields.filter((field) => existing[field]).length;
  const candidateScore = specFields.filter((field) => offer.specs[field]).length;
  const existingIsOfficial = /official/i.test(existing.source ?? "");
  if (!existingIsOfficial && (!existing.source || candidateScore > existingScore)) racquetSpecs[offer.modelKey] = offer.specs;
}
const marketModelKeys = [...new Set(offers.map((offer) => offer.modelKey).filter((modelKey) => modelKey !== "other-sale"))];
const manufacturerAuditCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
const activeModelKeys = new Set([...facebookModelKeys, ...marketModelKeys]);
const manufacturerSpecResults = [];
const unresolvedModelKeys = Object.keys(modelNames).filter((modelKey) => manufacturerFor(modelKey)).filter((modelKey) => {
  const lastAudit = Date.parse(manufacturerSpecCheckedAt[modelKey] ?? "");
  return forceModelAudit || !Number.isFinite(lastAudit) || lastAudit < manufacturerAuditCutoff;
}).sort((a, b) => {
  const aChecked = Date.parse(manufacturerSpecCheckedAt[a] ?? "") || 0;
  const bChecked = Date.parse(manufacturerSpecCheckedAt[b] ?? "") || 0;
  if (aChecked !== bChecked) return aChecked - bChecked;
  if (activeModelKeys.has(a) !== activeModelKeys.has(b)) return activeModelKeys.has(a) ? -1 : 1;
  const aMissing = specFields.filter((field) => !racquetSpecs[a]?.[field]).length;
  const bMissing = specFields.filter((field) => !racquetSpecs[b]?.[field]).length;
  return bMissing - aMissing || a.localeCompare(b);
}).slice(0, forceModelAudit ? 72 : 48);
for (let offset = 0; offset < unresolvedModelKeys.length; offset += 6) {
  const batch = unresolvedModelKeys.slice(offset, offset + 6);
  const resolved = await Promise.allSettled(batch.map(fetchManufacturerSpec));
  resolved.forEach((result, index) => {
    const modelKey = batch[index];
    manufacturerSpecCheckedAt[modelKey] = checkedAt;
    manufacturerSpecResults.push({ modelKey, manufacturer: manufacturerFor(modelKey), ok: result.status === "fulfilled" && Boolean(result.value), fields: result.status === "fulfilled" && result.value ? specFields.filter((field) => result.value[field]).length : 0, image: result.status === "fulfilled" && Boolean(result.value?.imageUrl), error: result.status === "rejected" ? (result.reason?.message ?? "Manufacturer request failed") : result.value ? null : "No matching official product record" });
    if (result.status !== "fulfilled" || !result.value) return;
    const existing = racquetSpecs[modelKey] ?? {};
    racquetSpecs[modelKey] = {
      ...Object.fromEntries(Object.entries(existing).filter(([, value]) => value)),
      ...Object.fromEntries(Object.entries(result.value).filter(([, value]) => value)),
      source: result.value.source,
      sourceUrl: result.value.sourceUrl,
    };
  });
}

const specValidation = buildSpecValidation(offers, racquetSpecs);

const allSourceResults = [...retailerResults, ...stringSourceResults, ...accessorySourceResults, ...ballSourceResults, ...usedSourceResults];
const configuredSourceResults = allSourceResults.filter((result) => result.configured !== false);
const allCurrentOffers = [...offers, ...stringOffers, ...accessoryOffers, ...ballOffers];
const sourceHealth = {
  liveSources: configuredSourceResults.filter((result) => result.ok).length,
  totalSources: configuredSourceResults.length,
  failures: configuredSourceResults.filter((result) => !result.ok).length,
  freshOffers: allCurrentOffers.filter((offer) => offer.sourceState !== "stale").length + usedOffers.length,
  staleOffers: allCurrentOffers.filter((offer) => offer.sourceState === "stale").length,
  averageDurationMs: Math.round(configuredSourceResults.reduce((total, result) => total + (result.durationMs ?? 0), 0) / Math.max(configuredSourceResults.filter((result) => Number.isFinite(result.durationMs)).length, 1)),
};

await mkdir(new URL("../.data/", import.meta.url), { recursive: true });
await writeFile(statePath, JSON.stringify({
  checkedAt,
  gripSize: targetGripSize,
  offers: current,
  belowTarget: belowTarget.map((offer) => offer.id),
  retailerResults,
  dropHistory,
  usedOffers,
  usedSourceResults,
  specialOffers,
  stringOffers,
  stringSourceResults,
  accessoryOffers,
  accessorySourceResults,
  ballOffers,
  ballSourceResults,
  racquetSpecs,
  specValidation,
  manufacturerSpecAuditVersion,
  manufacturerSpecCheckedAt,
  manufacturerSpecResults,
  sourceHealth,
}, null, 2));

console.log(JSON.stringify({
  checkedAt,
  storesChecked: retailerResults.filter((result) => result.ok).length,
  retailersChecked: activeFeeds.map(([store]) => store),
  failures: retailerResults.filter((result) => !result.ok).map((result) => result.error),
  retailerResults,
  sourceHealth,
  usedOffersFound: usedOffers.length,
  specialOffersFound: specialOffers.length,
  stringOffersFound: stringOffers.length,
  stringSourceResults,
  accessoryOffersFound: accessoryOffers.length,
  accessorySourceResults,
  ballOffersFound: ballOffers.length,
  ballSourceResults,
  racquetSpecsFound: Object.keys(racquetSpecs).length,
  specValidation: Object.fromEntries(Object.entries(specValidation).map(([modelKey, result]) => [modelKey, { status: result.status, sources: result.sources.length, confirmedFields: result.confirmedFields, conflictFields: result.conflictFields }])),
  manufacturerSpecResults,
  usedSourceResults,
  offersFound: offers.length,
  drops: drops.map((offer) => ({ ...offer, model: modelNames[offer.modelKey] })),
  newTargetHits: newTargetHits.map((offer) => ({ ...offer, model: modelNames[offer.modelKey], target: targets[offer.modelKey] })),
  otherSaleDeals,
  bestPrices: Object.fromEntries(Object.keys(modelNames).map((modelKey) => {
    const best = offers.filter((offer) => offer.modelKey === modelKey).sort((a, b) => a.price - b.price)[0];
    return [modelNames[modelKey], best ? { price: best.price, store: best.store, url: best.url } : null];
  })),
}, null, 2));
