import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

type D1Result<T = Record<string, unknown>> = { results?: T[] };

type ProductVariant = {
  available: boolean;
  price: string;
  compare_at_price: string | null;
  title: string;
  option1?: string | null;
  sku?: string | null;
};

type ShopifyProduct = {
  handle: string;
  title: string;
  vendor?: string;
  body_html?: string;
  variants: ProductVariant[];
};

type WooProduct = {
  id: number;
  name: string;
  permalink: string;
  is_in_stock: boolean;
  prices: {
    price: string;
    regular_price: string;
    currency_minor_unit: number;
  };
  attributes?: Array<{
    name: string;
    terms?: Array<{ name: string }>;
  }>;
};

type Feed = {
  key: string;
  name: string;
  origin: string;
  url: string;
  kind?: "shopify" | "woocommerce" | "amazon" | "lightspeed" | "wix" | "structured" | "manual";
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

type ParsedUsedOffer = ParsedOffer & { condition: string };

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

const shopifyRacquetCatalogOverrides = new Map<string, string[]>([
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

async function fetchShopifyCatalogs(feed: Feed): Promise<ShopifyProduct[]> {
  const catalogUrls = shopifyRacquetCatalogOverrides.get(feed.name) ?? [feed.url];
  const catalogues = await Promise.all(catalogUrls.map(async (sourceUrl) => {
    const products: ShopifyProduct[] = [];
    for (let page = 1; page <= 4; page += 1) {
      const pageUrl = new URL(sourceUrl);
      pageUrl.searchParams.set("limit", "250");
      pageUrl.searchParams.set("page", String(page));
      const response = await fetch(pageUrl, {
        headers: {
          accept: "application/json",
          "user-agent": "BaselinePriceTracker/1.0 (+Canadian tennis price comparison)",
        },
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error(`${feed.name}: ${response.status}`);
      const payload = (await response.json()) as { products?: ShopifyProduct[] };
      const batch = payload.products ?? [];
      products.push(...batch);
      if (batch.length < 250) break;
    }
    return products;
  }));
  return [...new Map(catalogues.flat().map((product) => [product.handle, product])).values()];
}

const amazonSearches = [
  "Wilson Blade 98 v10", "Wilson Blade Pro Defyer 98 100", "Wilson Pro Staff Classic", "Yonex EZONE 98 100 Tour Plus", "Babolat Pure Aero 98 Gen9",
  "Babolat Pure Strike 98", "Babolat Pure Strike 100", "Babolat Boost Evo Aero Drive Wimbledon", "Yonex Percept 97",
  "Wilson Clash Ultra Pro Staff RF 01", "Wilson Shift 99", "Yonex VCORE Tour VCORE Pro",
  "Yonex MUSE", "Babolat Pure Drive AeroPro Pure Control", "Head Speed Gravity Radical",
  "Head SQUARED Extreme XL Boom Elite Prestige", "Tecnifibre FIRE T-Fight TF40 TF-X1 Tempo",
];

const defaultTargets: Record<string, number> = {
  "defyer-98-pro-v1": 340,
  "defyer-100-v1": 300,
  "defyer-100l-v1": 285,
  "defyer-100ul-v1": 260,
  "blade-pro-98-v10": 325,
  "blade-pro-98-18x20-v10": 325,
  "blade-pro-100-v10": 315,
  "blade-v10": 275,
  "blade-98-18x20-v10": 275,
  "blade-v9": 275,
  "blade-98-18x20-v9": 275,
  "blade-v8": 225,
  "blade-98-18x20-v8": 225,
  "blade-v7": 190,
  "blade-100-v10": 275,
  "blade-100l-v10": 250,
  "blade-100ul-v10": 230,
  "blade-104-v10": 260,
  "blade-100-v9": 230,
  "clash-100-pro": 275,
  "clash-100l-v3": 235,
  "clash-100ul-v3": 210,
  "clash-108-v3": 240,
  "clash-100-pro-v2": 225,
  "clash-100-v2": 200,
  "clash-100l-v2": 185,
  "clash-98-v2": 215,
  "clash-100ul-v2": 170,
  "clash-108-v2": 180,
  "clash-100-tour-v1": 175,
  "clash-100-v1": 160,
  "clash-98-v1": 175,
  "clash-100l-v1": 145,
  "clash-100ul-v1": 130,
  "clash-108-v1": 145,
  "ultra-100-v5": 275,
  "ultra-99-pro-v5": 300,
  "ultra-100l-v5": 245,
  "ultra-100ul-v5": 225,
  "ultra-111-v5": 230,
  "pro-staff-x": 285,
  "pro-staff-97-classic": 300,
  "pro-staff-97l-classic": 255,
  "pro-staff-team-classic": 230,
  "pro-staff-rf97-v13": 240,
  "rf-01": 285,
  "shift-99": 275,
  "ezone-98": 300,
  "ezone-98l": 260,
  "ezone-98-tour": 300,
  "ezone-98-plus": 285,
  "ezone-98-2022": 220,
  "ezone-100": 260,
  "ezone-100l": 250,
  "ezone-100sl": 230,
  "ezone-alpha": 175,
  "ezone-100-plus": 285,
  "ezone-105": 260,
  "vcore-95": 285,
  "vcore-98l": 260,
  "vcore-98-plus": 285,
  "vcore-98-tour": 300,
  "vcore-98-2023": 220,
  "vcore-100d": 285,
  "vcore-100l": 250,
  "vcore-100-plus": 285,
  "vcore-alpha": 175,
  "vcore-ace": 150,
  "vcore-play": 130,
  "percept-100": 285,
  "percept-100d": 285,
  "percept-97d": 300,
  "percept-97h": 300,
  "vcore-pro-97-2021": 200,
  "muse-98": 300,
  "muse-100": 300,
  "muse-100l": 285,
  "muse-100sl": 265,
  "muse-107": 285,
  "pure-aero-98": 300,
  "pure-aero-100": 260,
  "pure-aero-team-2026": 250,
  "pure-aero-lite-2026": 230,
  "pure-aero-super-lite-2026": 220,
  "pure-aero-2023": 220,
  "pure-aero-rafa-2023": 225,
  "pure-aero-vs": 210,
  "aeropro-drive": 175,
  "pure-control-tour": 175,
  "pure-aero-plus": 275,
  "pure-aero-rafa-origin": 285,
  "boost-aero-2026": 135,
  "boost-strike-2026": 135,
  "boost-wimbledon-2026": 145,
  "evo-aero-gen2": 220,
  "evo-drive-gen2": 220,
  "clash-100": 250,
  "vcore-98": 275,
  "vcore-100": 260,
  "pure-drive-98": 275,
  "pure-drive-100": 260,
  "pure-drive-team-2025": 240,
  "pure-drive-lite-2025": 225,
  "pure-drive-107-2025": 240,
  "pure-drive-2021": 210,
  "pure-drive-plus": 275,
  "pure-strike-97": 285,
  "pure-strike-98": 285,
  "pure-strike-98-18x20": 285,
  "pure-strike-100": 275,
  "pure-strike-100-16x20": 275,
  "percept-97": 275,
  "speed-mp": 275,
  "speed-mp-l-2026": 250,
  "speed-mp-ul-2026": 230,
  "speed-team-2026": 225,
  "speed-elite-2026": 195,
  "speed-mp-2024": 220,
  "speed-pro-2024": 235,
  "speed-tour": 285,
  "pro-staff-97": 275,
  "gravity-pro-2025": 285,
  "gravity-mp-2025": 260,
  "gravity-mp-l-2025": 245,
  "gravity-team-2025": 225,
  "gravity-pro-2023": 225,
  "gravity-mp-2023": 210,
  "tf40-290": 230,
  "tf40-305": 260,
  "tf40-305-18x20": 260,
  "tf40-315": 265,
  "tfight-285": 230,
  "tfight-300": 250,
  "tfight-300s": 275,
  "tfight-305s": 285,
  "tfight-315s": 285,
  "tfight-iso-305": 210,
  "fire-305s": 275,
  "fire-300": 260,
  "fire-285": 240,
  "fire-270": 215,
  "tfx1-300": 260,
  "tfx1-285": 225,
  "tfx1-305": 250,
  "tempo-298": 260,
  "tempo-285": 220,
  "radical-mp-2025": 260,
  "radical-pro-2025": 285,
  "radical-team-2025": 225,
  "radical-elite-2025": 160,
  "radical-mp-2023": 210,
  "radical-pro-2023": 225,
  "speed-pro-2026": 275,
  "extreme-pro-2026": 285,
  "extreme-mp-2026": 275,
  "extreme-mp-xl-2026": 285,
  "extreme-mp-l-2026": 250,
  "extreme-mp-ul-2026": 230,
  "extreme-team-2026": 225,
  "extreme-elite-2026": 195,
  "boom-pro": 285,
  "boom-mp": 275,
  "boom-mp-l-2026": 250,
  "boom-mp-ul-2026": 230,
  "boom-team-2026": 225,
  "boom-elite-2026": 160,
  "boom-pro-2022": 205,
  "boom-mp-2022": 190,
  "prestige-pro": 285,
  "prestige-tour": 285,
  "prestige-mp-2023": 245,
  "instinct-mp": 250,
  "instinct-pwr-110-2025": 220,
  "instinct-pwr-115-2025": 220,
  "instinct-team-l-2025": 205,
  "extreme-tour-2022": 210,
  "rf-01-pro": 300,
  "gravity-tour-2025": 275,
  "squared-2026": 275,
  "ig-speed-xceed-2026": 135,
  "ig-boom-xceed-2026": 135,
  "ig-gravity-xceed-2026": 135,
  "ig-radical-xceed-2026": 135,
  "dunlop-cx-200": 220, "dunlop-cx-200-tour-16x19": 230, "dunlop-cx-200-tour-18x20": 230,
  "dunlop-cx-400": 210, "dunlop-cx-400-tour": 225, "dunlop-fx-500-lite-2026": 210,
  "prince-vortex-100-310": 200, "prince-vortex-100-300": 195, "prince-tour-100p-305": 200,
  "prince-o3-ripstick-100-280": 175, "prince-legacy-110": 155, "prince-warrior-100-265": 155,
  "volkl-c10-evo": 225, "volkl-v1-evo": 210, "volkl-v1-classic": 210,
  "volkl-vcell-v1-mp": 210, "volkl-vcell-10-320": 225, "volkl-vcell-10-300": 220,
};

const defaultUsedTargets: Record<string, number> = Object.fromEntries(
  Object.entries(defaultTargets).map(([key, value]) => [key, Math.round((value * 0.68) / 5) * 5]),
);

const modelNames: Record<string, string> = {
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
  return modelNames[modelKey]?.startsWith(`${brand} `) ?? false;
}

function db() {
  return env.DB as D1Database;
}

type GripSize = "L0" | "L1" | "L2" | "L3" | "L4" | "L5";
const validGripSizes = new Set<GripSize>(["L0", "L1", "L2", "L3", "L4", "L5"]);
const gripMeasurements: Record<GripSize, string> = { L0: "4", L1: "4 1/8", L2: "4 1/4", L3: "4 3/8", L4: "4 1/2", L5: "4 5/8" };
let activeGripSize: GripSize = "L3";

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

async function getEnabledFeeds() {
  const settings = await getRetailerSettings();
  const enabled = new Set(settings.filter((setting) => setting.enabled).map((setting) => setting.key));
  return feeds.filter((feed) => enabled.has(feed.key) && feed.kind !== "manual");
}

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

function manufacturerModelKey(evidence: string) {
  const compact = String(evidence ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return [...manufacturerModelCodes].find(([code]) => compact.includes(code))?.[1] ?? null;
}

function hasStringPattern(evidence: string, mains: number, crosses: number) {
  return new RegExp(`(?:^|[^0-9])${mains}\\s*(?:x|×|/|by)\\s*${crosses}(?:$|[^0-9])`, "i").test(String(evidence));
}

function classify(title: string): string | null {
  const codeMatch = manufacturerModelKey(title);
  if (codeMatch) return codeMatch;
  const raw = title.toLowerCase();
  const normalized = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (/\b(demo|used|grommet|junior|jr)\b/.test(normalized)) return null;
  if (/dunlop cx 200 tour/.test(normalized) && hasStringPattern(raw, 18, 20)) return "dunlop-cx-200-tour-18x20";
  if (/dunlop cx 200 tour/.test(normalized)) return "dunlop-cx-200-tour-16x19";
  if (/dunlop cx 400 tour/.test(normalized)) return "dunlop-cx-400-tour";
  if (/dunlop cx 400/.test(normalized)) return "dunlop-cx-400";
  if (/dunlop cx 200/.test(normalized)) return "dunlop-cx-200";
  if (/dunlop fx 500 lite/.test(normalized)) return "dunlop-fx-500-lite-2026";
  if (/prince vortex 100/.test(normalized) && /310\s*g/.test(normalized)) return "prince-vortex-100-310";
  if (/prince vortex 100/.test(normalized) && /300\s*g/.test(normalized)) return "prince-vortex-100-300";
  if (/prince.*(?:ats textreme )?tour 100p/.test(normalized)) return "prince-tour-100p-305";
  if (/prince.*(?:o3 )?ripstick 100/.test(normalized)) return "prince-o3-ripstick-100-280";
  if (/prince legacy 110/.test(normalized)) return "prince-legacy-110";
  if (/prince warrior 100/.test(normalized)) return "prince-warrior-100-265";
  if (/volkl c10 evo/.test(normalized)) return "volkl-c10-evo";
  if (/volkl v1 evo/.test(normalized)) return "volkl-v1-evo";
  if (/volkl v1 classic/.test(normalized)) return "volkl-v1-classic";
  if (/volkl v cell v1 mp/.test(normalized)) return "volkl-vcell-v1-mp";
  if (/volkl v cell 10/.test(normalized) && /320\s*g/.test(normalized)) return "volkl-vcell-10-320";
  if (/volkl v cell 10/.test(normalized) && /300\s*g/.test(normalized)) return "volkl-vcell-10-300";
  if (/defyer 98 pro\b/.test(normalized)) return "defyer-98-pro-v1";
  if (/defyer 100ul\b|defyer 100 ul\b/.test(normalized)) return "defyer-100ul-v1";
  if (/defyer 100l\b|defyer 100 l\b/.test(normalized)) return "defyer-100l-v1";
  if (/ultra 100ul\b.*\bv5\b|ultra 100 ul\b.*\bv5\b/.test(normalized)) return "ultra-100ul-v5";
  if (/ultra 100l\b.*\bv5\b|ultra 100 l\b.*\bv5\b/.test(normalized)) return "ultra-100l-v5";
  if (/ultra 111\b.*\bv5\b/.test(normalized)) return "ultra-111-v5";
  if (/blade/.test(normalized) && /(?:pro 98|98 pro)/.test(normalized) && hasStringPattern(raw, 18, 20) && /\bv10\b/.test(normalized)) return "blade-pro-98-18x20-v10";
  if (/blade 98\b/.test(normalized) && hasStringPattern(raw, 18, 20) && /\bv10\b/.test(normalized)) return "blade-98-18x20-v10";
  if (/blade 98\b/.test(normalized) && hasStringPattern(raw, 18, 20) && /\bv9\b/.test(normalized)) return "blade-98-18x20-v9";
  if (/blade 98\b/.test(normalized) && hasStringPattern(raw, 18, 20) && /\bv8\b/.test(normalized)) return "blade-98-18x20-v8";
  if (/blade 100ul\b.*\bv10\b|blade 100 ul\b.*\bv10\b/.test(normalized)) return "blade-100ul-v10";
  if (/blade 100l\b.*\bv10\b|blade 100 l\b.*\bv10\b/.test(normalized)) return "blade-100l-v10";
  if (/pro staff 97l classic\b/.test(normalized)) return "pro-staff-97l-classic";
  if (/pro staff 97 classic\b/.test(normalized)) return "pro-staff-97-classic";
  if (/pro staff team classic\b/.test(normalized)) return "pro-staff-team-classic";
  if (/ezone 98l\b|ezone 98 l\b/.test(normalized)) return "ezone-98l";
  if (/ezone 100l\b|ezone 100 l\b/.test(normalized)) return "ezone-100l";
  if (/ezone 100sl\b|ezone 100 sl\b/.test(normalized)) return "ezone-100sl";
  if (/ezone alpha\b/.test(normalized)) return "ezone-alpha";
  if (/vcore 98l\b|vcore 98 l\b/.test(normalized)) return "vcore-98l";
  if (/vcore 100l\b|vcore 100 l\b/.test(normalized)) return "vcore-100l";
  if (/vcore alpha\b/.test(normalized)) return "vcore-alpha";
  if (/vcore ace\b/.test(normalized)) return "vcore-ace";
  if (/vcore play\b/.test(normalized)) return "vcore-play";
  if (/pure drive team\b.*\b(?:2025|gen ?11)\b/.test(normalized)) return "pure-drive-team-2025";
  if (/pure drive lite\b.*\b(?:2025|gen ?11)\b/.test(normalized)) return "pure-drive-lite-2025";
  if (/pure drive 107\b.*\b(?:2025|gen ?11)\b/.test(normalized)) return "pure-drive-107-2025";
  if (/pure aero team\b.*\b(?:2026|gen ?9)\b/.test(normalized)) return "pure-aero-team-2026";
  if (/pure aero (?:s ?lite|super l(?:ite|ight))\b.*\b(?:2026|gen ?9)\b/.test(normalized)) return "pure-aero-super-lite-2026";
  if (/pure aero lite\b.*\b(?:2026|gen ?9)\b/.test(normalized)) return "pure-aero-lite-2026";
  if (/muse 100\s*l\b/.test(normalized)) return "muse-100l";
  if (/muse 100\s*(?:sl|s l|super light)\b/.test(normalized)) return "muse-100sl";
  if (/muse 107\b/.test(normalized)) return "muse-107";
  if (/speed mp ul\b.*\b2026\b/.test(normalized)) return "speed-mp-ul-2026";
  if (/speed mp l\b.*\b2026\b/.test(normalized)) return "speed-mp-l-2026";
  if (/speed team\b.*\b2026\b/.test(normalized)) return "speed-team-2026";
  if (/speed elite\b.*\b2026\b/.test(normalized)) return "speed-elite-2026";
  if (/ig speed xceed\b/.test(normalized)) return "ig-speed-xceed-2026";
  if (/ig boom xceed\b/.test(normalized)) return "ig-boom-xceed-2026";
  if (/ig gravity xceed\b/.test(normalized)) return "ig-gravity-xceed-2026";
  if (/ig radical xceed\b/.test(normalized)) return "ig-radical-xceed-2026";
  if (/gravity mp l\b.*\b2025\b/.test(normalized)) return "gravity-mp-l-2025";
  if (/gravity team\b.*\b2025\b/.test(normalized)) return "gravity-team-2025";
  if (/radical team\b.*\b2025\b/.test(normalized)) return "radical-team-2025";
  if (/radical elite\b.*\b2025\b/.test(normalized)) return "radical-elite-2025";
  if (/instinct pwr 110\b.*\b2025\b/.test(normalized)) return "instinct-pwr-110-2025";
  if (/instinct pwr 115\b.*\b2025\b/.test(normalized)) return "instinct-pwr-115-2025";
  if (/instinct team l\b.*\b2025\b/.test(normalized)) return "instinct-team-l-2025";
  if (/extreme mp xl\b.*\b2026\b/.test(normalized)) return "extreme-mp-xl-2026";
  if (/extreme mp ul\b.*\b2026\b/.test(normalized)) return "extreme-mp-ul-2026";
  if (/extreme mp l\b.*\b2026\b/.test(normalized)) return "extreme-mp-l-2026";
  if (/extreme team\b.*\b2026\b/.test(normalized)) return "extreme-team-2026";
  if (/extreme elite\b.*\b2026\b/.test(normalized)) return "extreme-elite-2026";
  if (/boom mp ul\b.*\b2026\b/.test(normalized)) return "boom-mp-ul-2026";
  if (/boom mp l\b.*\b2026\b/.test(normalized)) return "boom-mp-l-2026";
  if (/boom mp l neon\b/.test(normalized)) return "boom-mp-l-2026";
  if (/boom team\b.*\b2026\b/.test(normalized)) return "boom-team-2026";
  if (/boom elite\b/.test(normalized)) return "boom-elite-2026";
  if (/(?:head )?squared\b/.test(normalized)) return "squared-2026";
  if (/boost wimbledon\b.*\b2026\b/.test(normalized)) return "boost-wimbledon-2026";
  if (/boost aero\b/.test(normalized)) return "boost-aero-2026";
  if (/boost strike\b/.test(normalized)) return "boost-strike-2026";
  if (/evo aero\b.*\b(?:gen ?2|2026)\b/.test(normalized)) return "evo-aero-gen2";
  if (/evo drive\b.*\b(?:gen ?2|2025|2026)\b/.test(normalized)) return "evo-drive-gen2";
  if (/\bclash\b/.test(normalized) && /\b(?:x2|2 pack|two pack|bundle)\b/.test(normalized)) return null;
  if (/clash (?:100 )?pro\b.*\b(?:v ?3|2025)\b/.test(normalized) || /clash pro 100\b.*\b(?:v ?3|2025)\b/.test(normalized)) return "clash-100-pro";
  if (/clash 100 ?ul\b.*\b(?:v ?3|2025)\b/.test(normalized)) return "clash-100ul-v3";
  if (/clash 100 ?l\b.*\b(?:v ?3|2025)\b/.test(normalized)) return "clash-100l-v3";
  if (/clash 108\b.*\b(?:v ?3|2025)\b/.test(normalized)) return "clash-108-v3";
  if (/clash 100\b.*\b(?:v ?3|2025)\b/.test(normalized)) return "clash-100";
  if (/clash (?:100 )?pro\b.*\b(?:v ?2|2022)\b/.test(normalized)) return "clash-100-pro-v2";
  if (/clash 100 ?ul\b.*\b(?:v ?2|2022)\b/.test(normalized)) return "clash-100ul-v2";
  if (/clash 100 ?l\b.*\b(?:v ?2|2022)\b/.test(normalized)) return "clash-100l-v2";
  if (/clash 108\b.*\b(?:v ?2|2022)\b/.test(normalized)) return "clash-108-v2";
  if (/clash 98\b.*\b(?:v ?2|2022)\b/.test(normalized)) return "clash-98-v2";
  if (/clash 100\b.*\b(?:v ?2|2022)\b/.test(normalized)) return "clash-100-v2";
  if (/clash 100 tour\b/.test(normalized)) return "clash-100-tour-v1";
  if (/clash 100 ?ul\b.*\b(?:v ?1|2019)\b/.test(normalized)) return "clash-100ul-v1";
  if (/clash 100 ?l\b.*\b(?:v ?1|2019)\b/.test(normalized)) return "clash-100l-v1";
  if (/clash 108\b.*\b(?:v ?1|2019)\b/.test(normalized)) return "clash-108-v1";
  if (/clash 98\b.*\b(?:v ?1|2019)\b/.test(normalized)) return "clash-98-v1";
  if (/clash 100\b.*\b(?:v ?1|2019)\b/.test(normalized)) return "clash-100-v1";
  if (/\b(98l|100l|100 l|100ul|100 ul|100sl|100 sl|mp l|team|lite|x2|2 pack)\b/.test(normalized)) return null;
  if (/pure drive (?:107|110)\b/.test(normalized)) return null;
  if (/defyer 100\b/.test(normalized)) return "defyer-100-v1";
  if (/blade 100 pro\b.*\bv10\b|blade pro 100\b.*\bv10\b/.test(normalized)) return "blade-pro-100-v10";
  if (/blade 98 pro\b.*\bv10\b|blade pro 98\b.*\bv10\b/.test(normalized)) return "blade-pro-98-v10";
  if (/blade 100/.test(normalized) && /\bv10\b/.test(normalized)) return "blade-100-v10";
  if (/blade 104\b.*\bv10\b/.test(normalized)) return "blade-104-v10";
  if (/blade 100/.test(normalized) && /\bv9\b/.test(normalized)) return "blade-100-v9";
  if (/blade 98/.test(normalized) && /\bv10\b/.test(normalized)) return "blade-v10";
  if (/blade 98/.test(normalized) && /\bv9\b/.test(normalized)) return "blade-v9";
  if (/blade 98/.test(normalized) && /\bv8\b/.test(normalized)) return "blade-v8";
  if (/blade 98/.test(normalized) && /\bv7\b/.test(normalized)) return "blade-v7";
  if (/ultra 99 pro\b.*\bv5\b/.test(normalized)) return "ultra-99-pro-v5";
  if (/ultra 100\b.*\bv5\b/.test(normalized)) return "ultra-100-v5";
  if (/pro staff x\b/.test(normalized)) return "pro-staff-x";
  if (/pro staff rf ?97\b.*\bv13\b|rf ?97\b.*\bv13\b/.test(normalized)) return "pro-staff-rf97-v13";
  if (/rf 01 pro\b/.test(normalized)) return "rf-01-pro";
  if (/rf 01\b/.test(normalized)) return "rf-01";
  if (/shift 99\b/.test(normalized)) return "shift-99";
  if (/ezone 98\b.*\b(?:7th gen|2022)\b|07ezone 98\b/.test(normalized)) return "ezone-98-2022";
  if (/ezone 98 tour\b/.test(normalized)) return "ezone-98-tour";
  if (/ezone 98\s*(?:plus|\+)/.test(raw) || /ezone 98 plus\b/.test(normalized)) return "ezone-98-plus";
  if (/ezone 98\b/.test(normalized)) return "ezone-98";
  if (/ezone 105\b/.test(normalized)) return "ezone-105";
  if (/ezone 100\s*(?:plus|\+)/.test(raw) || /ezone 100 plus\b/.test(normalized)) return "ezone-100-plus";
  if (/ezone 100\b.*\b(?:8th gen|2025|2026|blast blue)\b/.test(normalized)) return "ezone-100";
  if (/vcore 98\b.*\b(?:7th gen|2023)\b|07vcore 98\b/.test(normalized)) return "vcore-98-2023";
  if (/vcore 98 tour\b/.test(normalized)) return "vcore-98-tour";
  if (/vcore 98\s*(?:plus|\+)/.test(raw) || /vcore 98 plus\b/.test(normalized)) return "vcore-98-plus";
  if (/vcore 95\b/.test(normalized)) return "vcore-95";
  if (/vcore 100d\b|vcore 100 d\b/.test(normalized)) return "vcore-100d";
  if (/vcore 100\s*(?:plus|\+)/.test(raw) || /vcore 100 plus\b/.test(normalized)) return "vcore-100-plus";
  if (/percept 97d\b|percept 97 d\b/.test(normalized)) return "percept-97d";
  if (/percept 97h\b|percept 97 h\b/.test(normalized)) return "percept-97h";
  if (/percept 100d\b|percept 100 d\b/.test(normalized)) return "percept-100d";
  if (/percept 100\b/.test(normalized)) return "percept-100";
  if (/vcore pro 97\b.*\b(?:2021|v ?3)\b/.test(normalized)) return "vcore-pro-97-2021";
  if (/muse 98\b/.test(normalized)) return "muse-98";
  if (/muse 100\s*l\b/.test(normalized)) return "muse-100l";
  if (/muse 100\s*(?:sl|s l|super light)\b/.test(normalized)) return "muse-100sl";
  if (/muse 107\b/.test(normalized)) return "muse-107";
  if (/muse 100\b/.test(normalized)) return "muse-100";
  if (/aeropro drive\b|aero pro drive\b/.test(normalized)) return "aeropro-drive";
  if (/pure control tour\b/.test(normalized)) return "pure-control-tour";
  if (/pure aero rafa origin\b/.test(normalized)) return "pure-aero-rafa-origin";
  if (/pure aero rafa\b.*\b(?:2023|6th gen)\b/.test(normalized)) return "pure-aero-rafa-2023";
  if (/pure aero vs\b/.test(normalized)) return "pure-aero-vs";
  if (/pure aero(?: 100)? (?:plus|\+)\b/.test(raw) || /pure aero plus\b/.test(normalized)) return "pure-aero-plus";
  if (/pure aero 98\b/.test(normalized)) return "pure-aero-98";
  if (/pure aero (?:s ?lite|super l(?:ite|ight))\b.*\b(?:2026|gen ?9|9th generation)\b/.test(normalized)) return "pure-aero-super-lite-2026";
  if (/pure aero(?: 100)?\b.*\b(?:2023|gen ?8|8th generation)\b/.test(normalized)) return "pure-aero-2023";
  if (/pure aero(?: 100)?\b.*\b(?:2026|gen ?9|9th generation)\b/.test(normalized)) return "pure-aero-100";
  if (/vcore 98\b/.test(normalized)) return "vcore-98";
  if (/vcore 100\b.*\b(?:8th gen|2026)\b/.test(normalized)) return "vcore-100";
  if (/pure drive(?: 100)? (?:plus|\+)\b/.test(raw) || /pure drive plus\b/.test(normalized)) return "pure-drive-plus";
  if (/pure drive 98\b/.test(normalized)) return "pure-drive-98";
  if (/pure drive(?: 100)? wimbledon\b.*\b2026\b/.test(normalized)) return "pure-drive-100";
  if (/pure drive(?: 100)?\b.*\b(?:2021|gen ?10|10th generation)\b/.test(normalized)) return "pure-drive-2021";
  if (/pure drive(?: 100)?\b.*\b(?:2025|gen 11|generation 11)\b/.test(normalized)) return "pure-drive-100";
  if (/pure strike 97\b/.test(normalized)) return "pure-strike-97";
  if (/pure strike 100\b/.test(normalized) && hasStringPattern(raw, 16, 20)) return "pure-strike-100-16x20";
  if (/pure strike 100\b/.test(normalized)) return "pure-strike-100";
  if (/pure strike (?:103|vs)\b/.test(normalized)) return null;
  if (/pure strike(?: 98)?\b/.test(normalized) && hasStringPattern(raw, 18, 20)) return "pure-strike-98-18x20";
  if (/pure strike(?: 98)?\b/.test(normalized) && hasStringPattern(raw, 16, 19)) return "pure-strike-98";
  if (/pure strike 98\b/.test(normalized)) return "pure-strike-98";
  if (/pure strike\b/.test(normalized)) return "pure-strike-98";
  if (/pro staff 97\b/.test(normalized)) return "pro-staff-97";
  if (/percept 97\b/.test(normalized)) return "percept-97";
  if (/speed pro 2024\b/.test(normalized)) return "speed-pro-2024";
  if (/speed mp 2024\b/.test(normalized)) return "speed-mp-2024";
  if (/speed tour\b/.test(normalized)) return "speed-tour";
  if (/speed mp\b/.test(normalized)) return "speed-mp";
  if (/gravity pro 2023\b/.test(normalized)) return "gravity-pro-2023";
  if (/gravity mp 2023\b/.test(normalized)) return "gravity-mp-2023";
  if (/gravity pro 2025\b/.test(normalized)) return "gravity-pro-2025";
  if (/gravity mp 2025\b/.test(normalized)) return "gravity-mp-2025";
  if (/t fight iso 305\b|tfight iso 305\b/.test(normalized)) return "tfight-iso-305";
  if (/t fight 315s\b|tfight 315s\b/.test(normalized)) return "tfight-315s";
  if (/t fight 305s\b|tfight 305s\b/.test(normalized)) return "tfight-305s";
  if (/t fight 300s\b|tfight 300s\b/.test(normalized)) return "tfight-300s";
  if (/t fight 300\b|tfight 300\b/.test(normalized)) return "tfight-300";
  if (/t fight 285\b|tfight 285\b/.test(normalized)) return "tfight-285";
  if (/tf x1(?: v2)? 305\b|tfx1(?: v2)? 305\b/.test(normalized)) return "tfx1-305";
  if (/tf x1(?: v2)? 285\b|tfx1(?: v2)? 285\b/.test(normalized)) return "tfx1-285";
  if (/tf x1 300\b|tfx1 300\b/.test(normalized)) return "tfx1-300";
  if (/tempo 298\b/.test(normalized)) return "tempo-298";
  if (/tempo 285\b/.test(normalized)) return "tempo-285";
  if (/tf 40 315\b|tf40 315\b/.test(normalized)) return "tf40-315";
  if ((/tf 40 305\b|tf40 305\b/.test(normalized)) && hasStringPattern(raw, 18, 20)) return "tf40-305-18x20";
  if (/tf 40 305\b|tf40 305\b/.test(normalized)) return "tf40-305";
  if (/tf 40 290\b|tf40 290\b/.test(normalized)) return "tf40-290";
  if (/fire 305s\b|fire 305 s\b/.test(normalized)) return "fire-305s";
  if (/fire 300\b/.test(normalized)) return "fire-300";
  if (/fire 285\b/.test(normalized)) return "fire-285";
  if (/fire 270\b/.test(normalized)) return "fire-270";
  if (/radical pro 2023\b/.test(normalized)) return "radical-pro-2023";
  if (/radical mp 2023\b/.test(normalized)) return "radical-mp-2023";
  if (/radical pro 2025\b/.test(normalized)) return "radical-pro-2025";
  if (/radical mp 2025\b/.test(normalized)) return "radical-mp-2025";
  if (/speed pro (?:2026|legend 2025)\b/.test(normalized)) return "speed-pro-2026";
  if (/extreme pro (?:2026|2024)\b/.test(normalized)) return "extreme-pro-2026";
  if (/extreme mp (?:2026|2024)\b/.test(normalized)) return "extreme-mp-2026";
  if (/extreme tour 2022\b/.test(normalized)) return "extreme-tour-2022";
  if (/boom pro 2022\b/.test(normalized)) return "boom-pro-2022";
  if (/boom mp 2022\b/.test(normalized)) return "boom-mp-2022";
  if (/boom pro\b/.test(normalized)) return "boom-pro";
  if (/boom mp\b/.test(normalized)) return "boom-mp";
  if (/prestige mp 2023\b/.test(normalized)) return "prestige-mp-2023";
  if (/prestige pro\b/.test(normalized)) return "prestige-pro";
  if (/prestige tour\b/.test(normalized)) return "prestige-tour";
  if (/instinct mp\b/.test(normalized)) return "instinct-mp";
  if (/gravity tour 2025\b/.test(normalized)) return "gravity-tour-2025";
  return null;
}

function classifyUsed(title: string): string | null {
  if (/\b(pro ?stock|paint ?job|signed|autograph|replica)\b/i.test(title)) return null;
  if (/pure strike/i.test(title) && !/pure strike\s+(?:97|98|100)\b/i.test(title)) return null;
  return classify(title.replace(/\b(demo|used|pre[- ]owned|preowned|demo racquet|demo frame)\b/gi, " "));
}

function isGripThree(value: string) {
  const normalized = value.toLowerCase().replaceAll("⅛", "1/8").replaceAll("¼", "1/4").replaceAll("⅜", "3/8").replaceAll("½", "1/2").replaceAll("⅝", "5/8");
  const number = activeGripSize.slice(1);
  return new RegExp(`(?:^|[^a-z0-9])(?:l|g|grip\\s*|size\\s*)${number}(?:$|[^0-9])`, "i").test(normalized)
    || (activeGripSize === "L0"
      ? /(?:^|[^0-9])4(?:[.]0)?\s*(?:in(?:ch(?:es)?)?|\")?(?:$|[^0-9/])/.test(normalized)
      : normalized.includes(gripMeasurements[activeGripSize]));
}

function isAccessory(title: string) {
  return /\b(demo|used|grommet|junior|jr|bag|cover|case|string|grip|overgrip|shoe|sock|apparel|hat)\b/i.test(title);
}

function cleanGrip(value: string) {
  return isGripThree(value) ? activeGripSize : null;
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
    const response = await fetch(`${feed.origin}/s?k=${encodeURIComponent(`${search} ${activeGripSize} ${gripMeasurements[activeGripSize]}`)}`, {
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
        gripSizes: [`${activeGripSize} (search-filtered)`],
      });
    }
  }
  return [...new Map(allOffers.map((offer) => [offer.id, offer])).values()];
}

async function fetchWooCommerce(feed: Feed): Promise<ParsedOffer[]> {
  const response = await fetch(feed.url, {
    headers: {
      accept: "application/json",
      "user-agent": "BaselinePriceTracker/1.0 (+Canadian tennis price comparison)",
    },
    signal: AbortSignal.timeout(14000),
  });
  if (!response.ok) throw new Error(`${feed.name}: ${response.status}`);
  const products = (await response.json()) as WooProduct[];
  return products.flatMap((product) => {
    const modelKey = classify(product.name) ?? "other-sale";
    if (modelKey === "other-sale" && isAccessory(product.name)) return [];
    const gripTerms = (product.attributes ?? [])
      .filter((attribute) => /grip/i.test(attribute.name))
      .flatMap((attribute) => attribute.terms ?? [])
      .map((term) => term.name);
    const availableGrips = gripTerms.filter(isGripThree);
    const divisor = 10 ** (product.prices.currency_minor_unit ?? 2);
    const currentPrice = Number(product.prices.price) / divisor;
    const regularPrice = Number(product.prices.regular_price) / divisor;
    const isSale = Number.isFinite(regularPrice) && regularPrice > currentPrice;
    if (modelKey === "other-sale" && !isSale) return [];
    const grips = [...new Set(availableGrips.map(cleanGrip).filter((grip): grip is string => Boolean(grip)))];
    return [{
      id: `${feed.name}:${product.id}`,
      modelKey,
      store: feed.name,
      title: product.name.replaceAll("&#215;", "×").replaceAll("&#8217;", "’"),
      url: product.permalink,
      currentPrice: product.is_in_stock && grips.length && Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : null,
      compareAtPrice: isSale ? regularPrice : null,
      inStock: product.is_in_stock && grips.length > 0,
      gripSizes: grips,
    }];
  });
}

type LightspeedVariant = {
  active?: boolean;
  title?: string;
  price?: { price?: number; price_old?: number };
  stock?: { available?: boolean };
};

type LightspeedProduct = {
  id?: number;
  title?: string;
  url?: string;
  variants?: Record<string, LightspeedVariant>;
};

function decodeHtmlAttribute(value: string) {
  return value.replaceAll("&amp;", "&").replaceAll("&#39;", "'").replaceAll("&quot;", '"');
}

async function fetchLightspeed(feed: Feed): Promise<ParsedOffer[]> {
  const productJsonUrls = new Set<string>();
  let pageUrl = feed.url;
  for (let page = 0; page < 8 && pageUrl; page += 1) {
    const response = await fetch(pageUrl, {
      headers: { accept: "text/html,application/xhtml+xml", "user-agent": "Mozilla/5.0 (compatible; BaselinePriceTracker/1.0)" },
      signal: AbortSignal.timeout(16000),
    });
    if (!response.ok) throw new Error(`${feed.name}: catalog ${response.status}`);
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
  const offers: ParsedOffer[] = [];
  for (let offset = 0; offset < urls.length; offset += 6) {
    const products = await Promise.all(urls.slice(offset, offset + 6).map(async (jsonUrl) => {
      const response = await fetch(jsonUrl, {
        headers: { accept: "application/json", "user-agent": "Mozilla/5.0 (compatible; BaselinePriceTracker/1.0)" },
        signal: AbortSignal.timeout(16000),
      });
      if (!response.ok) throw new Error(`${feed.name}: product ${response.status}`);
      return ((await response.json()) as { product?: LightspeedProduct }).product;
    }));
    for (const product of products) {
      if (!product?.title) continue;
      const modelKey = classify(product.title) ?? "other-sale";
      if (modelKey === "other-sale" && isAccessory(product.title)) continue;
      const variants = Object.values(product.variants ?? {}).filter((variant) =>
        variant.active !== false && variant.stock?.available && isGripThree(variant.title ?? ""));
      const prices = variants.map((variant) => Number(variant.price?.price)).filter((price) => Number.isFinite(price) && price > 0);
      if (!prices.length) continue;
      const currentPrice = Math.min(...prices);
      const compareAtPrice = variants.map((variant) => Number(variant.price?.price_old))
        .filter((price) => Number.isFinite(price) && price > currentPrice)
        .sort((a, b) => a - b)[0] ?? null;
      if (modelKey === "other-sale" && compareAtPrice === null) continue;
      offers.push({
        id: `${feed.name}:${product.id ?? product.url}`,
        modelKey,
        store: feed.name,
        title: product.title,
        url: new URL(product.url ?? "", `${feed.origin}/`).href,
        currentPrice,
        compareAtPrice,
        inStock: true,
        gripSizes: [activeGripSize],
      });
    }
  }
  return offers;
}

type JsonObject = Record<string, unknown>;

function productJsonLd(html: string): JsonObject[] {
  const products: JsonObject[] = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const value = JSON.parse(match[1].replaceAll("&quot;", '"').replaceAll("&amp;", "&"));
      const queue: unknown[] = Array.isArray(value) ? [...value] : [value];
      while (queue.length) {
        const item = queue.shift();
        if (!item || typeof item !== "object") continue;
        const record = item as JsonObject;
        if (record["@type"] === "Product") products.push(record);
        if (Array.isArray(record["@graph"])) queue.push(...record["@graph"]);
        if (Array.isArray(record.itemListElement)) {
          queue.push(...record.itemListElement.map((entry) => {
            const object = entry && typeof entry === "object" ? entry as JsonObject : null;
            return object?.item ?? entry;
          }));
        }
      }
    } catch { /* Ignore malformed merchant metadata. */ }
  }
  return products;
}

function jsonLdOffer(product: JsonObject): JsonObject | undefined {
  const source = product.offers ?? product.Offers;
  const offers = Array.isArray(source) ? source : source ? [source] : [];
  return offers.find((offer) => offer && typeof offer === "object"
    && /InStock/i.test(String((offer as JsonObject).availability ?? (offer as JsonObject).Availability ?? ""))) as JsonObject
    ?? offers.find((offer) => offer && typeof offer === "object") as JsonObject | undefined;
}

function probableRacquetSlug(url: string) {
  const slug = decodeURIComponent(url.split("/").pop() ?? "").replaceAll("-", " ");
  return /blade|clash|ultra|pro staff|rf 01|shift|ezone|vcore|percept|muse|pure aero|pure drive|pure strike|speed|gravity|radical|extreme|boom|prestige|instinct|tf40|t fight|tfight|tf x1|tfx1|tempo/i.test(slug);
}

async function fetchWix(feed: Feed): Promise<ParsedOffer[]> {
  const response = await fetch(feed.url, {
    headers: { accept: "text/html,application/xhtml+xml", "user-agent": "Mozilla/5.0 (compatible; BaselinePriceTracker/1.0)" },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`${feed.name}: catalog ${response.status}`);
  const catalog = await response.text();
  const urls = [...new Set([...catalog.matchAll(/href=["'](https?:\/\/[^"']+\/product-page\/[^"'?#]+)/gi)]
    .map((match) => decodeHtmlAttribute(match[1])))]
    .filter(probableRacquetSlug)
    .slice(0, 40);
  const offers: ParsedOffer[] = [];
  for (let offset = 0; offset < urls.length; offset += 4) {
    const pages = await Promise.all(urls.slice(offset, offset + 4).map(async (url) => {
      const page = await fetch(url, {
        headers: { accept: "text/html", "user-agent": "Mozilla/5.0 (compatible; BaselinePriceTracker/1.0)" },
        signal: AbortSignal.timeout(25000),
      });
      return page.ok ? { url, html: await page.text() } : null;
    }));
    for (const page of pages) {
      if (!page) continue;
      const product = productJsonLd(page.html)[0];
      const title = typeof product?.name === "string" ? product.name : "";
      const modelKey = classify(title);
      if (!modelKey) continue;
      const gripSelection = [...page.html.matchAll(/"id":(\d+),"value":"([^"]+)"/g)]
        .map((match) => ({ id: Number(match[1]), value: match[2].replaceAll("\\/", "/") }))
        .find((selection) => isGripThree(selection.value));
      const itemMatch = page.html.match(/"productItems":(\[[\s\S]*?\]),"name":/);
      let item: JsonObject | undefined;
      if (gripSelection && itemMatch) {
        try {
          const items = JSON.parse(itemMatch[1]) as JsonObject[];
          item = items.find((candidate) => Array.isArray(candidate.optionsSelections)
            && candidate.optionsSelections.includes(gripSelection.id)
            && ((candidate.inventory as JsonObject | undefined)?.status === "in_stock" || candidate.availableForPreOrder));
        } catch { /* Ignore malformed storefront state. */ }
      }
      if (!item) continue;
      const currentPrice = Number(item.price);
      if (!Number.isFinite(currentPrice) || currentPrice <= 0) continue;
      const compare = Number(item.comparePrice);
      offers.push({
        id: `${feed.name}:${page.url}`, modelKey, store: feed.name, title, url: page.url,
        currentPrice, compareAtPrice: compare > currentPrice ? compare : null,
        inStock: true, gripSizes: [activeGripSize],
      });
    }
  }
  return offers;
}

async function fetchStructured(feed: Feed): Promise<ParsedOffer[]> {
  const response = await fetch(feed.url, {
    headers: {
      accept: "text/html,application/xhtml+xml", "accept-language": "en-CA,en;q=.8",
      "user-agent": "Mozilla/5.0 (compatible; BaselinePriceTracker/1.0)",
    },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`${feed.name}: catalog ${response.status}`);
  const offers: ParsedOffer[] = [];
  for (const product of productJsonLd(await response.text())) {
    const title = typeof product.name === "string" ? product.name : "";
    const modelKey = classify(title);
    const offer = jsonLdOffer(product);
    const currentPrice = Number(offer?.price ?? offer?.lowPrice);
    if (!modelKey || !isGripThree(JSON.stringify(product)) || !Number.isFinite(currentPrice) || currentPrice <= 0
      || /OutOfStock/i.test(String(offer?.availability ?? ""))) continue;
    const destination = String(offer?.url ?? product.url ?? feed.url);
    offers.push({
      id: `${feed.name}:${String(product.sku ?? destination ?? title)}`, modelKey, store: feed.name, title,
      url: new URL(destination, feed.origin).href, currentPrice, compareAtPrice: null,
      inStock: true, gripSizes: [activeGripSize],
    });
  }
  return offers;
}

async function fetchFeed(feed: Feed): Promise<ParsedOffer[]> {
  if (feed.kind === "amazon") return fetchAmazon(feed);
  if (feed.kind === "woocommerce") return fetchWooCommerce(feed);
  if (feed.kind === "lightspeed") return fetchLightspeed(feed);
  if (feed.kind === "wix") return fetchWix(feed);
  if (feed.kind === "structured") return fetchStructured(feed);
  const products = await fetchShopifyCatalogs(feed);
  return products.flatMap((product) => {
      const productName = `${product.vendor ?? ""} ${product.title ?? ""}`.trim();
      if (isAccessory(productName)) return [];
      const parentModelKey = classify(productName);
      const available = product.variants
        .filter((variant) => variant.available && isGripThree(`${variant.option1 ?? ""} ${variant.title}`))
        .map((variant) => ({
          variant,
          modelKey: classify(`${productName} ${variant.title ?? ""} ${variant.sku ?? ""}`) ?? parentModelKey ?? "other-sale",
        }));
      const groups = new Map<string, typeof available>();
      for (const item of available) groups.set(item.modelKey, [...(groups.get(item.modelKey) ?? []), item]);
      return [...groups].flatMap(([modelKey, group]) => {
        const prices = group.map(({ variant }) => Number(variant.price)).filter(Number.isFinite);
        if (!prices.length) return [];
        const saleVariants = group.filter(({ variant }) => {
          const compareAt = Number(variant.compare_at_price);
          return Number.isFinite(compareAt) && compareAt > Number(variant.price);
        });
        if (modelKey === "other-sale" && saleVariants.length === 0) return [];
        const comparePrices = group.map(({ variant }) => Number(variant.compare_at_price))
          .filter((price) => Number.isFinite(price) && price > 0);
        const grips = [...new Set(group.map(({ variant }) => cleanGrip(`${variant.option1 ?? ""} ${variant.title}`))
          .filter((grip): grip is string => Boolean(grip)))];
        const variantLabel = group[0]?.variant.title?.split(" / ")[0];
        return [{
        id: `${feed.name}:${product.handle}:${modelKey}`,
        modelKey,
        store: feed.name,
        title: groups.size > 1 && variantLabel ? `${product.title} — ${variantLabel}` : product.title,
        url: `${feed.origin}/products/${product.handle}`,
        currentPrice: prices.length ? Math.min(...prices) : null,
        compareAtPrice: comparePrices.length ? Math.min(...comparePrices) : null,
        inStock: group.length > 0,
        gripSizes: grips,
      }];
      });
    });
}

async function fetchUsedFeed(feed: Feed): Promise<ParsedUsedOffer[]> {
  if (feed.kind && feed.kind !== "shopify") return [];
  const catalogUrl = feed.name === "RacquetGuys" ? "https://racquetguys.ca/collections/used-tennis-racquets/products.json?limit=250" : feed.url;
  const products: ShopifyProduct[] = [];
  for (let page = 1; page <= 4; page += 1) {
    const pageUrl = new URL(catalogUrl);
    pageUrl.searchParams.set("limit", "250");
    pageUrl.searchParams.set("page", String(page));
    const response = await fetch(pageUrl, {
      headers: { accept: "application/json", "user-agent": "BaselinePriceTracker/1.0 (+Canadian tennis price comparison)" },
      signal: AbortSignal.timeout(14000),
    });
    if (!response.ok) throw new Error(`${feed.name}: ${response.status}`);
    const payload = (await response.json()) as { products?: ShopifyProduct[] };
    const batch = payload.products ?? [];
    products.push(...batch);
    if (batch.length < 250) break;
  }
  return products.flatMap((product) => {
    if (!/\b(demo|used|pre[- ]owned|preowned)\b/i.test(product.title)) return [];
    const modelKey = classifyUsed(product.title);
    if (!modelKey) return [];
    const available = product.variants.filter((variant) => variant.available && isGripThree(`${variant.option1 ?? ""} ${variant.title}`));
    const prices = available.map((variant) => Number(variant.price)).filter((price) => Number.isFinite(price) && price > 0);
    if (!prices.length) return [];
    const comparePrices = available.map((variant) => Number(variant.compare_at_price)).filter((price) => Number.isFinite(price) && price > 0);
    const grips = [...new Set(available.map((variant) => cleanGrip(`${variant.option1 ?? ""} ${variant.title}`)).filter((grip): grip is string => Boolean(grip)))];
    return [{
      id: `used:${feed.name}:${product.handle}`,
      modelKey,
      store: feed.name,
      title: product.title,
      url: `${feed.origin}/products/${product.handle}`,
      currentPrice: Math.min(...prices),
      compareAtPrice: comparePrices.length ? Math.min(...comparePrices) : null,
      inStock: true,
      gripSizes: grips,
      condition: /demo/i.test(product.title) ? "Demo" : "Used",
    }];
  });
}

async function runCheck() {
  await ensureSchema();
  activeGripSize = await getGripSize();
  const checkedAt = new Date().toISOString();
  const enabledFeeds = await getEnabledFeeds();
  const results = await Promise.allSettled(enabledFeeds.map(fetchFeed));
  const usedResults = await Promise.allSettled(enabledFeeds.map(fetchUsedFeed));
  const offers = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const usedOffers = usedResults.flatMap((result) => result.status === "fulfilled" ? result.value : []);
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

  // Used/demo inventory is volatile; remove stale rows so the tab never shows
  // a listing that disappeared or became a zero-price rental.
  await database.prepare("DELETE FROM used_offers").run();
  for (const offer of usedOffers) {
    await database.prepare(`INSERT INTO used_offers
      (id, model_key, store, title, url, current_price, compare_at_price, in_stock, grip_sizes, condition, last_checked)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET model_key=excluded.model_key, store=excluded.store,
        title=excluded.title, url=excluded.url, current_price=excluded.current_price,
        compare_at_price=excluded.compare_at_price, in_stock=excluded.in_stock,
        grip_sizes=excluded.grip_sizes, condition=excluded.condition, last_checked=excluded.last_checked`)
      .bind(offer.id, offer.modelKey, offer.store, offer.title, offer.url, offer.currentPrice,
        offer.compareAtPrice, offer.inStock ? 1 : 0, JSON.stringify(offer.gripSizes), offer.condition, checkedAt).run();
  }

  await database.prepare(
    "INSERT INTO checks (checked_at, stores_checked, offers_found, failures) VALUES (?, ?, ?, ?)",
  ).bind(checkedAt, enabledFeeds.length, offers.length, results.filter((result) => result.status === "rejected").length + usedResults.filter((result) => result.status === "rejected").length).run();

  return getDashboard();
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
  const url = new URL(request.url);
  if (url.searchParams.get("action") === "check") return runCheck();
  if (url.searchParams.get("action") === "models") return runCheck();
  if (url.searchParams.get("action") === "model") {
    const modelKey = url.searchParams.get("modelKey") ?? "";
    if (!(modelKey in modelNames)) return Response.json({ error: "Unknown model" }, { status: 400 });
    return runCheck();
  }
  return Response.json({ error: "Unknown action" }, { status: 400 });
}

export async function PATCH(request: Request) {
  if (isPublicPreview(request)) return publicPreviewDenied();
  await ensureSchema();
  const body = await request.json() as { modelKey?: string; targetPrice?: number; market?: "new" | "used"; retailerKey?: string; enabled?: boolean; slot?: number; selectedModelKey?: string; featuredBrand?: FeaturedBrand; featuredSlot?: number; gripSize?: GripSize };
  if (body.gripSize) {
    if (!validGripSizes.has(body.gripSize)) return Response.json({ error: "Invalid grip size" }, { status: 400 });
    await db().prepare("INSERT INTO tracker_preferences (key, value) VALUES ('grip_size', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .bind(body.gripSize).run();
    activeGripSize = body.gripSize;
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
    if (body.slot! < 0 || body.slot! >= shortlistSlotCount || !(body.selectedModelKey in modelNames)) {
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
  if (!body.modelKey || !(body.modelKey in defaultTargets) || !Number.isFinite(body.targetPrice) || Number(body.targetPrice) < 1) {
    return Response.json({ error: "Invalid target" }, { status: 400 });
  }
  const targetTable = body.market === "used" ? "used_targets" : "targets";
  await db().prepare(`UPDATE ${targetTable} SET target_price = ? WHERE model_key = ?`)
    .bind(Number(body.targetPrice), body.modelKey).run();
  return getDashboard();
}
