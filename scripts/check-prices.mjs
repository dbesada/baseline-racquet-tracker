import { mkdir, readFile, writeFile } from "node:fs/promises";

const feeds = [
  ["ATR Sports", "https://atrsports.com/en-ca", "https://atrsports.com/en-ca/collections/tennis-racquets/products.json?limit=250"],
  ["Just Tennis", "https://www.justtennis.ca", "https://www.justtennis.ca/collections/racquets/products.json?limit=250"],
  ["Brown's Sports", "https://www.brownssports.ca", "https://www.brownssports.ca/collections/tennis-racquets/products.json?limit=250"],
  ["Tads Sporting Goods", "https://tadssportinggoods.ca", "https://tadssportinggoods.ca/collections/tennis-rackets/products.json?limit=250"],
  ["Courtside Racquets", "https://courtsideracquets.ca", "https://courtsideracquets.ca/collections/racquets/products.json?limit=250"],
];

const modelNames = {
  "blade-v8": "Wilson Blade 98 v8",
  "blade-v9": "Wilson Blade 98 v9",
  "ezone-98": "Yonex EZONE 98",
  "pure-aero-98": "Babolat Pure Aero 98",
};

const targets = { "blade-v8": 225, "blade-v9": 275, "ezone-98": 300, "pure-aero-98": 300 };
const statePath = new URL("../.data/baseline-monitor.json", import.meta.url);

function classify(title) {
  const value = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (/\b(demo|used|grommet|junior|jr|98l|98 tour)\b/.test(value)) return null;
  if (/blade 98/.test(value) && /\bv8\b/.test(value)) return "blade-v8";
  if (/blade 98/.test(value) && /\bv9\b/.test(value)) return "blade-v9";
  if (/ezone 98\b/.test(value)) return "ezone-98";
  if (/pure aero 98\b/.test(value)) return "pure-aero-98";
  return null;
}

async function fetchStore([store, origin, url]) {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "BaselinePriceTracker/1.0" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`${store}: HTTP ${response.status}`);
  const { products = [] } = await response.json();
  return products.flatMap((product) => {
    const modelKey = classify(product.title);
    if (!modelKey) return [];
    const prices = product.variants.filter((variant) => variant.available).map((variant) => Number(variant.price)).filter(Number.isFinite);
    if (!prices.length) return [];
    return [{
      id: `${store}:${product.handle}`,
      modelKey,
      store,
      title: product.title,
      price: Math.min(...prices),
      url: `${origin}/products/${product.handle}`,
    }];
  });
}

async function readPrevious() {
  try { return JSON.parse(await readFile(statePath, "utf8")); }
  catch { return { offers: {}, belowTarget: [] }; }
}

const previous = await readPrevious();
const settled = await Promise.allSettled(feeds.map(fetchStore));
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

await mkdir(new URL("../.data/", import.meta.url), { recursive: true });
await writeFile(statePath, JSON.stringify({
  checkedAt: new Date().toISOString(),
  offers: current,
  belowTarget: belowTarget.map((offer) => offer.id),
}, null, 2));

console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  storesChecked: settled.filter((result) => result.status === "fulfilled").length,
  failures: settled.filter((result) => result.status === "rejected").map((result) => result.reason?.message ?? "Unknown store failure"),
  offersFound: offers.length,
  drops: drops.map((offer) => ({ ...offer, model: modelNames[offer.modelKey] })),
  newTargetHits: newTargetHits.map((offer) => ({ ...offer, model: modelNames[offer.modelKey], target: targets[offer.modelKey] })),
  bestPrices: Object.fromEntries(Object.keys(modelNames).map((modelKey) => {
    const best = offers.filter((offer) => offer.modelKey === modelKey).sort((a, b) => a.price - b.price)[0];
    return [modelNames[modelKey], best ? { price: best.price, store: best.store, url: best.url } : null];
  })),
}, null, 2));
