import { env } from "cloudflare:workers";
import { defaultTargets, modelNames } from "../../lib/racquet-catalogue.js";
import { isOwnKey, readJsonObject } from "../../lib/request-body.js";

export const dynamic = "force-dynamic";

type D1Result<T = Record<string, unknown>> = { results?: T[] };

type Feed = {
  key: string;
  name: string;
  origin: string;
  url: string;
  kind?: "shopify" | "woocommerce" | "amazon" | "lightspeed" | "wix" | "structured" | "manual";
};

// The beta hostname intentionally has a read-only API.  Its visitors keep
// personal choices in their own browser; only the Access-protected hostname
// may change the shared tracker, catalogue, or refresh schedule.
const publicPreviewHosts = new Set(["baseline-beta.besada.net"]);

function isPublicPreview(request: Request) {
  if (request.headers.get("x-baseline-public-preview") === "true") return true;
  // The protected hostname carries Cloudflare Access' signed assertion. A
  // request arriving through Cloudflare without that assertion is public-beta
  // traffic, even when a tunnel proxy has rewritten the origin Host header.
  if (request.headers.get("cf-ray") && !request.headers.get("cf-access-jwt-assertion")) return true;
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = (forwardedHost ?? request.headers.get("host") ?? "").split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
  return publicPreviewHosts.has(host);
}

