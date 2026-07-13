import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

type D1Result<T = Record<string, unknown>> = { results?: T[] };

type ProductVariant = {
  available: boolean;
  price: string;
  compare_at_price: string | null;
  title: string;
  option1?: string | null;
};

type ShopifyProduct = {
  handle: string;
  title: string;
  variants: ProductVariant[];
};

type Feed = {
  key: string;
  name: string;
  origin: string;
  url: string;
  kind?: "shopify" | "amazon" | "manual";
};

type ParsedOffer = {
  id: string;
  modelKey: string;
  store: string;
  title: string;
  url: string;
  currentPrice: number | null;
  compareAtPrice: number | null;
  inStock: boolean;
  gripSizes: string[];
};

const feeds: Feed[] = [
  {
    key: "atr-sports",
    name: "ATR Sports",
    origin: "https://atrsports.com/en-ca",
    url: "https://atrsports.com/en-ca/collections/tennis-racquets/products.json?limit=250",
  },
  {
    key: "just-tennis",
    name: "Just Tennis",
    origin: "https://www.justtennis.ca",
    url: "https://www.justtennis.ca/collections/racquets/products.json?limit=250",
  },
  {
    key: "browns-sports",
    name: "Brown's Sports",
    origin: "https://www.brownssports.ca",
    url: "https://www.brownssports.ca/collections/tennis-racquets/products.json?limit=250",
  },
  {
    key: "tads-sporting-goods",
    name: "Tads Sporting Goods",
    origin: "https://tadssportinggoods.ca",
    url: "https://tadssportinggoods.ca/collections/tennis-rackets/products.json?limit=250",
  },
  {
    key: "courtside-racquets",
    name: "Courtside Racquets",
    origin: "https://courtsideracquets.ca",
    url: "https://courtsideracquets.ca/collections/racquets/products.json?limit=250",
  },
  {
    key: "racquetguys",
    name: "RacquetGuys",
    origin: "https://racquetguys.ca",
    url: "https://racquetguys.ca/products.json?limit=250",
  },
  {
    key: "merchant-of-tennis",
    name: "Merchant of Tennis",
    origin: "https://www.merchantoftennis.com",
    url: "https://www.merchantoftennis.com/collections/tennis-racquets/products.json?limit=250",
  },
  {
    key: "raquetteville",
    name: "RaquetteVille",
    origin: "https://raquetteville.ca",
    url: "https://raquetteville.ca/collections/tennis-racquets/products.json?limit=250",
  },
  {
    key: "yumo-pro-shop",
    name: "Yumo Pro Shop",
    origin: "https://yumo.ca",
    url: "https://yumo.ca/collections/tennis-rackets/products.json?limit=250",
  },
  {
    key: "prince-canada",
    name: "Prince Canada",
    origin: "https://princecanada.ca",
    url: "https://princecanada.ca/collections/racquets/products.json?limit=250",
  },
  {
    key: "amazon-ca",
    name: "Amazon.ca",
    origin: "https://www.amazon.ca",
    url: "https://www.amazon.ca/s?k=tennis+racket+grip+3+sale",
    kind: "amazon",
  },
  {
    key: "amazon-com",
    name: "Amazon.com",
    origin: "https://www.amazon.com",
    url: "https://www.amazon.com/s?k=tennis+racket+grip+3+sale",
    kind: "amazon",
  },
  // Legitimate Canadian catalogs worth checking manually; their storefronts are
  // dynamic/anti-bot and do not expose a stable public product feed.
  { key: "sport-chek", name: "Sport Chek", origin: "https://www.sportchek.ca", url: "https://www.sportchek.ca/en/cat/sports-tennis/tennis/racquets-DC200002.html", kind: "manual" },
  { key: "sporting-life", name: "Sporting Life", origin: "https://www.sportinglife.ca", url: "https://www.sportinglife.ca/en-CA/tennis/tennis-racquets/", kind: "manual" },
  { key: "altitude-sports", name: "Altitude Sports", origin: "https://www.altitude-sports.com", url: "https://www.altitude-sports.com/c/tennis", kind: "manual" },
  { key: "canadian-tire", name: "Canadian Tire", origin: "https://www.canadiantire.ca", url: "https://www.canadiantire.ca/en/cat/sports-recreation/tennis/tennis-racquets-DC0002487.html", kind: "manual" },
  { key: "decathlon-canada", name: "Decathlon Canada", origin: "https://www.decathlon.ca", url: "https://www.decathlon.ca/en/c/tennis/racquets", kind: "manual" },
  { key: "racquets-pro-shop", name: "Racquets Pro Shop", origin: "https://www.racquetsproshop.ca", url: "https://www.racquetsproshop.ca/tennis-racquet", kind: "manual" },
  { key: "tennis-central", name: "Tennis Central", origin: "https://www.tenniscentral.ca", url: "https://www.tenniscentral.ca/collections/tennis-racquets", kind: "manual" },
  { key: "tennis-giant", name: "Tennis Giant", origin: "https://www.tennisgiant.com", url: "https://www.tennisgiant.com/collections/tennis-racquets", kind: "manual" },
  { key: "tcc-pro-shop", name: "TCC Pro Shop", origin: "https://proshop.tennisclubs.ca", url: "https://proshop.tennisclubs.ca/collections/tennis-racquets", kind: "manual" },
];

