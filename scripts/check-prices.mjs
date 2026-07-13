import { mkdir, readFile, writeFile } from "node:fs/promises";

const feeds = [
  ["ATR Sports", "https://atrsports.com/en-ca", "https://atrsports.com/en-ca/collections/tennis-racquets/products.json?limit=250"],
  ["Just Tennis", "https://www.justtennis.ca", "https://www.justtennis.ca/collections/racquets/products.json?limit=250"],
  ["Brown's Sports", "https://www.brownssports.ca", "https://www.brownssports.ca/collections/tennis-racquets/products.json?limit=250"],
  ["Tads Sporting Goods", "https://tadssportinggoods.ca", "https://tadssportinggoods.ca/collections/tennis-rackets/products.json?limit=250"],
  ["Courtside Racquets", "https://courtsideracquets.ca", "https://courtsideracquets.ca/collections/racquets/products.json?limit=250"],
  ["RacquetGuys", "https://racquetguys.ca", "https://racquetguys.ca/products.json?limit=250"],
  ["Merchant of Tennis", "https://www.merchantoftennis.com", "https://www.merchantoftennis.com/collections/tennis-racquets/products.json?limit=250"],
  ["RaquetteVille", "https://raquetteville.ca", "https://raquetteville.ca/collections/tennis-racquets/products.json?limit=250"],
  ["Yumo Pro Shop", "https://yumo.ca", "https://yumo.ca/collections/tennis-rackets/products.json?limit=250"],
  ["Prince Canada", "https://princecanada.ca", "https://princecanada.ca/collections/racquets/products.json?limit=250"],
  ["Amazon.ca", "https://www.amazon.ca", "https://www.amazon.ca/s?k=tennis+racket+grip+3+sale", "amazon"],
  ["Amazon.com", "https://www.amazon.com", "https://www.amazon.com/s?k=tennis+racket+grip+3+sale", "amazon"],
  ["Sport Chek", "https://www.sportchek.ca", "https://www.sportchek.ca/en/cat/sports-tennis/tennis/racquets-DC200002.html", "manual"],
  ["Sporting Life", "https://www.sportinglife.ca", "https://www.sportinglife.ca/en-CA/tennis/tennis-racquets/", "manual"],
  ["Altitude Sports", "https://www.altitude-sports.com", "https://www.altitude-sports.com/c/tennis", "manual"],
  ["Canadian Tire", "https://www.canadiantire.ca", "https://www.canadiantire.ca/en/cat/sports-recreation/tennis/tennis-racquets-DC0002487.html", "manual"],
  ["Decathlon Canada", "https://www.decathlon.ca", "https://www.decathlon.ca/en/c/tennis/racquets", "manual"],
  ["Racquets Pro Shop", "https://www.racquetsproshop.ca", "https://www.racquetsproshop.ca/tennis-racquet", "manual"],
  ["Tennis Central", "https://www.tenniscentral.ca", "https://www.tenniscentral.ca/collections/tennis-racquets", "manual"],
  ["Tennis Giant", "https://www.tennisgiant.com", "https://www.tennisgiant.com/collections/tennis-racquets", "manual"],
  ["TCC Pro Shop", "https://proshop.tennisclubs.ca", "https://proshop.tennisclubs.ca/collections/tennis-racquets", "manual"],
  ["Matchpoint", "https://matchpointstore.com", "https://matchpointstore.com/collections/tennis-racquets", "manual"],
  ["Tenniszon", "https://www.tenniszon.com", "https://www.tenniszon.com/collections/tennis-racquets", "manual"],
  ["Rackets & Runners", "https://racketsandrunners.ca", "https://racketsandrunners.ca/collections/tennis-racquets", "manual"],
  ["Game Set Match", "https://gamesetmatch.ca", "https://gamesetmatch.ca/collections/tennis-racquets", "manual"],
  ["Racquet Vault", "https://racquetvault.ca", "https://racquetvault.ca/collections/tennis-racquets/products.json?limit=250"],
  ["Courtside Tennis Academy", "https://courtsidetennisacademy.ca", "https://courtsidetennisacademy.ca/shop", "manual"],
  ["Performance Tennis Ottawa", "https://www.performancetennis.ca", "https://www.performancetennis.ca/shop", "manual"],
  ["Plock Tennis Club Shop", "https://www.plocktennisclub.ca", "https://www.plocktennisclub.ca/category/wilson-racquet", "manual"],
  ["Kevin Martin Tennis", "https://www.kevinmartinsport.com", "https://www.kevinmartinsport.com/tennis", "manual"],
];
const amazonSearches = ["Wilson Blade 98", "Yonex EZONE 98", "Babolat Pure Aero 98"];

