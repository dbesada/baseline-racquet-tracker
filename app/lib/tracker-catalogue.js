// Tracker catalogue settings shared by the API route (app/api/tracker/route.ts),
// the NAS relay and the GitHub price check: which retailers exist, which
// racquets are top rated, new or on pre-order, and the default picks.

import { defaultTargets } from "./racquet-catalogue.js";

/** @type {Array<{ key: string; name: string; origin: string; url: string; kind?: "shopify" | "woocommerce" | "amazon" | "lightspeed" | "wix" | "structured" | "manual" }>} */
export const feeds = [
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

/** @type {Record<string, number>} */
export const defaultUsedTargets = Object.fromEntries(
  Object.entries(defaultTargets).map(([key, value]) => [key, Math.round((value * 0.68) / 5) * 5]),
);

export const topRatedModelKeys = new Set([
  "defyer-98-pro-v1", "defyer-100-v1", "blade-pro-98-v10", "blade-pro-98-18x20-v10", "blade-v10", "blade-v9",
  "ezone-98", "ezone-98-tour", "ezone-100", "pure-aero-98", "pure-aero-100",
  "clash-100", "vcore-98", "vcore-100", "pure-drive-100", "gravity-mp-2025",
  "tf40-290", "tf40-305", "tfight-300", "tfight-300s", "tfight-305s", "fire-305s", "speed-pro-2026", "rf-01-pro", "gravity-tour-2025", "squared-2026",
  "pure-strike-98", "pure-strike-98-18x20", "pure-strike-100", "percept-97", "percept-97d", "speed-mp",
]);
export const newReleaseModelKeys = new Set([
  "blade-pro-98-v10", "blade-pro-98-18x20-v10", "blade-pro-100-v10", "blade-v10", "blade-98-18x20-v10", "blade-100-v10", "blade-100l-v10", "blade-100ul-v10", "blade-104-v10",
  "pro-staff-97-classic", "pro-staff-97l-classic", "pro-staff-team-classic",
  "vcore-95", "vcore-98", "vcore-98l", "vcore-98-plus", "vcore-98-tour", "vcore-100", "vcore-100d", "vcore-100l", "vcore-100-plus", "muse-98", "muse-100", "muse-100l", "muse-100sl", "muse-107",
  "pure-aero-98", "pure-aero-100", "pure-aero-team-2026", "pure-aero-lite-2026", "pure-aero-super-lite-2026", "pure-aero-plus",
  "speed-pro-2026", "speed-mp", "speed-tour", "extreme-pro-2026", "extreme-mp-2026", "extreme-mp-xl-2026", "extreme-mp-l-2026", "extreme-mp-ul-2026", "extreme-team-2026", "extreme-elite-2026", "boom-pro", "boom-mp", "boom-mp-l-2026", "boom-mp-ul-2026", "boom-elite-2026", "squared-2026",
  "fire-305s", "fire-300", "fire-285", "fire-270",
]);
// Racquets announced but not yet released. Remove an entry once it ships;
// the page also stops calling a racquet a pre-order once a store has it in stock.
/** @type {Record<string, string>} */
export const preorderModelLabels = {
  "boom-team-2026": "Coming soon",
  "ig-boom-xceed-2026": "Coming soon",
};
export const defaultModelOrder = ["blade-v10", "blade-v9", "blade-v8", "ezone-98", "pure-aero-98", "speed-pro-2026"];
export const shortlistSlotCount = 6;
export const featuredBrands = ["Wilson", "Yonex", "Babolat", "Head", "Tecnifibre", "Dunlop", "Prince", "Volkl"];
export const featuredSlotCount = 6;
/** @type {Record<string, string[]>} */
export const defaultBrandPicks = {
  Wilson: ["blade-v10", "defyer-98-pro-v1", "clash-100", "clash-100-pro", "ultra-100-v5", "pro-staff-97-classic"],
  Yonex: ["ezone-98", "ezone-100", "vcore-98", "vcore-100", "percept-97", "percept-100"],
  Babolat: ["pure-aero-98", "pure-aero-100", "pure-drive-98", "pure-drive-100", "pure-strike-98", "pure-strike-100"],
  Head: ["speed-pro-2026", "speed-mp", "gravity-pro-2025", "gravity-mp-2025", "radical-pro-2025", "radical-mp-2025"],
  Tecnifibre: ["tf40-290", "tf40-305", "tfight-300s", "tfight-305s", "fire-305s", "tfx1-300"],
  Dunlop: ["dunlop-cx-200", "dunlop-cx-200-tour-16x19", "dunlop-cx-200-tour-18x20", "dunlop-cx-400", "dunlop-cx-400-tour", "dunlop-fx-500-lite-2026"],
  Prince: ["prince-vortex-100-310", "prince-vortex-100-300", "prince-tour-100p-305", "prince-o3-ripstick-100-280", "prince-legacy-110", "prince-warrior-100-265"],
  Volkl: ["volkl-c10-evo", "volkl-v1-evo", "volkl-v1-classic", "volkl-vcell-v1-mp", "volkl-vcell-10-320", "volkl-vcell-10-300"],
};