const amazonSearches = ["Wilson Blade 98", "Yonex EZONE 98", "Babolat Pure Aero 98"];

const defaultTargets: Record<string, number> = {
  "blade-v8": 225,
  "blade-v9": 275,
  "ezone-98": 300,
  "pure-aero-98": 300,
};

const modelNames: Record<string, string> = {
  "blade-v8": "Wilson Blade 98 v8",
  "blade-v9": "Wilson Blade 98 v9",
  "ezone-98": "Yonex EZONE 98",
  "pure-aero-98": "Babolat Pure Aero 98",
};

function db() {
  return env.DB as D1Database;
}

async function ensureSchema() {
  const database = db();
  await database.batch([
    database.prepare(`CREATE TABLE IF NOT EXISTS offers (
      id TEXT PRIMARY KEY, model_key TEXT NOT NULL, store TEXT NOT NULL,
      title TEXT NOT NULL, url TEXT NOT NULL, current_price REAL,
      previous_price REAL, compare_at_price REAL, in_stock INTEGER NOT NULL,
      grip_sizes TEXT NOT NULL DEFAULT '[]', last_checked TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT, offer_id TEXT NOT NULL,
      model_key TEXT NOT NULL, price REAL NOT NULL, checked_at TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS targets (
      model_key TEXT PRIMARY KEY, target_price REAL NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT, checked_at TEXT NOT NULL,
      stores_checked INTEGER NOT NULL, offers_found INTEGER NOT NULL,
      failures INTEGER NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS retailer_settings (
      retailer_key TEXT PRIMARY KEY, retailer_name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1
    )`),
    database.prepare("CREATE INDEX IF NOT EXISTS price_history_model_idx ON price_history(model_key, checked_at)"),
  ]);

  await database.batch(
    Object.entries(defaultTargets).map(([key, value]) =>
      database.prepare("INSERT OR IGNORE INTO targets (model_key, target_price) VALUES (?, ?)").bind(key, value),
    ),
  );
  await database.batch(
    feeds.map((feed) => database.prepare(
      "INSERT OR IGNORE INTO retailer_settings (retailer_key, retailer_name, enabled) VALUES (?, ?, ?)",
    ).bind(feed.key, feed.name, feed.kind === "manual" ? 0 : 1)),
  );
}

async function getRetailerSettings() {
  await ensureSchema();
  const result = await db().prepare(
    "SELECT retailer_key AS key, retailer_name AS name, enabled FROM retailer_settings ORDER BY retailer_name",
  ).all();
  return ((result as D1Result<Record<string, unknown>>).results ?? []).map((row) => ({
    ...row,
    enabled: Boolean(row.enabled),
    kind: feeds.find((feed) => feed.key === row.key)?.kind ?? "shopify",
  }));
}

async function getEnabledFeeds() {
  const settings = await getRetailerSettings();
  const enabled = new Set(settings.filter((setting) => setting.enabled).map((setting) => setting.key));
  return feeds.filter((feed) => enabled.has(feed.key) && feed.kind !== "manual");
}

function classify(title: string): string | null {
  const normalized = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (/\b(demo|used|grommet|junior|jr)\b/.test(normalized)) return null;
  if (/\b(98l|98 tour)\b/.test(normalized)) return null;
  if (/blade 98/.test(normalized) && /\bv8\b/.test(normalized)) return "blade-v8";
  if (/blade 98/.test(normalized) && /\bv9\b/.test(normalized)) return "blade-v9";
  if (/ezone 98\b/.test(normalized)) return "ezone-98";
  if (/pure aero 98\b/.test(normalized)) return "pure-aero-98";
  return null;
}