const modelNames = {
  "blade-v10": "Wilson Blade 98 v10",
  "blade-v9": "Wilson Blade 98 v9",
  "blade-v8": "Wilson Blade 98 v8",
  "ezone-98": "Yonex EZONE 98",
  "ezone-100": "Yonex EZONE 100 (2025)",
  "pure-aero-98": "Babolat Pure Aero 98",
  "pure-aero-100": "Babolat Pure Aero (2026)",
  "clash-100": "Wilson Clash 100",
  "vcore-98": "Yonex VCORE 98",
  "vcore-100": "Yonex VCORE 100 8th Gen",
  "pure-drive-98": "Babolat Pure Drive 98",
  "pure-drive-100": "Babolat Pure Drive (2025)",
  "pro-staff-97": "Wilson Pro Staff 97",
  "gravity-mp-2025": "Head Gravity MP 2025",
  "tf40-290": "Tecnifibre TF40 290",
  "cx-400-tour": "Dunlop CX 400 Tour",
  "radical-mp-2025": "Head Radical MP 2025",
  "speed-pro-2026": "Head Speed Pro 2026",
  "rf-01-pro": "Wilson RF 01 Pro",
  "gravity-tour-2025": "Head Gravity Tour 2025",
};

const targets = {
  "blade-v10": 275, "blade-v9": 275, "blade-v8": 225,
  "ezone-98": 300, "ezone-100": 260,
  "pure-aero-98": 300, "pure-aero-100": 260,
  "clash-100": 250, "vcore-98": 275, "vcore-100": 260,
  "pure-drive-98": 275, "pure-drive-100": 260, "pro-staff-97": 275,
  "gravity-mp-2025": 260, "tf40-290": 230, "cx-400-tour": 230,
  "radical-mp-2025": 260, "speed-pro-2026": 275, "rf-01-pro": 300,
  "gravity-tour-2025": 275,
};
const statePath = new URL("../.data/baseline-monitor.json", import.meta.url);

function classify(title) {
  const raw = title.toLowerCase();
  const value = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (/\b(demo|used|grommet|junior|jr|98l|98 tour|100l|100 l|100ul|100 ul|100sl|100 sl|mp l|team|lite|rafa|x2|2 pack)\b/.test(value) || raw.includes("+")) return null;
  if (/pure drive (?:107|110)\b/.test(value)) return null;
  if (/\b(clash 100 pro|vcore 98 tour)\b/.test(value)) return null;
  if (/blade 98/.test(value) && /\bv10\b/.test(value)) return "blade-v10";
  if (/blade 98/.test(value) && /\bv9\b/.test(value)) return "blade-v9";
  if (/blade 98/.test(value) && /\bv8\b/.test(value)) return "blade-v8";
  if (/ezone 98\b/.test(value)) return "ezone-98";
  if (/ezone 100\b.*\b(?:8th gen|2025|blast blue)\b/.test(value)) return "ezone-100";
  if (/pure aero 98\b/.test(value)) return "pure-aero-98";
  if (/pure aero(?: 100)?\b.*\b(?:2026|gen ?9|9th generation)\b/.test(value)) return "pure-aero-100";
  if (/clash 100\b.*\bv3\b/.test(value)) return "clash-100";
  if (/vcore 98\b/.test(value)) return "vcore-98";
  if (/vcore 100\b.*\b(?:8th gen|2026)\b/.test(value)) return "vcore-100";
  if (/pure drive 98\b/.test(value)) return "pure-drive-98";
  if (/pure drive(?: 100)?\b.*\b(?:2025|gen 11|generation 11)\b/.test(value)) return "pure-drive-100";
  if (/pro staff 97\b/.test(value)) return "pro-staff-97";
  if (/gravity mp 2025\b/.test(value)) return "gravity-mp-2025";
  if (/tf 40 290\b|tf40 290\b/.test(value)) return "tf40-290";
  if (/cx 400 tour\b/.test(value)) return "cx-400-tour";
  if (/radical mp 2025\b/.test(value)) return "radical-mp-2025";
  if (/speed pro (?:2026|legend 2025)\b/.test(value)) return "speed-pro-2026";
  if (/rf 01 pro\b/.test(value)) return "rf-01-pro";
  if (/gravity tour 2025\b/.test(value)) return "gravity-tour-2025";
  return null;
}

