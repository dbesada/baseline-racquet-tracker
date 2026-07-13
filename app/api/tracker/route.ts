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
  name: string;
  origin: string;
  url: string;
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
    name: "ATR Sports",
    origin: "https://atrsports.com/en-ca",
    url: "https://atrsports.com/en-ca/collections/tennis-racquets/products.json?limit=250",
  },
  {
    name: "Just Tennis",
    origin: "https://www.justtennis.ca",
    url: "https://www.justtennis.ca/collections/racquets/products.json?limit=250",
  },
  {
    name: "Brown's Sports",
    origin: "https://www.brownssports.ca",
    url: "https://www.brownssports.ca/collections/tennis-racquets/products.json?limit=250",
  },
  {
    name: "Tads Sporting Goods",
    origin: "https://tadssportinggoods.ca",
    url: "https://tadssportinggoods.ca/collections/tennis-rackets/products.json?limit=250",
  },
  {
    name: "Courtside Racquets",
    origin: "https://courtsideracquets.ca",
    url: "https://courtsideracquets.ca/collections/racquets/products.json?limit=250",
  },
  {
    name: "RacquetGuys",
    origin: "https://racquetguys.ca",
    url: "https://racquetguys.ca/products.json?limit=250",
  },
  {
    name: "Merchant of Tennis",
    origin: "https://www.merchantoftennis.com",
    url: "https://www.merchantoftennis.com/collections/tennis-racquets/products.json?limit=250",
  },
  {
    name: "RaquetteVille",
    origin: "https://raquetteville.ca",
    url: "https://raquetteville.ca/collections/tennis-racquets/products.json?limit=250",
  },
  {
    name: "Yumo Pro Shop",
    origin: "https://yumo.ca",
    url: "https://yumo.ca/collections/tennis-rackets/products.json?limit=250",
  },
  {
    name: "Prince Canada",
    origin: "https://princecanada.ca",
    url: "https://princecanada.ca/collections/racquets/products.json?limit=250",
  },
];

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
    database.prepare("CREATE INDEX IF NOT EXISTS price_history_model_idx ON price_history(model_key, checked_at)"),
  ]);

  await database.batch(
    Object.entries(defaultTargets).map(([key, value]) =>
      database.prepare("INSERT OR IGNORE INTO targets (model_key, target_price) VALUES (?, ?)").bind(key, value),
    ),
  );
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

async function fetchFeed(feed: Feed): Promise<ParsedOffer[]> {
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
  const results = await Promise.allSettled(feeds.map(fetchFeed));
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
  ).bind(checkedAt, feeds.length, offers.length, results.filter((result) => result.status === "rejected").length).run();

  return getDashboard();
}

async function getDashboard() {
  await ensureSchema();
  const database = db();
  const [offersResult, targetsResult, checksResult, historyResult] = await Promise.all([
    database.prepare(`SELECT id, model_key AS modelKey, store, title, url,
      current_price AS currentPrice, previous_price AS previousPrice,
      compare_at_price AS compareAtPrice, in_stock AS inStock,
      grip_sizes AS gripSizes, last_checked AS lastChecked
      FROM offers WHERE current_price IS NOT NULL ORDER BY model_key, current_price ASC`).all(),
    database.prepare("SELECT model_key AS modelKey, target_price AS targetPrice FROM targets").all(),
    database.prepare("SELECT checked_at AS checkedAt, stores_checked AS storesChecked, offers_found AS offersFound, failures FROM checks ORDER BY id DESC LIMIT 1").first(),
    database.prepare(`SELECT model_key AS modelKey, MIN(price) AS price, checked_at AS checkedAt
      FROM price_history GROUP BY model_key, checked_at ORDER BY checked_at DESC LIMIT 60`).all(),
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
    stores: feeds.map((feed) => feed.name),
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
  const body = await request.json() as { modelKey?: string; targetPrice?: number };
  if (!body.modelKey || !(body.modelKey in defaultTargets) || !Number.isFinite(body.targetPrice) || Number(body.targetPrice) < 1) {
    return Response.json({ error: "Invalid target" }, { status: 400 });
  }
  await db().prepare("UPDATE targets SET target_price = ? WHERE model_key = ?")
    .bind(Number(body.targetPrice), body.modelKey).run();
  return getDashboard();
}