function isGripThree(value: string) {
  const normalized = value.toLowerCase();
  return /(?:^|[\s(])l?3(?:$|[\s(])/.test(normalized) || /4\s*3\/8/.test(normalized);
}

function isAccessory(title: string) {
  return /\b(demo|used|grommet|junior|jr|bag|cover|case|string|grip|overgrip|shoe|sock|apparel|hat)\b/i.test(title);
}

function cleanGrip(value: string) {
  const match = value.match(/(?:4\s*)?(1\/8|1\/4|3\/8|1\/2|5\/8)|\bL([1-5])\b/i);
  if (!match) return isGripThree(value) ? "L3" : null;
  if (match[2]) return `L${match[2]}`;
  if (isGripThree(value)) return "L3";
  return `4 ${match[1]}`;
}

function parseAmazonPrice(block: string) {
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

async function fetchAmazon(feed: Feed): Promise<ParsedOffer[]> {
  const allOffers: ParsedOffer[] = [];
  for (const search of amazonSearches) {
    const response = await fetch(`${feed.origin}/s?k=${encodeURIComponent(`${search} grip 3`)}`, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-CA,en;q=0.8",
        "user-agent": "Mozilla/5.0 (compatible; BaselinePriceTracker/1.0)",
      },
      signal: AbortSignal.timeout(16000),
    });
    if (!response.ok) throw new Error(`${feed.name}: ${response.status}`);
    const html = await response.text();
    for (const block of html.split(/data-asin="/i).slice(1)) {
      const asin = block.split('"', 1)[0];
      if (!/^[A-Z0-9]{10}$/.test(asin)) continue;
      const title = block.match(/(?:a-truncate-full|a-size-(?:medium|base-plus)[^>]*a-text-normal)[^>]*>\s*([^<]{8,180})</i)?.[1]?.trim();
      if (!title) continue;
      const modelKey = classify(title);
      if (!modelKey) continue;
      const price = parseAmazonPrice(block);
      if (price === null) continue;
      allOffers.push({
        id: `${feed.name}:${asin}`,
        modelKey,
        store: feed.name,
        title,
        url: `${feed.origin}/dp/${asin}`,
        currentPrice: price,
        compareAtPrice: null,
        inStock: true,
        gripSizes: ["L3 (search-filtered)"],
      });
    }
  }
  return [...new Map(allOffers.map((offer) => [offer.id, offer])).values()];
}

async function fetchFeed(feed: Feed): Promise<ParsedOffer[]> {
  if (feed.kind === "amazon") return fetchAmazon(feed);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 14000);
  try {
    const response = await fetch(feed.url, {
      headers: {
        accept: "application/json",
        "user-agent": "BaselinePriceTracker/1.0 (+Canadian tennis price comparison)",
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${feed.name}: ${response.status}`);
    const payload = (await response.json()) as { products?: ShopifyProduct[] };
    return (payload.products ?? []).flatMap((product) => {
      const modelKey = classify(product.title) ?? "other-sale";
      if (modelKey === "other-sale" && isAccessory(product.title)) return [];
      const available = product.variants.filter((variant) => variant.available && isGripThree(`${variant.option1 ?? ""} ${variant.title}`));
      const prices = available.map((variant) => Number(variant.price)).filter(Number.isFinite);
      const saleVariants = available.filter((variant) => {
        const compareAt = Number(variant.compare_at_price);
        return Number.isFinite(compareAt) && compareAt > Number(variant.price);
      });
      if (modelKey === "other-sale" && saleVariants.length === 0) return [];
      const comparePrices = available
        .map((variant) => Number(variant.compare_at_price))
        .filter((price) => Number.isFinite(price) && price > 0);
      const grips = [...new Set(
        available
          .map((variant) => cleanGrip(`${variant.option1 ?? ""} ${variant.title}`))
          .filter((grip): grip is string => Boolean(grip)),
      )];
      return [{
        id: `${feed.name}:${product.handle}`,
        modelKey,
        store: feed.name,
        title: product.title,
        url: `${feed.origin}/products/${product.handle}`,
        currentPrice: prices.length ? Math.min(...prices) : null,
        compareAtPrice: comparePrices.length ? Math.min(...comparePrices) : null,
        inStock: available.length > 0,
        gripSizes: grips,
      }];
    });
  } finally {
    clearTimeout(timer);
  }
}

async function runCheck() {
  await ensureSchema();
  const checkedAt = new Date().toISOString();
  const enabledFeeds = await getEnabledFeeds();
  const results = await Promise.allSettled(enabledFeeds.map(fetchFeed));
  const offers = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const database = db();

  for (const offer of offers) {
    const previous = await database
      .prepare("SELECT current_price AS currentPrice FROM offers WHERE id = ?")
      .bind(offer.id)
      .first<{ currentPrice: number | null }>();
    await database.prepare(`INSERT INTO offers
      (id, model_key, store, title, url, current_price, previous_price, compare_at_price, in_stock, grip_sizes, last_checked)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        model_key=excluded.model_key, store=excluded.store, title=excluded.title,
        url=excluded.url, previous_price=offers.current_price,
        current_price=excluded.current_price, compare_at_price=excluded.compare_at_price,
        in_stock=excluded.in_stock, grip_sizes=excluded.grip_sizes,
        last_checked=excluded.last_checked`)
      .bind(
        offer.id, offer.modelKey, offer.store, offer.title, offer.url,
        offer.currentPrice, previous?.currentPrice ?? null, offer.compareAtPrice,
        offer.inStock ? 1 : 0, JSON.stringify(offer.gripSizes), checkedAt,
      ).run();

    if (offer.currentPrice !== null && offer.currentPrice !== previous?.currentPrice) {
      await database.prepare(
        "INSERT INTO price_history (offer_id, model_key, price, checked_at) VALUES (?, ?, ?, ?)",
      ).bind(offer.id, offer.modelKey, offer.currentPrice, checkedAt).run();
    }
  }

  await database.prepare(
    "INSERT INTO checks (checked_at, stores_checked, offers_found, failures) VALUES (?, ?, ?, ?)",
  ).bind(checkedAt, enabledFeeds.length, offers.length, results.filter((result) => result.status === "rejected").length).run();

  return getDashboard();
}

async function getDashboard() {
  await ensureSchema();
  const database = db();
  const [offersResult, targetsResult, checksResult, historyResult, retailerSettings] = await Promise.all([
    database.prepare(`SELECT id, model_key AS modelKey, store, title, url,
      current_price AS currentPrice, previous_price AS previousPrice,
      compare_at_price AS compareAtPrice, in_stock AS inStock,
      grip_sizes AS gripSizes, last_checked AS lastChecked
      FROM offers WHERE current_price IS NOT NULL ORDER BY model_key, current_price ASC`).all(),
    database.prepare("SELECT model_key AS modelKey, target_price AS targetPrice FROM targets").all(),
    database.prepare("SELECT checked_at AS checkedAt, stores_checked AS storesChecked, offers_found AS offersFound, failures FROM checks ORDER BY id DESC LIMIT 1").first(),
    database.prepare(`SELECT model_key AS modelKey, MIN(price) AS price, checked_at AS checkedAt
      FROM price_history GROUP BY model_key, checked_at ORDER BY checked_at DESC LIMIT 60`).all(),
    getRetailerSettings(),
  ]);

  const offers = ((offersResult as D1Result<Record<string, unknown>>).results ?? []).map((offer) => ({
    ...offer,
    inStock: Boolean(offer.inStock),
    gripSizes: JSON.parse(String(offer.gripSizes || "[]")),
  }));

  const targetMap = Object.fromEntries(
    ((targetsResult as D1Result<{ modelKey: string; targetPrice: number }>).results ?? [])
      .map((row) => [row.modelKey, row.targetPrice]),
  );

  return Response.json({
    offers,
    saleOffers: offers
      .filter((offer) => offer.modelKey === "other-sale" && offer.currentPrice !== null && offer.compareAtPrice !== null && offer.compareAtPrice > offer.currentPrice)
      .sort((a, b) => (a.currentPrice ?? Infinity) - (b.currentPrice ?? Infinity))
      .slice(0, 18),
    targets: targetMap,
    lastCheck: checksResult ?? null,
    history: (historyResult as D1Result).results ?? [],
    modelNames,
    retailers: retailerSettings,
    stores: retailerSettings.filter((retailer) => retailer.enabled && retailer.kind !== "manual").map((retailer) => retailer.name),
  });
}

export async function GET() {
  return getDashboard();
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("action") === "check") return runCheck();
  return Response.json({ error: "Unknown action" }, { status: 400 });
}

export async function PATCH(request: Request) {
  await ensureSchema();
  const body = await request.json() as { modelKey?: string; targetPrice?: number; retailerKey?: string; enabled?: boolean };
  if (body.retailerKey) {
    if (!feeds.some((feed) => feed.key === body.retailerKey) || typeof body.enabled !== "boolean") {
      return Response.json({ error: "Invalid retailer setting" }, { status: 400 });
    }
    await db().prepare("UPDATE retailer_settings SET enabled = ? WHERE retailer_key = ?")
      .bind(body.enabled ? 1 : 0, body.retailerKey).run();
    return getDashboard();
  }
  if (!body.modelKey || !(body.modelKey in defaultTargets) || !Number.isFinite(body.targetPrice) || Number(body.targetPrice) < 1) {
    return Response.json({ error: "Invalid target" }, { status: 400 });
  }
  await db().prepare("UPDATE targets SET target_price = ? WHERE model_key = ?")
    .bind(Number(body.targetPrice), body.modelKey).run();
  return getDashboard();
}