function publicPreviewDenied() {
  return Response.json({ error: "This action is available in the protected Baseline admin app." }, { status: 403 });
}

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
    url: "https://racquetguys.ca/collections/adult-tennis-racquets/products.json?limit=250",
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
    key: "hisports",
    name: "HiSports",
    origin: "https://hisports.ca",
    url: "https://hisports.ca/collections/tennis-racquets/products.json?limit=250",
  },
  {
    key: "sports-virtuoso",
    name: "Sports Virtuoso",
    origin: "https://sportsvirtuoso.com",
    url: "https://sportsvirtuoso.com/collections/tennis-racquets/products.json?limit=250",
  },
  {
    key: "racquet-science",
    name: "Racquet Science",
    origin: "https://racquetscience.ca",
    url: "https://racquetscience.ca/collections/tennis-racquets/products.json?limit=250",
  },
  {
    key: "tennisnetpro",
    name: "TennisNetPro",
    origin: "https://tennisnetpro.com",
    url: "https://tennisnetpro.com/products.json?limit=250",
  },
  {
    key: "max-sports",
    name: "Max Sports",
    origin: "https://maxsports.ca",
    url: "https://maxsports.ca/collections/tennis-racquets/products.json?limit=250",
  },
  {
    key: "babolat-canada",
    name: "Babolat Canada",
    origin: "https://www.babolat.ca",
    url: "https://www.babolat.ca/collections/tennis-rackets/products.json?limit=250",
  },
  {
    key: "premier-racquet-store",
    name: "Premier Racquet Store",
    origin: "https://premierracquetstore.com",
    url: "https://premierracquetstore.com/collections/racquets/products.json?limit=250",
  },
  {
    key: "racquet-network",
    name: "Racquet Network",
    origin: "https://racquetnetwork.com",
    url: "https://racquetnetwork.com/wp-json/wc/store/v1/products?per_page=100&category=7739",
    kind: "woocommerce",
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
  // Public storefront data only. A listing is accepted only when price, stock,
  // model and grip size 3 can all be verified from the merchant response.
  { key: "sport-chek", name: "Sport Chek", origin: "https://www.sportchek.ca", url: "https://www.sportchek.ca/en/cat/sports-tennis/tennis/racquets-DC200002.html", kind: "structured" },
  { key: "sporting-life", name: "Sporting Life", origin: "https://www.sportinglife.ca", url: "https://www.sportinglife.ca/en-CA/tennis/tennis-racquets/", kind: "manual" },
  { key: "altitude-sports", name: "Altitude Sports", origin: "https://www.altitude-sports.com", url: "https://www.altitude-sports.com/c/tennis", kind: "structured" },
  { key: "canadian-tire", name: "Canadian Tire", origin: "https://www.canadiantire.ca", url: "https://www.canadiantire.ca/en/cat/sports-recreation/tennis/tennis-racquets-DC0002487.html", kind: "structured" },
  { key: "decathlon-canada", name: "Decathlon Canada", origin: "https://www.decathlon.ca", url: "https://www.decathlon.ca/en/c/tennis/racquets", kind: "manual" },
  { key: "racquets-pro-shop", name: "Racquets Pro Shop", origin: "https://www.racquetsproshop.ca", url: "https://www.racquetsproshop.ca/tennis-racquet", kind: "wix" },
  { key: "tennis-central", name: "Tennis Central", origin: "https://www.tenniscentral.ca", url: "https://www.tenniscentral.ca/collections/tennis-racquets/products.json?limit=250" },
  { key: "tennis-giant", name: "Tennis Giant", origin: "https://www.tennisgiant.com", url: "https://www.tennisgiant.com/collections/tennis-racquets/products.json?limit=250" },
  { key: "tcc-pro-shop", name: "TCC Pro Shop", origin: "https://proshop.tennisclubs.ca", url: "https://proshop.tennisclubs.ca/collections/tennis-racquets/products.json?limit=250" },
  { key: "matchpoint", name: "Matchpoint", origin: "https://www.matchpointstore.com", url: "https://www.matchpointstore.com/racquets/", kind: "lightspeed" },
  { key: "tenniszon", name: "Tenniszon", origin: "https://www.tenniszon.com", url: "https://www.tenniszon.com/collections/tennis-racquets/products.json?limit=250" },
  { key: "rackets-runners", name: "Rackets & Runners", origin: "https://racketsandrunners.ca", url: "https://racketsandrunners.ca/collections/tennis-racquets/products.json?limit=250" },
  { key: "game-set-match", name: "Game Set Match", origin: "https://gamesetmatch.ca", url: "https://gamesetmatch.ca/", kind: "manual" },
  { key: "racquet-vault", name: "Racquet Vault", origin: "https://racquetvault.ca", url: "https://racquetvault.ca/collections/tennis-racquets/products.json?limit=250" },
  { key: "courtside-tennis-academy", name: "Courtside Tennis Academy", origin: "https://courtsidetennisacademy.ca", url: "https://courtsidetennisacademy.ca/products.json?limit=250" },
  { key: "performance-tennis-ottawa", name: "Performance Tennis Ottawa", origin: "https://www.performancetennis.ca", url: "https://www.performancetennis.ca/products.json?limit=250" },
  { key: "plock-tennis", name: "Plock Tennis Club Shop", origin: "https://www.plocktennisclub.ca", url: "https://www.plocktennisclub.ca/category/wilson-racquet", kind: "wix" },
  { key: "kevin-martin-tennis", name: "Kevin Martin Tennis", origin: "https://www.kevinmartinsport.com", url: "https://www.kevinmartinsport.com/tennis", kind: "manual" },
  { key: "head-canada", name: "HEAD Canada", origin: "https://www.head.com", url: "https://www.head.com/en_CA/shop-tennis/racquets", kind: "structured" },
  { key: "tennis-prosport", name: "Tennis ProSport", origin: "https://tennisprosport.com", url: "https://tennisprosport.com/", kind: "manual" },
  { key: "tennistek", name: "TennisTek", origin: "https://shop.tennistek.ca", url: "https://shop.tennistek.ca/us/catalog/", kind: "structured" },
  // Additional Canadian specialists with public, grip-level catalogues.
  { key: "orc-pro-shop", name: "ORC Pro Shop", origin: "https://orcproshop.com", url: "https://orcproshop.com/collections/adult-tennis-racquets/products.json?limit=250" },
  { key: "t1-sports", name: "T1 Sports", origin: "https://t1sports.net", url: "https://t1sports.net/collections/tennis-rackets/products.json?limit=250" },
  { key: "jj-sports-specialist", name: "JJ Sports Specialist", origin: "https://www.jjsports.ca", url: "https://www.jjsports.ca/collections/tennis/products.json?limit=250" },
  { key: "courtside-sports", name: "Courtside Sports", origin: "https://www.courtsidesports.com", url: "https://www.courtsidesports.com/court/tennis/tennis-racquets/", kind: "lightspeed" },
  // Legitimate Canadian chains and local pro shops whose public sites do not
  // expose dependable variant-level stock. Keep them discoverable without
  // presenting unverified catalogue data as a checked deal.
  { key: "sports-experts", name: "Sports Experts", origin: "https://www.sportsexperts.ca", url: "https://www.sportsexperts.ca/en-CA/sports/racquet-sports/tennis", kind: "manual" },
  { key: "walmart-canada", name: "Walmart Canada", origin: "https://www.walmart.ca", url: "https://www.walmart.ca/en/c/kp/tennis-racquets", kind: "manual" },
  { key: "source-for-sports", name: "Source for Sports", origin: "https://www.sourceforsports.ca", url: "https://www.sourceforsports.ca/search?q=tennis%20racquet", kind: "manual" },
  { key: "svp-sports", name: "SVP Sports", origin: "https://www.svpsports.ca", url: "https://www.svpsports.ca/search?q=tennis%20racquet&type=product", kind: "manual" },
  { key: "aforza-pro-shop", name: "Aforza Pro Shop", origin: "https://www.aforzashop.ca", url: "https://www.aforzashop.ca/", kind: "manual" },
  { key: "sweet-spot-canada", name: "The Sweet Spot", origin: "https://sweetspotcanada.com", url: "https://sweetspotcanada.com/", kind: "manual" },
];