function isGripThree(value) {
  const normalized = value.toLowerCase();
  return /(?:^|[\s(])l?3(?:$|[\s(])/.test(normalized) || /4\s*3\/8/.test(normalized);
}

function isAccessory(title) {
  return /\b(demo|used|grommet|junior|jr|bag|cover|case|string|grip|overgrip|shoe|sock|apparel|hat)\b/i.test(title);
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
  for (const search of amazonSearches) {
    const response = await fetch(`${origin}/s?k=${encodeURIComponent(`${search} grip 3`)}`, {
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
      if (!modelKey) continue;
      offers.push({ id: `${store}:${asin}`, modelKey, store, title, price, compareAtPrice: null, url: `${origin}/dp/${asin}` });
    }
  }
  return [...new Map(offers.map((offer) => [offer.id, offer])).values()];
}

async function fetchStore([store, origin, url, kind]) {
  if (kind === "manual") return [];
  if (kind === "amazon") return fetchAmazon(store, origin);
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "BaselinePriceTracker/1.0" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`${store}: HTTP ${response.status}`);
  const { products = [] } = await response.json();
  return products.flatMap((product) => {
    const modelKey = classify(product.title) ?? "other-sale";
    if (modelKey === "other-sale" && isAccessory(product.title)) return [];
    const gripThree = product.variants.filter((variant) => variant.available && isGripThree(`${variant.option1 ?? ""} ${variant.title}`));
    const prices = gripThree.map((variant) => Number(variant.price)).filter(Number.isFinite);
    if (!prices.length) return [];
    const saleVariants = gripThree.filter((variant) => Number(variant.compare_at_price) > Number(variant.price));
    if (modelKey === "other-sale" && saleVariants.length === 0) return [];
    return [{
      id: `${store}:${product.handle}`,
      modelKey,
      store,
      title: product.title,
      price: Math.min(...prices),
      compareAtPrice: Math.min(...gripThree.map((variant) => Number(variant.compare_at_price)).filter(Number.isFinite)),
      url: `${origin}/products/${product.handle}`,
    }];
  });
}

async function readPrevious() {
  try { return JSON.parse(await readFile(statePath, "utf8")); }
  catch { return { offers: {}, belowTarget: [] }; }
}

const previous = await readPrevious();
let enabledNames = null;
try {
  const settingsResponse = await fetch(`${process.env.BASELINE_URL ?? "http://localhost:3000"}/api/tracker`, { signal: AbortSignal.timeout(3000) });
  const settings = await settingsResponse.json();
  enabledNames = new Set((settings.retailers ?? []).filter((retailer) => retailer.enabled).map((retailer) => retailer.name));
} catch {
  // The standalone monitor can still run when the local UI server is offline.
}
const activeFeeds = (enabledNames ? feeds.filter(([store]) => enabledNames.has(store)) : feeds)
  .filter(([, , , kind]) => kind !== "manual");
const settled = await Promise.allSettled(activeFeeds.map(fetchStore));
const offers = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
const current = Object.fromEntries(offers.map((offer) => [offer.id, offer]));
const drops = offers.filter((offer) => previous.offers[offer.id]?.price > offer.price).map((offer) => ({
  ...offer,
  previousPrice: previous.offers[offer.id].price,
  saved: previous.offers[offer.id].price - offer.price,
}));
const belowTarget = offers.filter((offer) => offer.price <= targets[offer.modelKey]);
const previousHits = new Set(previous.belowTarget ?? []);
const newTargetHits = belowTarget.filter((offer) => !previousHits.has(offer.id));
const otherSaleDeals = offers
  .filter((offer) => offer.modelKey === "other-sale" && offer.compareAtPrice > offer.price)
  .sort((a, b) => a.price - b.price)
  .slice(0, 18);

await mkdir(new URL("../.data/", import.meta.url), { recursive: true });
await writeFile(statePath, JSON.stringify({
  checkedAt: new Date().toISOString(),
  offers: current,
  belowTarget: belowTarget.map((offer) => offer.id),
}, null, 2));

console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  storesChecked: settled.filter((result) => result.status === "fulfilled").length,
  retailersChecked: activeFeeds.map(([store]) => store),
  failures: settled.filter((result) => result.status === "rejected").map((result) => result.reason?.message ?? "Unknown store failure"),
  offersFound: offers.length,
  drops: drops.map((offer) => ({ ...offer, model: modelNames[offer.modelKey] })),
  newTargetHits: newTargetHits.map((offer) => ({ ...offer, model: modelNames[offer.modelKey], target: targets[offer.modelKey] })),
  otherSaleDeals,
  bestPrices: Object.fromEntries(Object.keys(modelNames).map((modelKey) => {
    const best = offers.filter((offer) => offer.modelKey === modelKey).sort((a, b) => a.price - b.price)[0];
    return [modelNames[modelKey], best ? { price: best.price, store: best.store, url: best.url } : null];
  })),
}, null, 2));