const defaultUsedTargets: Record<string, number> = Object.fromEntries(
  Object.entries(defaultTargets).map(([key, value]) => [key, Math.round((value * 0.68) / 5) * 5]),
);

const topRatedModelKeys = new Set([
  "defyer-98-pro-v1", "defyer-100-v1", "blade-pro-98-v10", "blade-pro-98-18x20-v10", "blade-v10", "blade-v9",
  "ezone-98", "ezone-98-tour", "ezone-100", "pure-aero-98", "pure-aero-100",
  "clash-100", "vcore-98", "vcore-100", "pure-drive-100", "gravity-mp-2025",
  "tf40-290", "tf40-305", "tfight-300", "tfight-300s", "tfight-305s", "fire-305s", "speed-pro-2026", "rf-01-pro", "gravity-tour-2025", "squared-2026",
  "pure-strike-98", "pure-strike-98-18x20", "pure-strike-100", "percept-97", "percept-97d", "speed-mp",
]);
const newReleaseModelKeys = new Set([
  "blade-pro-98-v10", "blade-pro-98-18x20-v10", "blade-pro-100-v10", "blade-v10", "blade-98-18x20-v10", "blade-100-v10", "blade-100l-v10", "blade-100ul-v10", "blade-104-v10",
  "pro-staff-97-classic", "pro-staff-97l-classic", "pro-staff-team-classic",
  "vcore-95", "vcore-98", "vcore-98l", "vcore-98-plus", "vcore-98-tour", "vcore-100", "vcore-100d", "vcore-100l", "vcore-100-plus", "muse-98", "muse-100", "muse-100l", "muse-100sl", "muse-107",
  "pure-aero-98", "pure-aero-100", "pure-aero-team-2026", "pure-aero-lite-2026", "pure-aero-super-lite-2026", "pure-aero-plus",
  "speed-pro-2026", "speed-mp", "speed-tour", "extreme-pro-2026", "extreme-mp-2026", "extreme-mp-xl-2026", "extreme-mp-l-2026", "extreme-mp-ul-2026", "extreme-team-2026", "extreme-elite-2026", "boom-pro", "boom-mp", "boom-mp-l-2026", "boom-mp-ul-2026", "boom-elite-2026", "squared-2026",
  "fire-305s", "fire-300", "fire-285", "fire-270",
]);
const preorderModelLabels: Record<string, string> = {
  "defyer-98-pro-v1": "Pre-order · Aug 21",
  "defyer-100-v1": "Pre-order · Aug 21",
  "defyer-100l-v1": "Pre-order · Aug 21",
  "defyer-100ul-v1": "Pre-order · Aug 21",
  "boom-team-2026": "Coming soon",
  "ig-boom-xceed-2026": "Coming soon",
};
const defaultModelOrder = ["blade-v10", "blade-v9", "blade-v8", "ezone-98", "pure-aero-98", "speed-pro-2026"];
const shortlistSlotCount = 6;
type FeaturedBrand = "Wilson" | "Yonex" | "Babolat" | "Head" | "Tecnifibre" | "Dunlop" | "Prince" | "Volkl";
const featuredBrands: FeaturedBrand[] = ["Wilson", "Yonex", "Babolat", "Head", "Tecnifibre", "Dunlop", "Prince", "Volkl"];
const featuredSlotCount = 6;
const defaultBrandPicks: Record<FeaturedBrand, string[]> = {
  Wilson: ["blade-v10", "defyer-98-pro-v1", "clash-100", "clash-100-pro", "ultra-100-v5", "pro-staff-97-classic"],
  Yonex: ["ezone-98", "ezone-100", "vcore-98", "vcore-100", "percept-97", "percept-100"],
  Babolat: ["pure-aero-98", "pure-aero-100", "pure-drive-98", "pure-drive-100", "pure-strike-98", "pure-strike-100"],
  Head: ["speed-pro-2026", "speed-mp", "gravity-pro-2025", "gravity-mp-2025", "radical-pro-2025", "radical-mp-2025"],
  Tecnifibre: ["tf40-290", "tf40-305", "tfight-300s", "tfight-305s", "fire-305s", "tfx1-300"],
  Dunlop: ["dunlop-cx-200", "dunlop-cx-200-tour-16x19", "dunlop-cx-200-tour-18x20", "dunlop-cx-400", "dunlop-cx-400-tour", "dunlop-fx-500-lite-2026"],
  Prince: ["prince-vortex-100-310", "prince-vortex-100-300", "prince-tour-100p-305", "prince-o3-ripstick-100-280", "prince-legacy-110", "prince-warrior-100-265"],
  Volkl: ["volkl-c10-evo", "volkl-v1-evo", "volkl-v1-classic", "volkl-vcell-v1-mp", "volkl-vcell-10-320", "volkl-vcell-10-300"],
};

function belongsToBrand(modelKey: string, brand: FeaturedBrand) {
  return isOwnKey(modelNames, modelKey) && modelNames[modelKey].startsWith(`${brand} `);
}

function db() {
  return env.DB as D1Database;
}

type GripSize = "L0" | "L1" | "L2" | "L3" | "L4" | "L5";
const validGripSizes = new Set<GripSize>(["L0", "L1", "L2", "L3", "L4", "L5"]);

async function getGripSize(): Promise<GripSize> {
  const row = await db().prepare("SELECT value FROM tracker_preferences WHERE key = 'grip_size'").first<{ value: string }>();
  return validGripSizes.has(row?.value as GripSize) ? row!.value as GripSize : "L3";
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
    database.prepare(`CREATE TABLE IF NOT EXISTS used_targets (
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
    database.prepare(`CREATE TABLE IF NOT EXISTS settings_migrations (
      migration_key TEXT PRIMARY KEY, applied_at TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS tracker_preferences (
      key TEXT PRIMARY KEY, value TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS shortlist_slots (
      slot INTEGER PRIMARY KEY, model_key TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS brand_featured_slots (
      brand TEXT NOT NULL, slot INTEGER NOT NULL, model_key TEXT NOT NULL,
      PRIMARY KEY (brand, slot)
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS used_offers (
      id TEXT PRIMARY KEY, model_key TEXT NOT NULL, store TEXT NOT NULL,
      title TEXT NOT NULL, url TEXT NOT NULL, current_price REAL,
      compare_at_price REAL, in_stock INTEGER NOT NULL,
      grip_sizes TEXT NOT NULL DEFAULT '[]', condition TEXT NOT NULL,
      last_checked TEXT NOT NULL
    )`),
    database.prepare("CREATE INDEX IF NOT EXISTS price_history_model_idx ON price_history(model_key, checked_at)"),
  ]);
  await database.prepare("INSERT OR IGNORE INTO tracker_preferences (key, value) VALUES ('grip_size', 'L3')").run();

  await database.batch(
    Object.entries(defaultTargets).map(([key, value]) =>
      database.prepare("INSERT OR IGNORE INTO targets (model_key, target_price) VALUES (?, ?)").bind(key, value),
    ),
  );
  await database.batch(
    Object.entries(defaultUsedTargets).map(([key, value]) =>
      database.prepare("INSERT OR IGNORE INTO used_targets (model_key, target_price) VALUES (?, ?)").bind(key, value),
    ),
  );
  await database.batch(defaultModelOrder.map((modelKey, slot) => database.prepare(
    "INSERT OR IGNORE INTO shortlist_slots (slot, model_key) VALUES (?, ?)",
  ).bind(slot, modelKey)));
  await database.batch(featuredBrands.flatMap((brand) => defaultBrandPicks[brand].map((modelKey, slot) => database.prepare(
    "INSERT OR IGNORE INTO brand_featured_slots (brand, slot, model_key) VALUES (?, ?, ?)",
  ).bind(brand, slot, modelKey))));
  await database.batch(
    feeds.map((feed) => database.prepare(
      "INSERT OR IGNORE INTO retailer_settings (retailer_key, retailer_name, enabled) VALUES (?, ?, ?)",
    ).bind(feed.key, feed.name, feed.kind === "manual" ? 0 : 1)),
  );
  const catalogMigration = await database.prepare(
    "SELECT migration_key FROM settings_migrations WHERE migration_key = ?",
  ).bind("automate-public-catalogs-v1").first();
  if (!catalogMigration) {
    const automatedKeys = feeds.filter((feed) => feed.kind !== "manual").map((feed) => feed.key);
    await database.batch(automatedKeys.map((key) => database.prepare(
      "UPDATE retailer_settings SET enabled = 1 WHERE retailer_key = ?",
    ).bind(key)));
    await database.prepare(
      "INSERT INTO settings_migrations (migration_key, applied_at) VALUES (?, ?)",
    ).bind("automate-public-catalogs-v1", new Date().toISOString()).run();
  }
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
    url: feeds.find((feed) => feed.key === row.key)?.url ?? "#",
  }));
}

async function getDashboard(publicPreview = false) {
  await ensureSchema();
  const database = db();
  const gripSize = await getGripSize();
  const [offersResult, usedOffersResult, targetsResult, usedTargetsResult, checksResult, historyResult, dropsResult, retailerSettings, shortlistResult, brandFeaturedResult] = await Promise.all([
    database.prepare(`SELECT id, model_key AS modelKey, store, title, url,
      current_price AS currentPrice, previous_price AS previousPrice,
      compare_at_price AS compareAtPrice, in_stock AS inStock,
      grip_sizes AS gripSizes, last_checked AS lastChecked
      FROM offers WHERE current_price IS NOT NULL ORDER BY model_key, current_price ASC`).all(),
    database.prepare(`SELECT id, model_key AS modelKey, store, title, url,
      current_price AS currentPrice, compare_at_price AS compareAtPrice,
      in_stock AS inStock, grip_sizes AS gripSizes, condition, last_checked AS lastChecked
      FROM used_offers WHERE current_price IS NOT NULL AND current_price > 0 AND in_stock = 1 ORDER BY model_key, current_price ASC`).all(),
    database.prepare("SELECT model_key AS modelKey, target_price AS targetPrice FROM targets").all(),
    database.prepare("SELECT model_key AS modelKey, target_price AS targetPrice FROM used_targets").all(),
    database.prepare("SELECT checked_at AS checkedAt, stores_checked AS storesChecked, offers_found AS offersFound, failures FROM checks ORDER BY id DESC LIMIT 1").first(),
    database.prepare(`SELECT model_key AS modelKey, MIN(price) AS price, checked_at AS checkedAt
      FROM price_history GROUP BY model_key, checked_at ORDER BY checked_at DESC LIMIT 60`).all(),
    database.prepare(`SELECT COUNT(DISTINCT offer_id) AS count FROM (
      SELECT offer_id, price, checked_at,
        LAG(price) OVER (PARTITION BY offer_id ORDER BY checked_at) AS previous_price
      FROM price_history
    ) WHERE checked_at >= ? AND previous_price IS NOT NULL AND price < previous_price`)
      .bind(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).first(),
    getRetailerSettings(),
    database.prepare("SELECT slot, model_key AS modelKey FROM shortlist_slots ORDER BY slot").all(),
    database.prepare("SELECT brand, slot, model_key AS modelKey FROM brand_featured_slots ORDER BY brand, slot").all(),
  ]);

  const offers = ((offersResult as D1Result<Record<string, unknown>>).results ?? []).map((offer) => ({
    ...offer,
    inStock: Boolean(offer.inStock),
    gripSizes: JSON.parse(String(offer.gripSizes || "[]")),
  }));
  const usedOffers = ((usedOffersResult as D1Result<Record<string, unknown>>).results ?? []).map((offer) => ({
    ...offer,
    inStock: Boolean(offer.inStock),
    gripSizes: JSON.parse(String(offer.gripSizes || "[]")),
  }));

  const targetMap = Object.fromEntries(
    ((targetsResult as D1Result<{ modelKey: string; targetPrice: number }>).results ?? [])
      .map((row) => [row.modelKey, row.targetPrice]),
  );
  const usedTargetMap = Object.fromEntries(
    ((usedTargetsResult as D1Result<{ modelKey: string; targetPrice: number }>).results ?? [])
      .map((row) => [row.modelKey, row.targetPrice]),
  );
  const shortlist = ((shortlistResult as D1Result<{ slot: number; modelKey: string }>).results ?? [])
    .sort((a, b) => a.slot - b.slot).map((row) => row.modelKey);
  const brandRows = (brandFeaturedResult as D1Result<{ brand: FeaturedBrand; slot: number; modelKey: string }>).results ?? [];
  const brandPicks = Object.fromEntries(featuredBrands.map((brand) => {
    const picks = brandRows.filter((row) => row.brand === brand).sort((a, b) => a.slot - b.slot).map((row) => row.modelKey);
    return [brand, picks.length === featuredSlotCount ? picks : defaultBrandPicks[brand]];
  }));

  return Response.json({
    publicPreview,
    offers,
    usedOffers,
    stringOffers: [],
    stringSourceResults: [],
    accessoryOffers: [],
    accessorySourceResults: [],
    ballOffers: [],
    ballSourceResults: [],
    saleOffers: offers
      .filter((offer) => offer.modelKey === "other-sale" && offer.currentPrice !== null && offer.compareAtPrice !== null && offer.compareAtPrice > offer.currentPrice)
      .sort((a, b) => (a.currentPrice ?? Infinity) - (b.currentPrice ?? Infinity))
      .slice(0, 18),
    targets: targetMap,
    usedTargets: usedTargetMap,
    lastCheck: checksResult ?? null,
    dropsLast24Hours: Number((dropsResult as { count?: number } | null)?.count ?? 0),
    history: (historyResult as D1Result).results ?? [],
    modelNames,
    modelOptions: Object.entries(modelNames).map(([key, name]) => ({
      key,
      name,
      topRated: topRatedModelKeys.has(key),
      releaseStatus: preorderModelLabels[key] ? "preorder" : newReleaseModelKeys.has(key) ? "new" : "catalogue",
      releaseLabel: preorderModelLabels[key] ?? (newReleaseModelKeys.has(key) ? "New 2026" : null),
    })),
    modelOrder: shortlist.length ? shortlist : defaultModelOrder,
    brandPicks,
    gripSize,
    retailers: retailerSettings,
    stores: retailerSettings.filter((retailer) => retailer.enabled && retailer.kind !== "manual").map((retailer) => retailer.name),
  });
}

export async function GET(request: Request) {
  return getDashboard(isPublicPreview(request));
}

export async function POST(request: Request) {
  if (isPublicPreview(request)) return publicPreviewDenied();
  // Price checks (check, models, model) run in the price monitor,
  // scripts/check-prices.mjs. The relay starts it and answers these requests
  // itself, so they only reach this route under `npm run dev`, which has no relay.
  return Response.json({ error: "Price checks run through the Baseline relay, which `npm run dev` does not start." }, { status: 501 });
}

export async function PATCH(request: Request) {
  if (isPublicPreview(request)) return publicPreviewDenied();
  await ensureSchema();
  const body = await readJsonObject(request) as { modelKey?: string; targetPrice?: number; market?: "new" | "used"; retailerKey?: string; enabled?: boolean; slot?: number; selectedModelKey?: string; featuredBrand?: FeaturedBrand; featuredSlot?: number; gripSize?: GripSize } | null;
  if (!body) return Response.json({ error: "Invalid request body" }, { status: 400 });
  if (body.gripSize) {
    if (!validGripSizes.has(body.gripSize)) return Response.json({ error: "Invalid grip size" }, { status: 400 });
    await db().prepare("INSERT INTO tracker_preferences (key, value) VALUES ('grip_size', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .bind(body.gripSize).run();
    return getDashboard();
  }
  if (body.retailerKey) {
    if (!feeds.some((feed) => feed.key === body.retailerKey) || typeof body.enabled !== "boolean") {
      return Response.json({ error: "Invalid retailer setting" }, { status: 400 });
    }
    await db().prepare("UPDATE retailer_settings SET enabled = ? WHERE retailer_key = ?")
      .bind(body.enabled ? 1 : 0, body.retailerKey).run();
    return getDashboard();
  }
  if (Number.isInteger(body.slot) && body.selectedModelKey) {
    if (body.slot! < 0 || body.slot! >= shortlistSlotCount || !isOwnKey(modelNames, body.selectedModelKey)) {
      return Response.json({ error: "Invalid shortlist frame" }, { status: 400 });
    }
    const duplicate = await db().prepare("SELECT slot FROM shortlist_slots WHERE model_key = ? AND slot <> ?")
      .bind(body.selectedModelKey, body.slot).first();
    if (duplicate) return Response.json({ error: "That frame is already on your shortlist" }, { status: 409 });
    await db().prepare("UPDATE shortlist_slots SET model_key = ? WHERE slot = ?")
      .bind(body.selectedModelKey, body.slot).run();
    return getDashboard();
  }
  if (body.featuredBrand && Number.isInteger(body.featuredSlot) && body.selectedModelKey) {
    if (!featuredBrands.includes(body.featuredBrand) || body.featuredSlot! < 0 || body.featuredSlot! >= featuredSlotCount || !belongsToBrand(body.selectedModelKey, body.featuredBrand)) {
      return Response.json({ error: "Invalid featured brand frame" }, { status: 400 });
    }
    const duplicate = await db().prepare("SELECT slot FROM brand_featured_slots WHERE brand = ? AND model_key = ? AND slot <> ?")
      .bind(body.featuredBrand, body.selectedModelKey, body.featuredSlot).first();
    if (duplicate) return Response.json({ error: "That frame is already featured for this brand" }, { status: 409 });
    await db().prepare("UPDATE brand_featured_slots SET model_key = ? WHERE brand = ? AND slot = ?")
      .bind(body.selectedModelKey, body.featuredBrand, body.featuredSlot).run();
    return getDashboard();
  }
  if (!body.modelKey || !isOwnKey(defaultTargets, body.modelKey) || !Number.isFinite(body.targetPrice) || Number(body.targetPrice) < 1) {
    return Response.json({ error: "Invalid target" }, { status: 400 });
  }
  const targetTable = body.market === "used" ? "used_targets" : "targets";
  await db().prepare(`UPDATE ${targetTable} SET target_price = ? WHERE model_key = ?`)
    .bind(Number(body.targetPrice), body.modelKey).run();
  return getDashboard();
}
