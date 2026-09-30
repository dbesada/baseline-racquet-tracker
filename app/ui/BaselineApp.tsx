"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BaselineCoach, type CoachModel, type CoachString } from "./BaselineCoach";

type Offer = {
  id: string;
  modelKey: string;
  store: string;
  title: string;
  url: string;
  currentPrice: number | null;
  previousPrice: number | null;
  compareAtPrice: number | null;
  inStock: boolean;
  gripSizes: string[];
  lastChecked: string;
  condition?: string;
  currency?: "CAD" | "USD";
  specs?: RacquetSpec | null;
  sourceState?: "fresh" | "stale";
};

type StringOffer = {
  id: string;
  store: string;
  title: string;
  url: string;
  currentPrice: number | null;
  compareAtPrice: number | null;
  inStock: boolean;
  brand: string;
  type: StringType;
  gauges: string[];
  format: StringFormat;
  lastChecked: string;
  sourceState?: "fresh" | "stale";
};

type AccessoryOffer = {
  id: string;
  store: string;
  title: string;
  url: string;
  currentPrice: number | null;
  compareAtPrice: number | null;
  inStock: boolean;
  brand: string;
  category: AccessoryCategory;
  detail: string;
  lastChecked: string;
  sourceState?: "fresh" | "stale";
};

type BallOffer = {
  id: string;
  store: string;
  title: string;
  url: string;
  currentPrice: number | null;
  compareAtPrice: number | null;
  inStock: boolean;
  brand: string;
  type: BallType;
  package: string;
  lastChecked: string;
  sourceState?: "fresh" | "stale";
};

type Dashboard = {
  publicPreview?: boolean;
  offers: Offer[];
  saleOffers: Offer[];
  specialOffers?: Offer[];
  stringOffers?: StringOffer[];
  stringSourceResults?: Array<{ store: string; ok: boolean; offers: number; durationMs?: number; error?: string | null }>;
  accessoryOffers?: AccessoryOffer[];
  accessorySourceResults?: Array<{ store: string; ok: boolean; offers: number; durationMs?: number; error?: string | null }>;
  ballOffers?: BallOffer[];
  ballSourceResults?: Array<{ store: string; ok: boolean; offers: number; durationMs?: number; error?: string | null }>;
  usedOffers: Offer[];
  targets: Record<string, number>;
  usedTargets: Record<string, number>;
  lastCheck: null | { checkedAt: string; storesChecked: number; offersFound: number; failures: number };
  dropsLast24Hours: number;
  history: Array<{ modelKey: string; price: number; checkedAt: string }>;
  modelNames: Record<string, string>;
  modelOptions: Array<{ key: string; name: string; topRated: boolean; releaseStatus?: "new" | "preorder" | "catalogue"; releaseLabel?: string | null }>;
  modelOrder: string[];
  brandPicks: Record<Exclude<BrandKey, "all">, string[]>;
  stores: string[];
  retailers: Array<{ key: string; name: string; enabled: boolean; kind: string; url: string }>;
  gripSize: GripSize;
  racquetSpecs?: Record<string, RacquetSpec>;
  specValidation?: Record<string, SpecValidation>;
  usedSourceResults?: Array<{ source: string; ok: boolean; offers: number; durationMs?: number; error?: string | null; configured?: boolean }>;
  sourceHealth?: { liveSources: number; totalSources: number; failures: number; freshOffers: number; staleOffers: number; averageDurationMs: number };
  modelRefresh?: null | { status: "running" | "complete" | "failed"; startedAt: string; checkedAt: string | null; scanned: number; verified: number; images: number };
  modelSelectionRefreshes?: Record<string, { ok: boolean; checkedAt: string; fields: number; image: boolean; retailerSources: number; error: string | null }>;
};

type MarketTab = "retail" | "used";
type GripSize = "L0" | "L1" | "L2" | "L3" | "L4" | "L5";
type BrandKey = "all" | "Wilson" | "Yonex" | "Babolat" | "Head" | "Tecnifibre" | "Dunlop" | "Prince" | "Volkl";
type BrandViewKey = BrandKey | "catalogue" | "special" | "strings" | "balls" | "accessories" | "guide" | "string-guide";
type HeadSizeFilter = string;
type WeightFilter = "all" | "light" | "medium" | "standard" | "heavy";
type PatternFilter = "all" | "16x19" | "16x20" | "18x20" | "other";
type CatalogueSort = "featured" | "name-asc" | "name-desc" | "head-asc" | "head-desc" | "weight-asc" | "weight-desc" | "stiffness-asc" | "stiffness-desc" | "price-asc" | "price-desc" | "availability" | "discount" | "tour-presence" | "style-distinctive" | "style-understated";
type CatalogueMetric = { price: number; retailers: number; discount: number; tourPresence: number };
type StringType = "Polyester" | "Multifilament" | "Synthetic gut" | "Natural gut" | "Hybrid" | "Monofilament" | "Other";
type StringTypeFilter = "all" | StringType;
type StringFormat = "Reel" | "Set" | "Half set" | "Single package";
type StringFormatFilter = "all" | StringFormat;
type AccessoryCategory = "Replacement grips" | "Overgrips" | "Grommets & bumpers" | "Dampeners" | "Racquet bags" | "Customization" | "Racquet care";
type AccessoryCategoryFilter = "all" | AccessoryCategory;
type AccessorySort = "featured" | "price-asc" | "price-desc" | "discount";
type BallType = "Extra duty" | "Regular duty" | "All court" | "Clay court" | "Pressureless" | "Junior" | "Other";
type BallTypeFilter = "all" | BallType;
type BallSort = "featured" | "price-asc" | "price-desc" | "discount";

type PublicPreferences = {
  gripSize?: GripSize;
  modelOrder?: string[];
  targets?: Record<string, number>;
  usedTargets?: Record<string, number>;
};

type AnalyticsSummary = {
  startedAt: string;
  windowDays: number;
  totals: { pageViews: number; dealOpens: number; retailerOpens: number; comparisons: number; coachOpens: number; usedMarket: number };
  daily: Array<{ date: string; pageViews: number; dealOpens: number }>;
  sections: Array<{ section: string; count: number }>;
  operations: { freshOffers: number; liveSources: number; totalSources: number; dropsLast24Hours: number; lastChecked: string | null };
};

const publicPreferencesKey = "baseline-public-preferences-v1";

function readPublicPreferences(): PublicPreferences {
  try {
    const parsed = JSON.parse(localStorage.getItem(publicPreferencesKey) ?? "{}") as PublicPreferences;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writePublicPreferences(preferences: PublicPreferences) {
  localStorage.setItem(publicPreferencesKey, JSON.stringify(preferences));
}

function applyPublicPreferences(dashboard: Dashboard): Dashboard {
  if (!dashboard.publicPreview) return dashboard;
  const preferences = readPublicPreferences();
  const validModels = new Set(dashboard.modelOptions.map((model) => model.key));
  const savedModels = (preferences.modelOrder ?? []).filter((modelKey, index, list) => validModels.has(modelKey) && list.indexOf(modelKey) === index).slice(0, 6);
  const fallbackModels = dashboard.modelOrder.filter((modelKey) => !savedModels.includes(modelKey));
  const modelOrder = [...savedModels, ...fallbackModels].slice(0, 6);
  const gripSize = preferences.gripSize && gripOptions.some((option) => option.key === preferences.gripSize) ? preferences.gripSize : dashboard.gripSize;
  return {
    ...dashboard,
    gripSize,
    modelOrder,
    targets: { ...dashboard.targets, ...(preferences.targets ?? {}) },
    usedTargets: { ...dashboard.usedTargets, ...(preferences.usedTargets ?? {}) },
  };
}

function publicPreferencesFromDashboard(dashboard: Dashboard): PublicPreferences {
  return { gripSize: dashboard.gripSize, modelOrder: dashboard.modelOrder, targets: dashboard.targets, usedTargets: dashboard.usedTargets };
}
type UsedSort = "watchlist" | "price-asc" | "listings-desc" | "name-asc";
type UsedAvailability = "all" | "live" | "empty";
type OpportunityMode = "target" | "availability" | "tour";
type SpecialGripFilter = "all" | GripSize | "multiple";
type SpecialAvailabilityFilter = "all" | "multi";
type SpecialSort = "edition" | "name-asc" | "price-asc" | "price-desc" | "retailers-desc";

type RacquetSpec = {
  head?: string;
  weight?: string;
  strungWeight?: string;
  balance?: string;
  strungBalance?: string;
  swingweight?: string;
  pattern?: string;
  beam?: string;
  length?: string;
  stiffness?: string;
  composition?: string;
  tension?: string;
  productCode?: string;
  imageUrl?: string;
  gripSizes?: string;
  color?: string;
  madeIn?: string;
  recommendedStrings?: string;
  notablePlayer?: string;
  profile?: string;
  source?: string;
  sourceUrl?: string;
};

type SpecValidation = {
  status: "confirmed" | "conflict" | "retailer-consensus" | "insufficient";
  sources: Array<{ store: string; url: string }>;
  confirmedFields: number;
  conflictFields: number;
  consensusFields: number;
  fieldChecks: Record<string, { status: "confirmed" | "conflict" | "retailer-consensus"; official: string | null; consensus: string; retailers: string[] }>;
  consensus: RacquetSpec;
};

type UsedMarketplace = {
  key: string;
  name: string;
  note: string;
  buildUrl: (query: string) => string;
};

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type SpecialEditionGroup = {
  key: string;
  modelKey: string;
  edition: string;
  title: string;
  offers: Offer[];
  grips: string[];
  bestOffer: Offer;
};

type StringGroup = {
  key: string;
  title: string;
  brand: string;
  type: StringType;
  format: StringFormat;
  gauges: string[];
  offers: StringOffer[];
  bestOffer: StringOffer;
};

type AccessoryGroup = {
  key: string;
  title: string;
  brand: string;
  category: AccessoryCategory;
  detail: string;
  offers: AccessoryOffer[];
  bestOffer: AccessoryOffer;
};

type BallGroup = {
  key: string;
  title: string;
  brand: string;
  type: BallType;
  package: string;
  offers: BallOffer[];
  bestOffer: BallOffer;
};

const accents: Record<string, string> = {
  "blade-v10": "mint",
  "blade-v9": "forest",
  "blade-v8": "mint",
  "ezone-98": "blue",
  "pure-aero-98": "yellow",
  "pure-strike-98": "orange",
  "pure-strike-100": "orange",
  "pure-strike-100-16x20": "orange",
  "percept-97": "blue",
  "speed-mp": "blue",
};

const brandList: Array<Exclude<BrandKey, "all">> = ["Wilson", "Yonex", "Babolat", "Head", "Tecnifibre", "Dunlop", "Prince", "Volkl"];
const brandViews: BrandViewKey[] = ["all", ...brandList, "catalogue", "special", "strings", "balls", "accessories", "guide", "string-guide"];
const alphabeticalBrandList = [...brandList].sort((a, b) => a.localeCompare(b, "en-CA", { sensitivity: "base" }));
const maxCompareFrames = 6;
const cataloguePageSize = 24;
const stringPageSize = 6;
const stringTypeOrder: StringType[] = ["Polyester", "Multifilament", "Synthetic gut", "Natural gut", "Hybrid", "Monofilament", "Other"];
const stringGaugeOrder = ["15", "15L", "16", "16L", "17", "17L", "18", "18L", "19", "20", "22", "Not listed"];
const stringFormatOrder: StringFormat[] = ["Set", "Half set", "Reel", "Single package"];
const accessoryPageSize = 6;
const accessoryCategoryOrder: AccessoryCategory[] = ["Replacement grips", "Overgrips", "Grommets & bumpers", "Dampeners", "Racquet bags", "Customization", "Racquet care"];
const accessoryCategoryMarks: Record<AccessoryCategory, string> = {
  "Replacement grips": "RG",
  Overgrips: "OG",
  "Grommets & bumpers": "GB",
  Dampeners: "DV",
  "Racquet bags": "RB",
  Customization: "CT",
  "Racquet care": "RC",
};
const ballPageSize = 8;
const ballTypeOrder: BallType[] = ["Extra duty", "Regular duty", "All court", "Clay court", "Pressureless", "Junior", "Other"];
const gripOptions: Array<{ key: GripSize; inches: string }> = [
  { key: "L0", inches: "4 in" },
  { key: "L1", inches: "4 1/8 in" }, { key: "L2", inches: "4 1/4 in" },
  { key: "L3", inches: "4 3/8 in" }, { key: "L4", inches: "4 1/2 in" },
  { key: "L5", inches: "4 5/8 in" },
];

function gripLabel(grip: GripSize = "L3") {
  const option = gripOptions.find((candidate) => candidate.key === grip) ?? gripOptions[3];
  return `${option.key} / ${option.inches}`;
}

function canonicalStringBrand(value: string, title = "") {
  const raw = value.trim();
  const knownBrands = new Map<string, string>([
    ["ashaway", "Ashaway"], ["babolat", "Babolat"], ["diadem", "Diadem"],
    ["dunlop", "Dunlop"], ["forten", "Forten"], ["gamma", "Gamma"],
    ["gosen", "Gosen"], ["grapplesnake", "Grapplesnake"], ["head", "Head"],
    ["kirschbaum", "Kirschbaum"], ["klip", "Klip"], ["luxilon", "Luxilon"],
    ["prince", "Prince"], ["restring", "ReString"], ["solinco", "Solinco"],
    ["tecnifibre", "Tecnifibre"], ["toroline", "Toroline"], ["tourna", "Tourna"],
    ["volkl", "Volkl"], ["völkl", "Volkl"], ["weiss cannon", "Weiss Cannon"],
    ["wilson", "Wilson"], ["yonex", "Yonex"],
  ]);
  const normalizedTitle = title.trim().toLocaleLowerCase("en-CA");
  for (const [key, brand] of knownBrands) {
    if (normalizedTitle === key || normalizedTitle.startsWith(`${key} `)) return brand;
  }
  const aliases = new Map<string, string>([
    ["babolat canada", "Babolat"], ["toroline string", "Toroline"],
  ]);
  const normalizedRaw = raw.toLocaleLowerCase("en-CA");
  return knownBrands.get(normalizedRaw) ?? aliases.get(normalizedRaw) ?? (raw || "Unknown");
}

function stringFamilyKey(offer: StringOffer) {
  const brand = canonicalStringBrand(offer.brand, offer.title);
  const normalized = offer.title.toLowerCase()
    .replace(new RegExp(`^${offer.brand.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`), "")
    .replace(/\b(?:tennis strings?|strings?)\b/g, " ")
    .replace(/\b(?:15l|16l|17l|18l|15|16|17|18|19|20|22)\s*(?:g|ga|gauge)?\b/g, " ")
    .replace(/\b1[.,](?:05|10|15|18|20|22|23|24|25|27|28|29|30|32|35|38|40)\s*mm?\b/g, " ")
    .replace(/\b(?:105|110|115|118|120|122|123|124|125|127|128|129|130|132|135|138|140)\b/g, " ")
    .replace(/\b(?:black|white|natural|blue|red|yellow|green|orange|pink|purple|silver|gold|grey|gray|anthracite|champagne|lime|teal)\b/g, " ")
    .replace(/\b(?:set|reel|pack|12m|12[.]2m|200m|220m|330m|40ft|656ft|660ft)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return `${brand.toLowerCase()}:${normalized || offer.title.toLowerCase()}:${offer.format}:${offer.type}`;
}

function accessoryFamilyKey(offer: AccessoryOffer) {
  const escapedBrand = offer.brand.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const normalized = offer.title.toLowerCase()
    .replace(new RegExp(`^${escapedBrand}\\s*`), "")
    .replace(/\b(?:tennis|racquet|racket|accessory|accessories)\b/g, " ")
    .replace(/\b(?:black|white|blue|red|green|yellow|pink|purple|grey|gray|orange|navy|silver|gold)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return `${offer.category}:${offer.brand.toLowerCase()}:${normalized || offer.title.toLowerCase()}:${offer.detail}`;
}

function ballFamilyKey(offer: BallOffer) {
  const escapedBrand = offer.brand.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const normalized = offer.title.toLowerCase()
    .replace(new RegExp(`^${escapedBrand}\\s*`), "")
    .replace(/\b(?:tennis|balls?)\b/g, " ")
    .replace(/\b(?:case|carton|box|can|cans|pack|package|bucket|bag)\b/g, " ")
    .replace(/\b\d{1,3}\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return `${offer.brand.toLowerCase()}:${normalized || offer.title.toLowerCase()}:${offer.type}:${offer.package}`;
}

function specialEditionName(title: string) {
  const editions: Array<[RegExp, string]> = [
    [/\bconcept edition\b|\bredline\b/i, "Concept Edition"],
    [/\bneon\b/i, "Neon"],
    [/session de soir[eé]e|night session/i, "Night Session"],
    [/roland garros|french open|\bRG\b/i, "Roland Garros"],
    [/wimbledon/i, "Wimbledon"], [/us open/i, "US Open"],
    [/\blegend\b/i, "Legend"], [/\breverse\b/i, "Reverse"],
    [/\bnoir\b|blackout/i, "Noir / Blackout"],
    [/\b(?:30th|100th)\b|anniversary|centennial/i, "Anniversary"],
    [/limited edition|\bLTD\b|special edition/i, "Limited edition"],
    [/rafa origin/i, "Rafa Origin"], [/aqua night/i, "Aqua Night"],
    [/naomi osaka|\bosaka\b/i, "Naomi Osaka"], [/laver cup/i, "Laver Cup"],
    [/stars?\s*(?:&|and)\s*stripes/i, "Stars & Stripes"], [/\bsakura\b/i, "Sakura"],
  ];
  return editions.find(([pattern]) => pattern.test(title))?.[1] ?? null;
}

function specialGripLabels(gripSizes: string[] = []) {
  const labels = new Set<string>();
  for (const value of gripSizes) {
    const normalized = value.toLowerCase().replaceAll("⅜", "3/8").replaceAll("½", "1/2");
    for (const option of gripOptions) {
      const number = option.key.slice(1);
      const measurement = option.inches.replace(" in", "");
      if (new RegExp(`(?:^|[^a-z0-9])(?:l|grip\\s*|size\\s*)${number}(?:$|[^0-9])`).test(normalized)
        || (option.key === "L0"
          ? /(?:^|[^0-9])4(?:[.]0)?\s*(?:in(?:ch(?:es)?)?|\")?(?:$|[^0-9/])/.test(normalized)
          : normalized.includes(measurement))) labels.add(option.key);
    }
  }
  return gripOptions.map((option) => option.key).filter((grip) => labels.has(grip));
}

function specialEditionFamily(title: string) {
  if (/session de soir[eé]e|night session/i.test(title)) return "roland-garros";
  return (specialEditionName(title) ?? "special").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function specialEditionModelKey(offer: Offer) {
  if (offer.modelKey !== "other-sale") return offer.modelKey;
  if (/babolat.*pure drive.*wimbledon/i.test(offer.title)) return "pure-drive-100";
  if (/head.*boom.*(?:mp.*neon|neon.*mp)/i.test(offer.title)) return "boom-mp";
  return offer.title
    .toLowerCase()
    .replace(/\b(?:roland[- ]garros|french open|rg|session de soir[eé]e|night session|wimbledon|us open|legend|reverse|neon|noir|blackout|limited edition|special edition|ltd|naomi osaka|osaka|laver cup|stars? (?:&|and) stripes|sakura)\b/g, " ")
    .replace(/\b(?:tennis|racquet|racket|frame|strung|unstrung)\b/g, " ")
    .replace(/\b20\d{2}\b|\b\d{2,3}\s*g\b/gi, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

function specialEditionGroupLabel(offers: Offer[]) {
  const names = offers.map((offer) => specialEditionName(offer.title)).filter(Boolean);
  if (names.includes("Night Session")) return "Roland Garros Night Session";
  return names[0] ?? "Special edition";
}

function preferredSpecialTitle(offers: Offer[]) {
  const generic = /\b(?:tennis racquet|tennis racket|racquet|racket|unstrung|strung)\b/i;
  return [...offers].sort((a, b) => {
    const aPenalty = generic.test(a.title) ? 1 : 0;
    const bPenalty = generic.test(b.title) ? 1 : 0;
    return aPenalty - bPenalty || a.title.length - b.title.length || a.title.localeCompare(b.title);
  })[0]?.title ?? "Special-edition racquet";
}

function specialOfferBrand(group: SpecialEditionGroup): string {
  const known = modelBrand(group.modelKey);
  if (known) return known;
  return brandList.find((brand) => group.title.toLowerCase().includes(brand.toLowerCase())) ?? "Special release";
}

const featuredByBrand: Record<Exclude<BrandKey, "all">, string[]> = {
  Wilson: ["blade-v10", "defyer-98-pro-v1", "clash-100", "clash-100-pro", "ultra-100-v5", "pro-staff-97-classic"],
  Yonex: ["ezone-98", "ezone-100", "vcore-98", "vcore-100", "percept-97", "percept-100"],
  Babolat: ["pure-aero-98", "pure-aero-100", "pure-drive-98", "pure-drive-100", "pure-strike-98", "pure-strike-100"],
  Head: ["speed-pro-2026", "speed-mp", "gravity-pro-2025", "gravity-mp-2025", "radical-pro-2025", "radical-mp-2025"],
  Tecnifibre: ["tf40-290", "tf40-305", "tfight-300s", "tfight-305s", "fire-305s", "tfx1-300"],
  Dunlop: ["dunlop-cx-200", "dunlop-cx-200-tour-16x19", "dunlop-cx-200-tour-18x20", "dunlop-cx-400", "dunlop-cx-400-tour", "dunlop-fx-500-lite-2026"],
  Prince: ["prince-vortex-100-310", "prince-vortex-100-300", "prince-tour-100p-305", "prince-o3-ripstick-100-280", "prince-legacy-110", "prince-warrior-100-265"],
  Volkl: ["volkl-c10-evo", "volkl-v1-evo", "volkl-v1-classic", "volkl-vcell-v1-mp", "volkl-vcell-10-320", "volkl-vcell-10-300"],
};

function modelBrand(modelKey: string): Exclude<BrandKey, "all"> | null {
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

const manufacturerPublishedSpecs: Record<string, RacquetSpec> = {
  "defyer-100-v1": { swingweight: "295 kg·cm² · unstrung", productCode: "WR215411", source: "Wilson official", sourceUrl: "https://ph.wilson.com/products/wilson-defyer-100-v1-tennis-racket" },
  "pure-aero-98": { swingweight: "295 kg·cm² · unstrung", source: "Babolat official", sourceUrl: "https://www.babolat.com/us/pure-aero-98-gen9-unstrung/101568.html" },
  "pure-aero-100": { swingweight: "290 kg·cm² · unstrung", source: "Babolat official", sourceUrl: "https://www.babolat.com/us/pure-aero-gen9-unstrung/101569.html" },
  "pure-aero-team-2026": { swingweight: "280 kg·cm² · unstrung", source: "Babolat official", sourceUrl: "https://www.babolat.com/us/tennis/racquets.html" },
  "pure-aero-lite-2026": { swingweight: "275 kg·cm² · unstrung", source: "Babolat official", sourceUrl: "https://www.babolat.com/us/tennis/racquets.html" },
  "pure-aero-plus": { swingweight: "290 kg·cm² · unstrung", source: "Babolat official", sourceUrl: "https://www.babolat.com/us/tennis/racquets.html" },
  "dunlop-cx-200-tour-16x19": { head: "95 in²", weight: "310 g", balance: "31.0 cm", swingweight: "290 kg·cm² · unstrung", stiffness: "65 RA", pattern: "16 × 19", beam: "20.5 mm", source: "Dunlop official", sourceUrl: "https://dunlopsports.com/en-gb/tennis/rackets/cx200-tour-16x19/2" },
  "prince-vortex-100-310": { head: "100 in²", weight: "310 g", swingweight: "285 kg·cm² · unstrung", pattern: "16 × 19", source: "Prince official", sourceUrl: "https://princetennis-hk.com/en/products/7t53s101ul2" },
};

const racquetSpecs: Record<string, RacquetSpec> = {
  "defyer-98-pro-v1": { head: "98 in²", weight: "305 g", balance: "31.5 cm", pattern: "16 × 20", beam: "Dual taper", length: "27 in", profile: "Spin / precision" },
  "defyer-100-v1": { head: "100 in²", weight: "300 g", balance: "31.5 cm", pattern: "16 × 19", beam: "Variable", length: "27 in", profile: "Spin / power" },
  "defyer-100l-v1": { head: "100 in²", weight: "285 g", balance: "32.0 cm", pattern: "16 × 19", beam: "Dual taper", length: "27 in", profile: "Maneuverable spin" },
  "defyer-100ul-v1": { head: "100 in²", weight: "265 g", balance: "33.0 cm", pattern: "16 × 19", beam: "Dual taper", length: "27 in", profile: "Light spin / power" },
  "blade-pro-98-v10": { head: "98 in²", weight: "305 g", balance: "32.5 cm", pattern: "16 × 19", beam: "21.5 mm", length: "27 in", profile: "Tour control / feel" },
  "blade-pro-98-18x20-v10": { head: "98 in²", weight: "305 g", balance: "32.5 cm", pattern: "18 × 20", beam: "21.5 mm", length: "27 in", profile: "Dense tour control" },
  "blade-pro-100-v10": { head: "100 in²", weight: "295 g", balance: "32.5 cm", pattern: "16 × 20", beam: "22 mm", length: "27.25 in", profile: "Control / reach" },
  "blade-v10": { head: "98 in²", weight: "305 g", balance: "32.0 cm", pattern: "16 × 19", beam: "21 mm", length: "27 in", profile: "Control / feel" },
  "blade-98-18x20-v10": { head: "98 in²", weight: "305 g", balance: "32.0 cm", pattern: "18 × 20", beam: "21 mm", length: "27 in", profile: "Dense control / feel" },
  "blade-v9": { head: "98 in²", weight: "305 g", balance: "32.0 cm", pattern: "16 × 19", beam: "21 mm", length: "27 in", profile: "Control / feel" },
  "blade-98-18x20-v9": { head: "98 in²", weight: "305 g", balance: "32.0 cm", pattern: "18 × 20", beam: "21 mm", length: "27 in", profile: "Dense control / feel" },
  "blade-v8": { head: "98 in²", weight: "305 g", balance: "32.0 cm", pattern: "16 × 19", beam: "21 mm", length: "27 in", profile: "Control / feel" },
  "blade-98-18x20-v8": { head: "98 in²", weight: "305 g", balance: "32.0 cm", pattern: "18 × 20", beam: "21 mm", length: "27 in", profile: "Dense control / feel" },
  "blade-v7": { head: "98 in²", weight: "305 g", balance: "32.0 cm", pattern: "16 × 19", beam: "21 mm", length: "27 in", profile: "Classic flex / control" },
  "blade-100-v10": { head: "100 in²", weight: "300 g", balance: "32.0 cm", pattern: "16 × 19", beam: "22 mm", length: "27 in", profile: "Control / forgiveness" },
  "blade-100-v9": { head: "100 in²", weight: "300 g", balance: "32.0 cm", pattern: "16 × 19", beam: "22 mm", length: "27 in", profile: "Control / forgiveness" },
  "blade-100l-v10": { head: "100 in²", weight: "285 g", balance: "33.0 cm", pattern: "16 × 19", beam: "22 mm", length: "27 in", profile: "Maneuverable control" },
  "blade-100ul-v10": { head: "100 in²", weight: "265 g", balance: "33.0 cm", pattern: "16 × 19", beam: "22 mm", length: "27 in", profile: "Light control / power" },
  "blade-104-v10": { head: "104 in²", weight: "290 g", balance: "32.5 cm", pattern: "16 × 19", beam: "22 mm", length: "27.5 in", profile: "Control / forgiveness" },
  "clash-100": { head: "100 in²", weight: "293 g", balance: "31.0 cm", pattern: "16 × 19", beam: "24 mm", length: "27 in", profile: "Comfort / spin" },
  "clash-100-pro": { head: "100 in²", weight: "305 g", balance: "31.0 cm", pattern: "16 × 20", beam: "24 mm", length: "27 in", profile: "Comfort / control" },
  "clash-100l-v3": { head: "100 in²", weight: "280 g", balance: "31.5 cm", pattern: "16 × 19", beam: "24 mm", length: "27 in", profile: "Maneuverable comfort" },
  "clash-100ul-v3": { head: "100 in²", weight: "265 g", balance: "33.0 cm", pattern: "16 × 19", beam: "24 mm", length: "27 in", profile: "Light comfort / power" },
  "clash-108-v3": { head: "108 in²", weight: "280 g", balance: "33.5 cm", pattern: "16 × 19", beam: "24 mm", length: "27.25 in", profile: "Comfort / forgiveness" },
  "clash-100-pro-v2": { head: "100 in²", weight: "310 g", balance: "30.6 cm", pattern: "16 × 20", beam: "24 mm", length: "27 in", profile: "Comfort / control" },
  "clash-100-v2": { head: "100 in²", weight: "295 g", balance: "31.0 cm", pattern: "16 × 19", beam: "24 mm", length: "27 in", profile: "Comfort / spin" },
  "clash-100l-v2": { head: "100 in²", weight: "280 g", balance: "31.5 cm", pattern: "16 × 19", beam: "24 mm", length: "27 in", profile: "Maneuverable comfort" },
  "clash-98-v2": { head: "98 in²", weight: "310 g", balance: "31.5 cm", pattern: "16 × 20", beam: "24 mm", length: "27 in", profile: "Comfort / control" },
  "clash-100ul-v2": { head: "100 in²", weight: "265 g", balance: "33.0 cm", pattern: "16 × 19", beam: "24 mm", length: "27 in", profile: "Light comfort / power" },
  "clash-108-v2": { head: "108 in²", weight: "280 g", balance: "33.5 cm", pattern: "16 × 19", beam: "24 mm", length: "27.25 in", profile: "Comfort / forgiveness" },
  "clash-100-tour-v1": { head: "100 in²", weight: "310 g", balance: "30.6 cm", pattern: "16 × 19", beam: "24.5 mm", length: "27 in", profile: "Stable comfort / control" },
  "clash-100-v1": { head: "100 in²", weight: "295 g", balance: "31.0 cm", pattern: "16 × 19", beam: "24.5 mm", length: "27 in", profile: "Comfort / spin" },
  "clash-98-v1": { head: "98 in²", weight: "310 g", balance: "30.6 cm", pattern: "16 × 19", beam: "24 mm", length: "27 in", profile: "Comfort / precision" },
  "clash-100l-v1": { head: "100 in²", weight: "280 g", balance: "31.5 cm", pattern: "16 × 19", beam: "24.5 mm", length: "27 in", profile: "Maneuverable comfort" },
  "clash-100ul-v1": { head: "100 in²", weight: "265 g", balance: "33.0 cm", pattern: "16 × 19", beam: "24.5 mm", length: "27 in", profile: "Light comfort / power" },
  "clash-108-v1": { head: "108 in²", weight: "280 g", balance: "33.5 cm", pattern: "16 × 19", beam: "24.5 mm", length: "27.25 in", profile: "Comfort / forgiveness" },
  "ultra-100l-v5": { head: "100 in²", weight: "280 g", balance: "32.0 cm", pattern: "16 × 19", beam: "24–26.5 mm", length: "27 in", profile: "Maneuverable power" },
  "ultra-100ul-v5": { head: "100 in²", weight: "260 g", balance: "33.0 cm", pattern: "16 × 19", beam: "24–26.5 mm", length: "27 in", profile: "Light easy power" },
  "ultra-111-v5": { head: "111 in²", weight: "270 g", balance: "33.5 cm", pattern: "16 × 19", beam: "25–27 mm", length: "27.25 in", profile: "Oversize power / forgiveness" },
  "pro-staff-97": { head: "97 in²", weight: "315 g", balance: "31.0 cm", pattern: "16 × 19", beam: "21.5 mm", length: "27 in", profile: "Precision / stability" },
  "pro-staff-97-classic": { head: "97 in²", weight: "315 g", balance: "31.0 cm", pattern: "16 × 19", beam: "21.5 mm", length: "27 in", profile: "Classic feel / precision" },
  "pro-staff-97l-classic": { head: "97 in²", weight: "290 g", balance: "32.5 cm", pattern: "16 × 19", beam: "23 mm", length: "27 in", profile: "Maneuverable precision" },
  "pro-staff-team-classic": { head: "100 in²", weight: "280 g", balance: "33.0 cm", pattern: "16 × 19", beam: "23 mm", length: "27 in", profile: "Accessible classic control" },
  "pro-staff-rf97-v13": { head: "97 in²", weight: "340 g", balance: "30.5 cm", pattern: "16 × 19", beam: "21.5 mm", length: "27 in", profile: "Classic mass / precision" },
  "rf-01-pro": { head: "98 in²", weight: "320 g", balance: "31.5 cm", pattern: "16 × 19", beam: "23.2 mm", length: "27 in", profile: "Attack / precision" },
  "ezone-98": { head: "98 in²", weight: "305 g", balance: "31.5 cm", pattern: "16 × 19", beam: "23.5–19.5 mm", length: "27 in", profile: "Power / control" },
  "ezone-98l": { head: "98 in²", weight: "285 g", balance: "32.5 cm", pattern: "16 × 19", beam: "23.5–19.5 mm", length: "27 in", profile: "Maneuverable power" },
  "ezone-98-tour": { head: "98 in²", weight: "315 g", balance: "32.0 cm", pattern: "16 × 19", beam: "23.5–19.5 mm", length: "27 in", profile: "Stable power / control" },
  "ezone-98-plus": { head: "98 in²", weight: "305 g", balance: "32.5 cm", pattern: "16 × 19", beam: "23.5–19.5 mm", length: "27.5 in", profile: "Power / reach" },
  "ezone-98-2022": { head: "98 in²", weight: "305 g", balance: "31.5 cm", pattern: "16 × 19", beam: "23.5–19.5 mm", length: "27 in", profile: "Power / control" },
  "ezone-100": { head: "100 in²", weight: "300 g", balance: "32.0 cm", pattern: "16 × 19", beam: "24.5–23.8 mm", length: "27 in", profile: "Easy power" },
  "ezone-100l": { head: "100 in²", weight: "285 g", balance: "32.5 cm", pattern: "16 × 19", beam: "24.5–23.8 mm", length: "27 in", profile: "Maneuverable power" },
  "ezone-100sl": { head: "100 in²", weight: "270 g", balance: "33.0 cm", pattern: "16 × 19", beam: "24.5–23.8 mm", length: "27 in", profile: "Light power / comfort" },
  "ezone-alpha": { head: "100 in²", weight: "275 g", balance: "33.0 cm", pattern: "16 × 18", beam: "25.5–27.5–24 mm", length: "27 in", profile: "Recreational easy power" },
  "ezone-100-plus": { head: "100 in²", weight: "300 g", balance: "33.0 cm", pattern: "16 × 19", beam: "24.5–23.8 mm", length: "27.5 in", profile: "Power / reach" },
  "vcore-98": { head: "98 in²", weight: "305 g", balance: "31.5 cm", pattern: "16 × 19", beam: "23–21 mm", length: "27 in", profile: "Spin / control" },
  "vcore-98l": { head: "98 in²", weight: "285 g", balance: "32.5 cm", pattern: "16 × 19", beam: "23–21 mm", length: "27 in", profile: "Maneuverable spin" },
  "vcore-98-plus": { head: "98 in²", weight: "305 g", balance: "32.5 cm", pattern: "16 × 19", beam: "23–21 mm", length: "27.5 in", profile: "Spin / reach" },
  "vcore-98-tour": { head: "98 in²", weight: "315 g", balance: "32.0 cm", pattern: "16 × 19", beam: "23–23.5–22 mm", length: "27 in", profile: "Stable spin / control", source: "Yonex", sourceUrl: "https://www.yonex.com/tennis/racquets/vcore/08vc98tr" },
  "vcore-98-2023": { head: "98 in²", weight: "305 g", balance: "31.5 cm", pattern: "16 × 19", beam: "23–21 mm", length: "27 in", profile: "Spin / control" },
  "vcore-100": { head: "100 in²", weight: "300 g", balance: "32.0 cm", pattern: "16 × 19", beam: "25.3–22 mm", length: "27 in", profile: "Spin / power" },
  "vcore-100l": { head: "100 in²", weight: "280 g", balance: "33.0 cm", pattern: "16 × 19", beam: "25.3–22 mm", length: "27 in", profile: "Light spin / power" },
  "vcore-100-plus": { head: "100 in²", weight: "300 g", balance: "33.0 cm", pattern: "16 × 19", beam: "25.3–22 mm", length: "27.5 in", profile: "Spin / reach" },
  "vcore-alpha": { head: "100 in²", weight: "275 g", balance: "33.0 cm", pattern: "16 × 18", beam: "25.5–27.5–24 mm", length: "27 in", profile: "Recreational spin / power" },
  "vcore-ace": { head: "98 in²", weight: "260 g", balance: "34.5 cm", pattern: "16 × 20", beam: "23–23–21 mm", length: "27 in", profile: "Beginner spin / control" },
  "vcore-play": { head: "100 in²", weight: "265 g", balance: "34.5 cm", pattern: "16 × 19", beam: "24.5–26.5–23 mm", length: "27 in", profile: "Recreational spin / power" },
  "percept-97": { head: "97 in²", weight: "310 g", balance: "31.0 cm", pattern: "16 × 19", beam: "21 mm", length: "27 in", profile: "Feel / precision" },
  "percept-97d": { head: "97 in²", weight: "320 g", balance: "31.0 cm", pattern: "18 × 20", beam: "21 mm", length: "27 in", profile: "Dense control / feel" },
  "percept-97h": { head: "97 in²", weight: "330 g", balance: "31.0 cm", pattern: "16 × 19", beam: "21 mm", length: "27 in", profile: "Mass / precision" },
  "vcore-pro-97-2021": { head: "97 in²", weight: "310 g", balance: "31.0 cm", pattern: "16 × 19", beam: "21 mm", length: "27 in", profile: "Classic feel / control" },
  "muse-98": { head: "98 in²", weight: "305 g", pattern: "16 × 18", length: "27 in", profile: "Comfort / control / connection", source: "Yonex", sourceUrl: "https://us.yonex.com/products/muse-98" },
  "muse-100": { head: "100 in²", weight: "300 g", pattern: "16 × 18", length: "27 in", profile: "Comfort / forgiveness", source: "Yonex", sourceUrl: "https://www.yonex.com/tennis/racquets" },
  "muse-100l": { head: "100 in²", weight: "280 g", pattern: "16 × 18", beam: "24.5–24.5–18 mm", length: "27 in", profile: "Light comfort / maneuverability", source: "Yonex", sourceUrl: "https://us.yonex.com/products/muse-100l" },
  "muse-100sl": { head: "100 in²", weight: "265 g", pattern: "16 × 18", length: "27 in", profile: "Super-light comfort", source: "Yonex", sourceUrl: "https://us.yonex.com/products/muse-100-sl" },
  "muse-107": { head: "107 in²", weight: "280 g", pattern: "16 × 18", beam: "25–25–18 mm", length: "27 in", profile: "Maximum forgiveness / comfort", source: "Yonex", sourceUrl: "https://us.yonex.com/products/muse-107" },
  "pure-aero-98": { head: "98 in²", weight: "305 g", balance: "31.5 cm", pattern: "16 × 20", beam: "21–23 mm", length: "27 in", profile: "Spin / control" },
  "pure-aero-100": { head: "100 in²", weight: "300 g", balance: "32.0 cm", pattern: "16 × 19", beam: "23–26 mm", length: "27 in", profile: "Spin / power" },
  "pure-aero-team-2026": { head: "100 in²", weight: "285 g", balance: "32.0 cm", pattern: "16 × 19", beam: "23–26 mm", length: "27 in", profile: "Maneuverable spin" },
  "pure-aero-lite-2026": { head: "100 in²", weight: "270 g", balance: "33.0 cm", pattern: "16 × 19", beam: "23–26 mm", length: "27 in", profile: "Light spin / power" },
  "pure-aero-super-lite-2026": { head: "100 in²", weight: "255 g", balance: "33.0 cm", pattern: "16 × 19", beam: "23–26–23 mm", length: "27 in", stiffness: "70 RA ±3", profile: "Super-light spin / progression", source: "Babolat", sourceUrl: "https://www.babolat.com/us/pure-aero-s-lite-gen9-unstrung/100-101573.html" },
  "pure-aero-2023": { head: "100 in²", weight: "300 g", balance: "32.0 cm", pattern: "16 × 19", beam: "23–26 mm", length: "27 in", profile: "Spin / power" },
  "pure-aero-rafa-2023": { head: "100 in²", weight: "290 g", balance: "33.0 cm", pattern: "16 × 19", beam: "23–26 mm", length: "27 in", profile: "Explosive spin" },
  "pure-aero-vs": { head: "98 in²", weight: "305 g", balance: "31.5 cm", pattern: "16 × 20", beam: "21–23 mm", length: "27 in", profile: "Spin / precision" },
  "aeropro-drive": { head: "100 in²", weight: "300 g", balance: "32.0 cm", pattern: "16 × 19", beam: "23–26 mm", length: "27 in", profile: "Classic spin / power" },
  "pure-control-tour": { head: "98 in²", weight: "320 g", balance: "31.0 cm", pattern: "16 × 20", beam: "21 mm", length: "27 in", profile: "Classic control / stability" },
  "boost-aero-2026": { head: "102 in²", weight: "260 g", balance: "34.0 cm", pattern: "16 × 19", beam: "23–26–23 mm", length: "27 in", profile: "Beginner spin / easy power" },
  "boost-strike-2026": { head: "102 in²", weight: "285 g", balance: "33.0 cm", pattern: "16 × 19", beam: "23–26–23 mm", length: "27 in", profile: "Accessible power / control" },
  "boost-wimbledon-2026": { head: "105 in²", weight: "260 g", balance: "34.5 cm", pattern: "16 × 19", beam: "23–26–23 mm", length: "27 in", profile: "Forgiving power / special edition" },
  "evo-aero-gen2": { head: "102 in²", weight: "275 g", balance: "32.0 cm", pattern: "16 × 19", beam: "23–26–23 mm", length: "27 in", profile: "Comfort / controlled spin" },
  "evo-drive-gen2": { head: "102 in²", weight: "270 g", balance: "32.5 cm", pattern: "16 × 19", beam: "23–26–23 mm", length: "27 in", profile: "Comfort / controlled power" },
  "pure-drive-98": { head: "98 in²", weight: "305 g", balance: "32.5 cm", pattern: "16 × 19", beam: "21–23 mm", length: "27 in", profile: "Power / precision" },
  "pure-drive-100": { head: "100 in²", weight: "300 g", balance: "32.0 cm", pattern: "16 × 19", beam: "23–26 mm", length: "27 in", profile: "Power / depth" },
  "pure-drive-team-2025": { head: "100 in²", weight: "285 g", balance: "32.5 cm", pattern: "16 × 19", beam: "23–26 mm", length: "27 in", profile: "Maneuverable power" },
  "pure-drive-lite-2025": { head: "100 in²", weight: "270 g", balance: "33.0 cm", pattern: "16 × 19", beam: "23–26 mm", length: "27 in", profile: "Light power / comfort" },
  "pure-drive-107-2025": { head: "107 in²", weight: "285 g", balance: "32.0 cm", pattern: "16 × 19", beam: "23–26 mm", length: "27.2 in", profile: "Oversize power / forgiveness" },
  "pure-drive-2021": { head: "100 in²", weight: "300 g", balance: "32.0 cm", pattern: "16 × 19", beam: "23–26 mm", length: "27 in", profile: "Power / depth" },
  "pure-strike-97": { head: "97 in²", weight: "310 g", balance: "31.0 cm", pattern: "16 × 20", beam: "21–22–21 mm", length: "27 in", profile: "Precision / feel" },
  "pure-strike-98": { head: "98 in²", weight: "305 g", balance: "32.0 cm", pattern: "16 × 19", beam: "21–23 mm", length: "27 in", profile: "Control / attack" },
  "pure-strike-98-18x20": { head: "98 in²", weight: "305 g", balance: "32.0 cm", pattern: "18 × 20", beam: "21–23 mm", length: "27 in", profile: "Dense control / attack" },
  "pure-strike-100": { head: "100 in²", weight: "300 g", balance: "32.0 cm", pattern: "16 × 19", beam: "21–23 mm", length: "27 in", profile: "Control / versatility" },
  "pure-strike-100-16x20": { head: "100 in²", weight: "305 g", balance: "31.0 cm", pattern: "16 × 20", beam: "21–23–21 mm", length: "27 in", profile: "Dense control / stability" },
  "speed-mp": { head: "100 in²", weight: "300 g", balance: "32.0 cm", pattern: "16 × 19", beam: "23 mm", length: "27 in", profile: "Speed / versatility" },
  "speed-mp-l-2026": { head: "100 in²", weight: "280 g", balance: "32.5 cm", pattern: "16 × 19", beam: "23 mm", length: "27 in", profile: "Maneuverable speed" },
  "speed-mp-ul-2026": { head: "100 in²", weight: "265 g", balance: "33.0 cm", pattern: "16 × 19", beam: "23 mm", length: "27 in", profile: "Light speed / power" },
  "speed-team-2026": { head: "105 in²", weight: "270 g", balance: "32.5 cm", pattern: "16 × 19", beam: "24 mm", length: "27 in", profile: "Forgiving speed / power" },
  "speed-elite-2026": { head: "100 in²", weight: "265 g", balance: "33.0 cm", pattern: "16 × 19", beam: "23 mm", length: "27 in", profile: "Accessible speed / power" },
  "speed-tour": { head: "98 in²", weight: "305 g", balance: "31.5 cm", pattern: "16 × 19", beam: "23 mm", length: "27 in", profile: "Speed / precision" },
  "speed-mp-2024": { head: "100 in²", weight: "300 g", balance: "32.0 cm", pattern: "16 × 19", beam: "23 mm", length: "27 in", profile: "Speed / versatility" },
  "speed-pro-2024": { head: "100 in²", weight: "310 g", balance: "31.0 cm", pattern: "18 × 20", beam: "23 mm", length: "27 in", profile: "Control / stability" },
  "speed-pro-2026": { head: "100 in²", weight: "310 g", balance: "31.5 cm", pattern: "18 × 20", beam: "23 mm", length: "27 in", profile: "Control / stability" },
  "gravity-mp-2025": { head: "100 in²", weight: "295 g", balance: "32.5 cm", pattern: "16 × 20", beam: "22 mm", length: "27 in", profile: "Feel / forgiveness" },
  "gravity-mp-l-2025": { head: "100 in²", weight: "280 g", balance: "32.5 cm", pattern: "16 × 20", beam: "22 mm", length: "27 in", profile: "Maneuverable feel" },
  "gravity-team-2025": { head: "104 in²", weight: "270 g", balance: "32.5 cm", pattern: "16 × 20", beam: "24 mm", length: "27 in", profile: "Forgiving feel / power" },
  "gravity-tour-2025": { head: "98 in²", weight: "305 g", balance: "32.0 cm", pattern: "16 × 19", beam: "22 mm", length: "27 in", profile: "Control / feel" },
  "gravity-pro-2023": { head: "100 in²", weight: "315 g", balance: "31.5 cm", pattern: "18 × 20", beam: "20 mm", length: "27 in", profile: "Feel / stability" },
  "gravity-mp-2023": { head: "100 in²", weight: "295 g", balance: "32.5 cm", pattern: "16 × 20", beam: "22 mm", length: "27 in", profile: "Feel / forgiveness" },
  "radical-mp-2025": { head: "98 in²", weight: "300 g", balance: "32.0 cm", pattern: "16 × 19", beam: "20–23 mm", length: "27 in", profile: "All-court control" },
  "radical-team-2025": { head: "102 in²", weight: "280 g", balance: "32.0 cm", pattern: "16 × 19", beam: "22–25–23 mm", length: "27 in", profile: "Maneuverable all-court power" },
  "radical-elite-2025": { head: "102 in²", weight: "270 g", balance: "33.0 cm", pattern: "16 × 19", beam: "22–25–23 mm", length: "27 in", profile: "Accessible all-court power" },
  "radical-mp-2023": { head: "98 in²", weight: "300 g", balance: "32.0 cm", pattern: "16 × 19", beam: "20–23 mm", length: "27 in", profile: "All-court control" },
  "radical-pro-2023": { head: "98 in²", weight: "315 g", balance: "31.5 cm", pattern: "16 × 19", beam: "20–23 mm", length: "27 in", profile: "Stable all-court control" },
  "extreme-tour-2022": { head: "98 in²", weight: "305 g", balance: "31.5 cm", pattern: "16 × 19", beam: "22–23 mm", length: "27 in", profile: "Spin / control" },
  "extreme-pro-2026": { head: "98 in²", weight: "305 g", balance: "31.5 cm", pattern: "16 × 19", beam: "22–23 mm", length: "27 in", profile: "Spin / precision" },
  "extreme-mp-2026": { head: "100 in²", weight: "300 g", balance: "32.0 cm", pattern: "16 × 19", beam: "23–26 mm", length: "27 in", profile: "Spin / power" },
  "extreme-mp-xl-2026": { head: "100 in²", weight: "300 g", balance: "32.5 cm", pattern: "16 × 19", beam: "23–26 mm", length: "27.5 in", profile: "Spin / reach" },
  "extreme-mp-l-2026": { head: "100 in²", weight: "280 g", balance: "32.5 cm", pattern: "16 × 19", beam: "23–26 mm", length: "27 in", profile: "Maneuverable spin" },
  "extreme-mp-ul-2026": { head: "100 in²", weight: "260 g", balance: "33.0 cm", pattern: "16 × 19", beam: "23–26 mm", length: "27 in", profile: "Light spin / power" },
  "extreme-team-2026": { head: "105 in²", weight: "265 g", balance: "33.5 cm", pattern: "16 × 19", beam: "23–26 mm", length: "27 in", profile: "Forgiving spin / power" },
  "extreme-elite-2026": { head: "100 in²", weight: "260 g", balance: "33.0 cm", pattern: "16 × 19", beam: "23–26 mm", length: "27 in", profile: "Accessible spin / power" },
  "boom-pro": { head: "98 in²", weight: "310 g", balance: "31.0 cm", pattern: "16 × 19", beam: "22 mm", length: "27 in", profile: "Power / control" },
  "boom-mp": { head: "100 in²", weight: "295 g", balance: "31.5 cm", pattern: "16 × 19", beam: "24 mm", length: "27 in", profile: "Easy power" },
  "boom-mp-l-2026": { head: "100 in²", weight: "270 g", balance: "32.5 cm", pattern: "16 × 19", beam: "24 mm", length: "27 in", profile: "Maneuverable power" },
  "boom-mp-ul-2026": { head: "100 in²", weight: "260 g", balance: "33.0 cm", pattern: "16 × 19", beam: "24 mm", length: "27 in", profile: "Light power / comfort" },
  "boom-team-2026": { head: "102 in²", weight: "275 g", balance: "33.0 cm", pattern: "16 × 19", beam: "25 mm", length: "27 in", profile: "Forgiving power / touch" },
  "boom-elite-2026": { head: "107 in²", weight: "270 g", balance: "34.0 cm", pattern: "16 × 19", beam: "23–26–23 mm", length: "27 in", profile: "Forgiving power / value" },
  "boom-pro-2022": { head: "98 in²", weight: "310 g", balance: "31.0 cm", pattern: "16 × 19", beam: "22 mm", length: "27 in", profile: "Power / control" },
  "boom-mp-2022": { head: "100 in²", weight: "295 g", balance: "31.5 cm", pattern: "16 × 19", beam: "24 mm", length: "27 in", profile: "Easy power" },
  "instinct-pwr-110-2025": { head: "110 in²", weight: "255 g", balance: "34.5 cm", pattern: "16 × 19", beam: "26–28 mm", length: "27.4 in", profile: "Oversize easy power" },
  "instinct-pwr-115-2025": { head: "115 in²", weight: "230 g", balance: "37.5 cm", pattern: "16 × 19", beam: "29 mm", length: "27.7 in", profile: "Maximum power / forgiveness" },
  "instinct-team-l-2025": { head: "107 in²", weight: "270 g", balance: "34.0 cm", pattern: "16 × 19", beam: "23–26–23 mm", length: "27 in", profile: "Forgiving power / comfort" },
  "ig-speed-xceed-2026": { head: "100 in²", weight: "270 g", balance: "33.5 cm", pattern: "16 × 19", beam: "24–26–21 mm", length: "27 in", profile: "Recreational all-round comfort" },
  "ig-boom-xceed-2026": { head: "107 in²", weight: "260 g", balance: "35.5 cm", pattern: "16 × 19", beam: "23–26–23 mm", length: "27 in", profile: "Recreational easy power" },
  "ig-gravity-xceed-2026": { head: "100 in²", weight: "295 g", balance: "32.0 cm", pattern: "16 × 19", beam: "23–26–23 mm", length: "27 in", profile: "Recreational balanced control" },
  "ig-radical-xceed-2026": { head: "100 in²", weight: "270 g", balance: "33.5 cm", pattern: "16 × 19", beam: "24–26–21 mm", length: "27 in", profile: "Recreational all-court power" },
  "prestige-mp-2023": { head: "99 in²", weight: "310 g", balance: "32.0 cm", pattern: "18 × 19", beam: "21.5 mm", length: "27 in", profile: "Classic control / feel" },
  "tf40-290": { head: "98 in²", weight: "290 g", balance: "32.5 cm", pattern: "16 × 19", beam: "21.7 mm", length: "27 in", profile: "Control / maneuverability" },
  "tf40-305": { head: "98 in²", weight: "305 g", balance: "32.5 cm", pattern: "16 × 19", beam: "21.7 mm", length: "27 in", profile: "Control / spin" },
  "tf40-305-18x20": { head: "98 in²", weight: "305 g", balance: "32.5 cm", pattern: "18 × 20", beam: "21.7 mm", length: "27 in", profile: "Dense control / stability" },
  "tf40-315": { head: "98 in²", weight: "315 g", balance: "31.0 cm", pattern: "16 × 19", beam: "21.7 mm", length: "27 in", profile: "Control / stability" },
  "tfight-285": { head: "100 in²", weight: "285 g", balance: "33.0 cm", pattern: "16 × 19", beam: "23.5 mm", length: "27 in", profile: "Maneuverable power" },
  "tfight-300": { head: "100 in²", weight: "300 g", balance: "32.0 cm", pattern: "16 × 19", beam: "23.5 mm", length: "27 in", profile: "Power / control" },
  "tfight-iso-305": { head: "98 in²", weight: "305 g", balance: "32.5 cm", pattern: "18 × 19", beam: "22.5 mm", length: "27 in", profile: "Control / stability" },
  "fire-305s": { head: "98 in²", weight: "305 g", balance: "31.5 cm", pattern: "16 × 19", beam: "23–22.5 mm", length: "27 in", profile: "Power / precision" },
  "fire-300": { head: "100 in²", weight: "300 g", balance: "32.0 cm", pattern: "16 × 19", beam: "24.5–25 mm", length: "27 in", profile: "Power / comfort" },
  "fire-285": { head: "100 in²", weight: "285 g", balance: "32.5 cm", pattern: "16 × 19", beam: "24.5–25 mm", length: "27 in", profile: "Maneuverable power" },
  "fire-270": { head: "100 in²", weight: "270 g", balance: "33.0 cm", pattern: "16 × 19", beam: "24.5–25 mm", length: "27 in", profile: "Light power / comfort" },
  "tfx1-285": { head: "100 in²", weight: "285 g", balance: "33.0 cm", pattern: "16 × 19", beam: "24.5 mm", length: "27 in", profile: "Power / comfort" },
  "tfx1-305": { head: "98 in²", weight: "305 g", balance: "32.5 cm", pattern: "16 × 19", beam: "23.5 mm", length: "27 in", profile: "Power / precision" },
  "tempo-285": { head: "100 in²", weight: "285 g", balance: "33.0 cm", pattern: "16 × 19", beam: "24 mm", length: "27 in", profile: "Maneuverable power" },
  "squared-2026": { head: "100 in²", weight: "295 g", balance: "29.5 cm", pattern: "16 × 18", beam: "23–25–24 mm", length: "27 in", profile: "Comfort / maneuverability / power" },
};

const publishedStiffness: Record<string, string> = {
  "blade-v9": "62 RA", "blade-98-18x20-v9": "62 RA", "blade-v8": "61 RA", "blade-98-18x20-v8": "61 RA", "blade-v7": "62 RA",
  "clash-100": "54 RA", "clash-100-v2": "57 RA", "clash-98-v2": "60 RA",
  "pro-staff-97": "66 RA", "pro-staff-x": "66 RA", "pro-staff-rf97-v13": "68 RA", "rf-01-pro": "67 RA", "shift-99": "68 RA",
  "ezone-98": "63 RA", "ezone-98-tour": "62 RA", "ezone-98-plus": "63 RA", "ezone-98-2022": "65 RA", "ezone-100": "66 RA", "ezone-100-plus": "66 RA",
  "vcore-95": "61 RA", "vcore-98": "63 RA", "vcore-98-2023": "62 RA", "percept-97": "60 RA", "percept-97d": "62 RA", "percept-97h": "62 RA", "percept-100": "66 RA", "percept-100d": "66 RA", "vcore-pro-97-2021": "60 RA",
  "pure-aero-98": "71 RA ±3", "pure-aero-100": "69 RA ±3", "pure-aero-team-2026": "70 RA ±3", "pure-aero-lite-2026": "70 RA ±3", "pure-aero-plus": "69 RA ±3",
  "pure-drive-98": "73 RA ±3", "pure-drive-100": "72 RA ±3", "pure-drive-team-2025": "72 RA ±3", "pure-drive-lite-2025": "72 RA ±3", "pure-drive-107-2025": "72 RA ±3", "pure-drive-plus": "72 RA ±3",
  "pure-strike-97": "67 RA ±3", "pure-strike-98": "68 RA ±3", "pure-strike-98-18x20": "68 RA ±3", "pure-strike-100": "68 RA ±3", "pure-strike-100-16x20": "65 RA ±3", "boost-strike-2026": "70 RA", "evo-drive-gen2": "67 RA with AHT",
  "speed-mp-2024": "60 RA", "speed-pro-2024": "60 RA", "gravity-pro-2025": "59 RA", "gravity-mp-2025": "59 RA", "radical-mp-2025": "66 RA", "radical-pro-2025": "64 RA",
  "tf40-290": "64 RA", "tf40-305": "64 RA", "tf40-305-18x20": "64 RA", "tf40-315": "64 RA", "tfight-300": "66 RA", "tfight-300s": "66 RA", "tfight-305s": "65 RA", "tfight-315s": "65 RA", "tfight-iso-305": "64 RA", "tfx1-300": "71 RA", "tfx1-285": "71 RA",
};

function notablePlayerFor(modelKey: string) {
  if (/^defyer/.test(modelKey)) return "Holger Rune";
  if (/^blade/.test(modelKey)) return "Aryna Sabalenka";
  if (/^ultra/.test(modelKey)) return "Alex de Minaur";
  if (/^pro-staff-rf|^rf-01/.test(modelKey)) return "Roger Federer (signature line)";
  if (/^pro-staff/.test(modelKey)) return "Grigor Dimitrov";
  if (/^ezone/.test(modelKey)) return "Naomi Osaka";
  if (/^vcore(?!-pro)/.test(modelKey)) return "Elena Rybakina";
  if (/^(percept|vcore-pro)/.test(modelKey)) return "Stan Wawrinka";
  if (/^pure-aero-rafa|^aeropro/.test(modelKey)) return "Rafael Nadal";
  if (/^pure-aero/.test(modelKey)) return "Carlos Alcaraz";
  if (/^pure-drive/.test(modelKey)) return "Fabio Fognini";
  if (/^pure-strike/.test(modelKey)) return "Cameron Norrie";
  if (/^speed/.test(modelKey)) return "Jannik Sinner";
  if (/^gravity/.test(modelKey)) return "Alexander Zverev";
  if (/^radical/.test(modelKey)) return "Taylor Fritz";
  if (/^extreme/.test(modelKey)) return "Matteo Berrettini";
  if (/^boom/.test(modelKey)) return "Coco Gauff";
  if (/^prestige/.test(modelKey)) return "Marin Cilic";
  if (/^tempo/.test(modelKey)) return "Iga Swiatek";
  if (/^tfight-300s/.test(modelKey)) return "Iga Swiatek";
  if (/^tfight/.test(modelKey)) return "Daniil Medvedev";
  return "No featured tour player listed";
}

function reportedTourPresence(modelKey: string) {
  if (/^defyer/.test(modelKey)) return 30;
  if (/^blade/.test(modelKey)) return 6;
  if (/^ultra/.test(modelKey)) return 1;
  if (/^pro-staff/.test(modelKey)) return 2;
  if (/^ezone/.test(modelKey)) return 6;
  if (/^vcore(?!-pro)/.test(modelKey)) return 6;
  if (/^(percept|vcore-pro)/.test(modelKey)) return 2;
  if (/^pure-(?:aero|drive|strike)/.test(modelKey)) return 3;
  if (/^speed/.test(modelKey)) return 2;
  if (/^radical/.test(modelKey)) return 4;
  if (/^(gravity)/.test(modelKey)) return 1;
  if (/^(extreme|boom)/.test(modelKey)) return 2;
  if (/^prestige/.test(modelKey)) return 1;
  if (/^(tfight|tempo)/.test(modelKey)) return 6;
  return 0;
}

function specNumber(value?: string) {
  return value ? Number.parseFloat(value) : Number.NaN;
}

function standardizedSpecDisplay(field: keyof RacquetSpec, value?: string, includeConversion = true) {
  if (!value) return undefined;
  const amount = specNumber(value);
  if (field === "stiffness" && Number.isFinite(amount) && (amount < 40 || amount > 85)) return undefined;
  if (!Number.isFinite(amount) || !includeConversion) return value;
  if (field === "head") return `${Math.round(amount)} in²${includeConversion ? ` / ${Math.round(amount * 6.4516)} cm²` : ""}`;
  if (field === "weight" || field === "strungWeight") return `${Math.round(amount)} g${includeConversion ? ` / ${(amount / 28.3495).toFixed(1)} oz` : ""}`;
  if (field === "balance") return `${amount.toFixed(1)} cm${includeConversion ? ` / ${(amount / 2.54).toFixed(1)} in` : ""}`;
  if (field === "length") return `${amount.toFixed(amount % 1 ? 1 : 0)} in${includeConversion ? ` / ${(amount * 2.54).toFixed(1)} cm` : ""}`;
  return value;
}

function validationPresentation(validation?: SpecValidation) {
  if (!validation || validation.status === "insufficient") return { tone: "pending", label: "Retailer check pending" };
  if (validation.status === "conflict") return { tone: "conflict", label: `${validation.conflictFields} spec${validation.conflictFields === 1 ? "" : "s"} retailer-corrected` };
  if (validation.status === "retailer-consensus") return { tone: "consensus", label: `Retailer consensus · ${validation.sources.length} sources` };
  return { tone: "confirmed", label: `Confirmed · ${validation.sources.length} retailers` };
}

function normalizedPattern(value?: string) {
  return value?.toLowerCase().replaceAll("×", "x").replace(/\s+/g, "") ?? "";
}

function patternPresentation(value?: string) {
  const normalized = normalizedPattern(value);
  if (normalized === "16x19") return { tone: "open", label: "16 × 19", detail: "OPEN" };
  if (normalized === "16x20") return { tone: "tighter", label: "16 × 20", detail: "TIGHTER" };
  if (normalized === "18x20") return { tone: "dense", label: "18 × 20", detail: "DENSE" };
  if (normalized === "16x18") return { tone: "very-open", label: "16 × 18", detail: "VERY OPEN" };
  return value ? { tone: "alternate", label: value, detail: "ALTERNATE" } : null;
}

function matchesCatalogueFilters(modelKey: string, headSize: HeadSizeFilter, weight: WeightFilter, pattern: PatternFilter, specs: Record<string, RacquetSpec> = racquetSpecs) {
  const spec = specs[modelKey];
  if (!spec) return headSize === "all" && weight === "all" && pattern === "all";
  const head = specNumber(spec.head);
  const grams = specNumber(spec.weight);
  const normalized = normalizedPattern(spec.pattern);
  if (headSize !== "all" && head !== Number(headSize)) return false;
  if (weight === "light" && !(grams <= 295)) return false;
  if (weight === "medium" && !(grams >= 296 && grams <= 300)) return false;
  if (weight === "standard" && !(grams >= 301 && grams <= 305)) return false;
  if (weight === "heavy" && !(grams >= 306)) return false;
  if (pattern !== "all" && pattern !== "other" && normalized !== pattern) return false;
  if (pattern === "other" && (!normalized || ["16x19", "16x20", "18x20"].includes(normalized))) return false;
  return true;
}

function styleSignal(modelKey: string, name: string, spec?: RacquetSpec) {
  const value = `${modelKey} ${name} ${spec?.color ?? ""}`.toLowerCase();
  return {
    distinctive: /rafa|aero|vcore|defyer|extreme|boom|shift|concept|wimbledon|neon|yellow|orange|red|pink|purple|lime|volt|electric|blast/.test(value) ? 2 : 0,
    understated: /pro staff|blade|percept|tf40|prestige|classic|noir|black|white|silver|graphite|navy|forest/.test(value) ? 2 : 0,
  };
}

function sortCatalogueKeys(keys: string[], sort: CatalogueSort, specs: Record<string, RacquetSpec>, names: Record<string, string>, metrics: Record<string, CatalogueMetric>) {
  if (sort === "featured") return keys;
  const byName = (a: string, b: string) => (names[a] ?? a).localeCompare(names[b] ?? b, "en-CA", { sensitivity: "base", numeric: true });
  if (sort === "name-asc") return [...keys].sort(byName);
  if (sort === "name-desc") return [...keys].sort((a, b) => byName(b, a));
  if (sort === "style-distinctive" || sort === "style-understated") {
    const cue = sort === "style-distinctive" ? "distinctive" : "understated";
    return [...keys].sort((a, b) => styleSignal(b, names[b] ?? b, specs[b])[cue] - styleSignal(a, names[a] ?? a, specs[a])[cue] || byName(a, b));
  }
  const field = sort.startsWith("head") ? "head" : sort.startsWith("weight") ? "weight" : sort.startsWith("stiffness") ? "stiffness" : null;
  const direction = sort.endsWith("desc") || sort === "availability" || sort === "discount" || sort === "tour-presence" ? -1 : 1;
  return [...keys].sort((a, b) => {
    const first = field ? specNumber(specs[a]?.[field])
      : sort.startsWith("price") ? (metrics[a]?.price ?? Number.NaN)
        : sort === "availability" ? (metrics[a]?.retailers ?? Number.NaN)
          : sort === "discount" ? (metrics[a]?.discount ?? Number.NaN)
            : (metrics[a]?.tourPresence ?? Number.NaN);
    const second = field ? specNumber(specs[b]?.[field])
      : sort.startsWith("price") ? (metrics[b]?.price ?? Number.NaN)
        : sort === "availability" ? (metrics[b]?.retailers ?? Number.NaN)
          : sort === "discount" ? (metrics[b]?.discount ?? Number.NaN)
            : (metrics[b]?.tourPresence ?? Number.NaN);
    if (!Number.isFinite(first)) return 1;
    if (!Number.isFinite(second)) return -1;
    return (first - second) * direction || byName(a, b);
  });
}

const modelImages: Record<string, string> = {
  "defyer-98-pro-v1": "/racquets/optimized-v1/defyer-98-pro-v1.webp",
  "pro-staff-97-classic": "/racquets/optimized-v1/pro-staff-97-classic.webp",
  "fire-305s": "/racquets/optimized-v1/fire-305s.webp",
  "blade-v10": "/racquets/optimized-v1/blade-v10.webp",
  "blade-v9": "/racquets/optimized-v1/blade-v9.webp",
  "blade-v8": "/racquets/optimized-v1/blade-v8.webp",
  "ezone-98": "/racquets/optimized-v1/ezone-98.webp",
  "ezone-100": "/racquets/optimized-v1/ezone-100.webp",
  "pure-aero-98": "/racquets/optimized-v1/pure-aero-98.webp",
  "pure-aero-100": "/racquets/optimized-v1/pure-aero-100.webp",
  "clash-100": "/racquets/optimized-v1/clash-100.webp",
  "vcore-98": "/racquets/optimized-v1/vcore-98.webp",
  "vcore-100": "/racquets/optimized-v1/vcore-100.webp",
  "pure-drive-98": "/racquets/optimized-v1/pure-drive-98.webp",
  "pure-drive-100": "/racquets/optimized-v1/pure-drive-100.webp",
  "pro-staff-97": "/racquets/optimized-v1/pro-staff-97.webp",
  "gravity-mp-2025": "/racquets/optimized-v1/gravity-mp-2025.webp",
  "tf40-290": "/racquets/optimized-v1/tf40-290.webp",
  "radical-mp-2025": "/racquets/optimized-v1/radical-mp-2025.webp",
  "speed-pro-2026": "/racquets/optimized-v1/speed-pro-2026.webp",
  "rf-01-pro": "/racquets/optimized-v1/rf-01-pro.webp",
  "gravity-tour-2025": "/racquets/optimized-v1/gravity-tour-2025.webp",
  "squared-2026": "/racquets/optimized-v1/head-squared-2026.webp",
  "dunlop-cx-400-tour": "/racquets/optimized-v1/cx-400-tour.webp",
  "boost-aero-2026": "/racquets/optimized-v1/boost-aero-2026.webp",
  "boost-strike-2026": "/racquets/optimized-v1/boost-strike-2026.webp",
  "boost-wimbledon-2026": "/racquets/optimized-v1/boost-wimbledon-2026.webp",
  "evo-aero-gen2": "/racquets/optimized-v1/evo-aero-gen2.webp",
  "evo-drive-gen2": "/racquets/optimized-v1/evo-drive-gen2.webp",
};

function modelImage(modelKey: string, officialImage?: string) {
  if (officialImage?.startsWith("https://")) return officialImage;
  if (modelImages[modelKey]) return modelImages[modelKey];
  // A neutral placeholder is more useful than a convincing-but-wrong frame photo.
  return "/racquets/optimized-v1/racquet-photo-pending.svg?v=0.1.67";
}

function isManufacturerSpec(spec?: RacquetSpec) {
  const manufacturer = spec?.source?.match(/^(Wilson|Yonex|Babolat|Head|Tecnifibre|Dunlop|Prince|Volkl) official$/i)?.[1]?.toLowerCase();
  if (!manufacturer || !spec?.sourceUrl) return false;
  const domains: Record<string, string[]> = {
    wilson: ["wilson.com"], yonex: ["yonex.com"], babolat: ["babolat.com", "babolat.ca"], head: ["head.com"],
    tecnifibre: ["tecnifibre.com"], dunlop: ["dunlopsports.com"], prince: ["princetennis.com", "princetennis-hk.com"], volkl: ["volkltennis.com"],
  };
  try {
    const hostname = new URL(spec.sourceUrl).hostname.toLowerCase();
    return domains[manufacturer].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch { return false; }
}

const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 2 });
const usdMoney = new Intl.NumberFormat("en-CA", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

function offerMoney(offer: Offer) {
  return (offer.currency === "USD" ? usdMoney : money).format(offer.currentPrice ?? 0);
}

function searchSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const usedMarketplaces: UsedMarketplace[] = [
  {
    key: "kijiji",
    name: "Kijiji Canada",
    note: "Local pickup · Canada-wide",
    buildUrl: (query) => `https://www.kijiji.ca/b-canada/${searchSlug(query)}/k0l0`,
  },
  {
    key: "ebay",
    name: "eBay Canada",
    note: "Pre-owned · newest first",
    buildUrl: (query) => `https://www.ebay.ca/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_ItemCondition=3000&_sop=10`,
  },
  {
    key: "facebook",
    name: "Facebook Marketplace",
    note: "Local listings · login may be required",
    buildUrl: (query) => `https://www.facebook.com/marketplace/category/search/?query=${encodeURIComponent(query)}`,
  },
  {
    key: "sidelineswap",
    name: "SidelineSwap",
    note: "Specialty sellers · verify CAD total",
    buildUrl: (query) => `https://sidelineswap.com/search?q=${encodeURIComponent(query)}`,
  },
];

function relativeTime(value?: string) {
  if (!value) return "Not checked yet";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function freshnessRank(offer: { sourceState?: "fresh" | "stale" }) {
  return offer.sourceState === "stale" ? 1 : 0;
}

function uniqueRetailerOffers(offers: Offer[]) {
  const byStore = new Map<string, Offer>();
  for (const offer of offers) {
    if (offer.currentPrice === null) continue;
    const storeKey = offer.store.trim().toLocaleLowerCase("en-CA");
    const current = byStore.get(storeKey);
    if (!current || offer.currentPrice < (current.currentPrice ?? Infinity)) {
      byStore.set(storeKey, {
        ...offer,
        gripSizes: [...new Set([...(current?.gripSizes ?? []), ...offer.gripSizes])],
      });
    } else if (offer.gripSizes.length) {
      current.gripSizes = [...new Set([...current.gripSizes, ...offer.gripSizes])];
    }
  }
  return [...byStore.values()].sort((a, b) => freshnessRank(a) - freshnessRank(b) || (a.currentPrice ?? Infinity) - (b.currentPrice ?? Infinity) || a.store.localeCompare(b.store, "en-CA"));
}

export function BaselineApp() {
  const [activeMarket, setActiveMarket] = useState<MarketTab>("retail");
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [modelFetching, setModelFetching] = useState(false);
  const [refreshingModels, setRefreshingModels] = useState<Set<string>>(() => new Set());
  const modelRefreshTimes = useRef(new Map<string, number>());
  const [modelFetchMessage, setModelFetchMessage] = useState("");
  const [error, setError] = useState("");
  const [notifications, setNotifications] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [targetDraft, setTargetDraft] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installContext, setInstallContext] = useState<"browser" | "ios" | "installed" | "native">("browser");
  const [activeBrand, setActiveBrand] = useState<BrandViewKey>("all");
  const [compareKeys, setCompareKeys] = useState<string[]>([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [headSizeFilter, setHeadSizeFilter] = useState<HeadSizeFilter>("all");
  const [weightFilter, setWeightFilter] = useState<WeightFilter>("all");
  const [patternFilter, setPatternFilter] = useState<PatternFilter>("all");
  const [catalogueSort, setCatalogueSort] = useState<CatalogueSort>("featured");
  const [catalogueVisibleCount, setCatalogueVisibleCount] = useState(cataloguePageSize);
  const [stringTypeFilter, setStringTypeFilter] = useState<StringTypeFilter>("all");
  const [stringBrandFilter, setStringBrandFilter] = useState("all");
  const [stringGaugeFilter, setStringGaugeFilter] = useState("all");
  const [stringFormatFilter, setStringFormatFilter] = useState<StringFormatFilter>("all");
  const [stringVisibleCount, setStringVisibleCount] = useState(stringPageSize);
  const [accessoryCategoryFilter, setAccessoryCategoryFilter] = useState<AccessoryCategoryFilter>("all");
  const [accessoryBrandFilter, setAccessoryBrandFilter] = useState("all");
  const [accessorySearch, setAccessorySearch] = useState("");
  const [accessorySort, setAccessorySort] = useState<AccessorySort>("featured");
  const [accessoryVisibleCount, setAccessoryVisibleCount] = useState(accessoryPageSize);
  const [ballTypeFilter, setBallTypeFilter] = useState<BallTypeFilter>("all");
  const [ballBrandFilter, setBallBrandFilter] = useState("all");
  const [ballPackageFilter, setBallPackageFilter] = useState("all");
  const [ballSort, setBallSort] = useState<BallSort>("featured");
  const [ballVisibleCount, setBallVisibleCount] = useState(ballPageSize);
  const [usedSearch, setUsedSearch] = useState("");
  const [usedAvailability, setUsedAvailability] = useState<UsedAvailability>("all");
  const [usedSort, setUsedSort] = useState<UsedSort>("watchlist");
  const [retailerModelKey, setRetailerModelKey] = useState<string | null>(null);
  const [imagePreviewKey, setImagePreviewKey] = useState<string | null>(null);
  const [opportunityMode, setOpportunityMode] = useState<OpportunityMode>("target");
  const [specialBrandFilter, setSpecialBrandFilter] = useState("all");
  const [specialGripFilter, setSpecialGripFilter] = useState<SpecialGripFilter>("all");
  const [specialAvailabilityFilter, setSpecialAvailabilityFilter] = useState<SpecialAvailabilityFilter>("all");
  const [specialSort, setSpecialSort] = useState<SpecialSort>("edition");
  const resolvedRacquetSpecs = useMemo(() => {
    const resolved: Record<string, RacquetSpec> = { ...racquetSpecs };
    for (const [modelKey, published] of Object.entries(manufacturerPublishedSpecs)) {
      resolved[modelKey] = { ...(resolved[modelKey] ?? {}), ...published };
    }
    for (const [modelKey, fetched] of Object.entries(data?.racquetSpecs ?? {})) {
      if (!isManufacturerSpec(fetched) && !data?.modelSelectionRefreshes?.[modelKey]?.ok) continue;
      const existing = resolved[modelKey] ?? {};
      resolved[modelKey] = { ...existing, ...fetched };
    }
    for (const offer of data?.offers ?? []) {
      if (!offer.specs || !isManufacturerSpec(offer.specs)) continue;
      const existing = resolved[offer.modelKey] ?? {};
      resolved[offer.modelKey] = { ...existing, ...offer.specs };
    }
    for (const [modelKey, validation] of Object.entries(data?.specValidation ?? {})) {
      const existing = resolved[modelKey] ?? {};
      if (validation.status === "retailer-consensus" && !isManufacturerSpec(existing)) {
        resolved[modelKey] = {
          ...existing,
          ...validation.consensus,
          source: `Retailer consensus (${validation.sources.length} sources)`,
          sourceUrl: validation.sources[0]?.url,
        };
      }
      if (validation.status === "conflict") {
        const corrections = Object.fromEntries(Object.entries(validation.fieldChecks)
          .filter(([, check]) => check.status === "conflict" && check.retailers.length >= 3)
          .map(([field, check]) => [field, check.consensus])) as RacquetSpec;
        const fills = Object.fromEntries(Object.entries(validation.fieldChecks)
          .filter(([field, check]) => check.status === "retailer-consensus" && check.retailers.length >= 2 && !existing[field as keyof RacquetSpec])
          .map(([field, check]) => [field, check.consensus])) as RacquetSpec;
        if (Object.keys(corrections).length || Object.keys(fills).length) {
          const likelyVariantMismatch = Boolean(corrections.weight && corrections.pattern);
          resolved[modelKey] = {
            ...existing,
            ...fills,
            ...corrections,
            ...(likelyVariantMismatch ? { imageUrl: undefined } : {}),
            source: `${existing.source ?? "Official source"} · retailer-corrected`,
          };
        }
      }
    }
    for (const model of data?.modelOptions ?? []) {
      const existing = resolved[model.key] ?? {};
      resolved[model.key] = {
        ...existing,
        stiffness: existing.stiffness ?? publishedStiffness[model.key],
        notablePlayer: notablePlayerFor(model.key),
      };
    }
    return resolved;
  }, [data]);

  const load = useCallback(async () => {
    const response = await fetch("/api/tracker", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load prices");
    setData(applyPublicPreferences(await response.json() as Dashboard));
  }, []);

  const trackAnalytics = useCallback((event: string, detail?: string) => {
    if (!data?.publicPreview || navigator.doNotTrack === "1") return;
    const query = new URLSearchParams({ event });
    if (detail) query.set("detail", detail);
    void fetch(`/api/analytics?${query.toString()}`, { cache: "no-store", keepalive: true }).catch(() => undefined);
  }, [data?.publicPreview]);

  const openAnalytics = useCallback(async () => {
    setAnalyticsOpen(true);
    setAnalyticsLoading(true);
    try {
      const response = await fetch("/api/analytics", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load analytics");
      setAnalytics(await response.json() as AnalyticsSummary);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load analytics");
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (new URLSearchParams(window.location.search).get("market") === "used") setActiveMarket("used");
      load().catch((caught) => setError(caught.message)).finally(() => setLoading(false));
      setNotifications(localStorage.getItem("baseline-notifications") === "on" && Notification.permission === "granted");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (data?.publicPreview) trackAnalytics("page_view");
  }, [data?.publicPreview, trackAnalytics]);

  useEffect(() => {
    if (!data?.publicPreview || activeBrand === "all") return;
    trackAnalytics("browse_section", activeBrand);
  }, [activeBrand, data?.publicPreview, trackAnalytics]);

  useEffect(() => {
    if (data?.publicPreview && activeMarket === "used") trackAnalytics("used_market");
  }, [activeMarket, data?.publicPreview, trackAnalytics]);

  useEffect(() => {
    if (data?.publicPreview && retailerModelKey) trackAnalytics("retailer_open");
  }, [data?.publicPreview, retailerModelKey, trackAnalytics]);

  useEffect(() => {
    if (data?.publicPreview && comparisonOpen) trackAnalytics("comparison_open");
  }, [comparisonOpen, data?.publicPreview, trackAnalytics]);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const capacitor = (window as typeof window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setInstallContext(capacitor?.isNativePlatform?.() ? "native" : standalone ? "installed" : ios ? "ios" : "browser");
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const markInstalled = () => {
      setInstallPrompt(null);
      setInstallContext("installed");
    };
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  useEffect(() => {
    if (!retailerModelKey) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setRetailerModelKey(null); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [retailerModelKey]);

  const installBaseline = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallContext("installed");
    setInstallPrompt(null);
  };

  const catalogueMetrics = useMemo(() => {
    const metrics: Record<string, CatalogueMetric> = {};
    const retailers = new Map<string, Set<string>>();
    for (const model of data?.modelOptions ?? []) {
      metrics[model.key] = { price: Number.POSITIVE_INFINITY, retailers: 0, discount: 0, tourPresence: reportedTourPresence(model.key) };
      retailers.set(model.key, new Set());
    }
    for (const offer of data?.offers ?? []) {
      if (!offer.inStock || offer.currentPrice === null || !metrics[offer.modelKey]) continue;
      metrics[offer.modelKey].price = Math.min(metrics[offer.modelKey].price, offer.currentPrice);
      retailers.get(offer.modelKey)?.add(offer.store);
      if (offer.compareAtPrice && offer.compareAtPrice > offer.currentPrice) {
        metrics[offer.modelKey].discount = Math.max(metrics[offer.modelKey].discount, (offer.compareAtPrice - offer.currentPrice) / offer.compareAtPrice);
      }
    }
    for (const [modelKey, stores] of retailers) metrics[modelKey].retailers = stores.size;
    return metrics;
  }, [data]);

  const racquetImage = (modelKey: string, className: string, width: number, height: number, alt: string, sizes?: string) => {
    const src = modelImage(modelKey, resolvedRacquetSpecs[modelKey]?.imageUrl);
    const pending = src.includes("racquet-photo-pending.svg");
    return <button type="button" className={`${className} image-preview-trigger`} onClick={() => setImagePreviewKey(modelKey)} aria-label={`View larger photo of ${alt}`} title={pending ? "Photo is being verified" : `View ${alt} photo`}>
      <Image src={src} alt={alt} width={width} height={height} sizes={sizes} unoptimized />
      <span className="image-preview-hint">{pending ? "Photo pending" : "View photo"}</span>
    </button>;
  };
  const availableHeadSizes = useMemo(() => [...new Set(
    Object.values(resolvedRacquetSpecs)
      .map((spec) => specNumber(spec.head))
      .filter((size): size is number => Number.isFinite(size) && size >= 80 && size <= 140),
  )].sort((a, b) => a - b), [resolvedRacquetSpecs]);

  const filterModelKeys = useCallback((keys: string[]) => sortCatalogueKeys(
    keys.filter((key) => matchesCatalogueFilters(key, headSizeFilter, weightFilter, patternFilter, resolvedRacquetSpecs)),
    catalogueSort,
    resolvedRacquetSpecs,
    data?.modelNames ?? {},
    catalogueMetrics,
  ), [catalogueMetrics, catalogueSort, data?.modelNames, headSizeFilter, patternFilter, resolvedRacquetSpecs, weightFilter]);
  const otherUsedOffers = useMemo(() => {
    const selected = new Set(data?.modelOrder ?? []);
    return (data?.usedOffers ?? []).filter((offer) => !selected.has(offer.modelKey)).slice(0, 12);
  }, [data]);
  const sortedModelOptions = useMemo(
    () => [...(data?.modelOptions ?? [])].sort((a, b) => a.name.localeCompare(b.name, "en-CA", { sensitivity: "base" })),
    [data],
  );
  const sortedRetailers = useMemo(
    () => [...(data?.retailers ?? [])].sort((a, b) => a.name.localeCompare(b.name, "en-CA", { sensitivity: "base" })),
    [data],
  );
  const usedSourceCount = useMemo(() => new Set((data?.usedOffers ?? []).map((offer) => offer.store)).size, [data]);
  const bestOpportunity = useMemo(() => {
    if (!data) return null;
    const watchlist = new Set(data.modelOrder);
    const cheapestByModel = new Map<string, Offer>();
    const watchlistCandidates = data.offers.filter((offer) => watchlist.has(offer.modelKey) && offer.inStock && offer.currentPrice !== null);
    const candidates = watchlistCandidates.some((offer) => offer.sourceState !== "stale") ? watchlistCandidates.filter((offer) => offer.sourceState !== "stale") : watchlistCandidates;
    for (const offer of candidates) {
      const current = cheapestByModel.get(offer.modelKey);
      if (!current || offer.currentPrice < (current.currentPrice ?? Infinity)) cheapestByModel.set(offer.modelKey, offer);
    }
    const watchlistDeals = [...cheapestByModel.values()].map((offer) => {
      const target = data.targets[offer.modelKey] ?? 0;
      const delta = (offer.currentPrice ?? 0) - target;
      return { offer, target, delta, watchlist: true };
    }).sort((a, b) => {
      const aHit = a.delta <= 0;
      const bHit = b.delta <= 0;
      if (aHit !== bHit) return aHit ? -1 : 1;
      if (aHit) return a.delta - b.delta;
      return (a.delta / Math.max(a.target, 1)) - (b.delta / Math.max(b.target, 1));
    });
    if (watchlistDeals[0]) return watchlistDeals[0];

    const saleCandidates = data.saleOffers.some((offer) => offer.sourceState !== "stale") ? data.saleOffers.filter((offer) => offer.sourceState !== "stale") : data.saleOffers;
    const fallback = [...saleCandidates]
      .filter((offer) => offer.inStock && offer.currentPrice !== null)
      .sort((a, b) => {
        const aDiscount = a.compareAtPrice && a.compareAtPrice > (a.currentPrice ?? 0)
          ? (a.compareAtPrice - (a.currentPrice ?? 0)) / a.compareAtPrice : 0;
        const bDiscount = b.compareAtPrice && b.compareAtPrice > (b.currentPrice ?? 0)
          ? (b.compareAtPrice - (b.currentPrice ?? 0)) / b.compareAtPrice : 0;
        return bDiscount - aDiscount || (a.currentPrice ?? Infinity) - (b.currentPrice ?? Infinity);
      })[0];
    return fallback ? { offer: fallback, target: 0, delta: 0, watchlist: false } : null;
  }, [data]);
  const opportunityChoices = useMemo(() => {
    if (!data) return [];
    const watchlist = new Set(data.modelOrder);
    const allEligible = data.offers.filter((offer) => watchlist.has(offer.modelKey) && offer.inStock && offer.currentPrice !== null);
    const eligible = allEligible.some((offer) => offer.sourceState !== "stale") ? allEligible.filter((offer) => offer.sourceState !== "stale") : allEligible;
    const bestByModel = new Map<string, Offer>();
    const storesByModel = new Map<string, Set<string>>();
    for (const offer of eligible) {
      storesByModel.set(offer.modelKey, (storesByModel.get(offer.modelKey) ?? new Set()).add(offer.store));
      const current = bestByModel.get(offer.modelKey);
      if (!current || (offer.currentPrice ?? Infinity) < (current.currentPrice ?? Infinity)) bestByModel.set(offer.modelKey, offer);
    }
    const models = [...bestByModel.values()];
    const widest = [...models].sort((a, b) => (storesByModel.get(b.modelKey)?.size ?? 0) - (storesByModel.get(a.modelKey)?.size ?? 0) || (a.currentPrice ?? Infinity) - (b.currentPrice ?? Infinity))[0];
    const tourFavourite = [...models].sort((a, b) => reportedTourPresence(b.modelKey) - reportedTourPresence(a.modelKey) || (a.currentPrice ?? Infinity) - (b.currentPrice ?? Infinity))[0];
    return [
      bestOpportunity && { mode: "target" as const, label: "Best deal", ...bestOpportunity, stores: storesByModel.get(bestOpportunity.offer.modelKey)?.size ?? 1 },
      widest && { mode: "availability" as const, label: "Most stocked", offer: widest, target: data.targets[widest.modelKey] ?? 0, delta: (widest.currentPrice ?? 0) - (data.targets[widest.modelKey] ?? 0), watchlist: true, stores: storesByModel.get(widest.modelKey)?.size ?? 1 },
      tourFavourite && { mode: "tour" as const, label: "Most played", offer: tourFavourite, target: data.targets[tourFavourite.modelKey] ?? 0, delta: (tourFavourite.currentPrice ?? 0) - (data.targets[tourFavourite.modelKey] ?? 0), watchlist: true, stores: storesByModel.get(tourFavourite.modelKey)?.size ?? 1, tourPresence: reportedTourPresence(tourFavourite.modelKey) },
    ].filter(Boolean) as Array<{ mode: OpportunityMode; label: string; offer: Offer; target: number; delta: number; watchlist: boolean; stores: number; tourPresence?: number }>;
  }, [bestOpportunity, data]);
  const selectedOpportunity = opportunityChoices.find((choice) => choice.mode === opportunityMode) ?? opportunityChoices[0] ?? null;
  const retailerModelOffers = useMemo(() => retailerModelKey ? uniqueRetailerOffers((data?.offers ?? []).filter((offer) => offer.modelKey === retailerModelKey && offer.currentPrice !== null && (offer.inStock || /pre[- ]?order|coming soon/i.test(offer.title)))) : [], [data, retailerModelKey]);
  const marketplaceHealth = useMemo(() => {
    const sources = [
      { key: "facebook", name: "Facebook Marketplace", prefix: "Facebook Marketplace" },
      { key: "ebay", name: "eBay Canada", prefix: "eBay Canada" },
      { key: "kijiji", name: "Kijiji Canada", prefix: "Kijiji" },
      { key: "sidelineswap", name: "SidelineSwap", prefix: "SidelineSwap" },
    ];
    return sources.map((source) => {
      const rows = (data?.usedSourceResults ?? []).filter((row) => row.source.startsWith(source.prefix));
      const configured = rows.length > 0 && rows.some((row) => row.configured !== false);
      const online = configured && rows.some((row) => row.ok);
      const offers = rows.reduce((total, row) => total + row.offers, 0);
      const error = rows.find((row) => row.error)?.error ?? null;
      return { ...source, checked: rows.length > 0, configured, online, offers, error };
    }).sort((a, b) => a.name.localeCompare(b.name, "en-CA", { sensitivity: "base" }));
  }, [data]);
  const brandModelKeys = useMemo(() => {
    if (activeBrand === "all") return data?.modelOrder ?? [];
    if (activeBrand === "catalogue") return (data?.modelOptions ?? []).map((option) => option.key);
    if (activeBrand === "special" || activeBrand === "strings" || activeBrand === "balls" || activeBrand === "accessories" || activeBrand === "guide" || activeBrand === "string-guide") return [];
    return (data?.modelOptions ?? []).filter((option) => modelBrand(option.key) === activeBrand).map((option) => option.key);
  }, [activeBrand, data]);
  const featuredModelKeys = useMemo(() => {
    if (activeBrand === "catalogue") return filterModelKeys(brandModelKeys);
    if (activeBrand === "all") return brandModelKeys;
    if (activeBrand === "special" || activeBrand === "strings" || activeBrand === "balls" || activeBrand === "accessories" || activeBrand === "guide" || activeBrand === "string-guide") return [];
    const preferred = data?.brandPicks?.[activeBrand] ?? featuredByBrand[activeBrand];
    return preferred.filter((key) => brandModelKeys.includes(key));
  }, [activeBrand, brandModelKeys, data, filterModelKeys]);
  const visibleFeaturedModelKeys = useMemo(() =>
    activeBrand === "catalogue" ? featuredModelKeys.slice(0, catalogueVisibleCount) : featuredModelKeys,
  [activeBrand, catalogueVisibleCount, featuredModelKeys]);
  const suggestedModelKeys = useMemo(() => activeBrand === "all" || activeBrand === "catalogue" || activeBrand === "special" || activeBrand === "strings" || activeBrand === "balls" || activeBrand === "accessories" || activeBrand === "guide" || activeBrand === "string-guide" ? [] : brandModelKeys.filter((key) => !(data?.brandPicks?.[activeBrand] ?? featuredByBrand[activeBrand]).includes(key)), [activeBrand, brandModelKeys, data]);
  const usedModelKeys = useMemo(() => data?.modelOrder ?? [], [data]);
  const visibleUsedModelKeys = useMemo(() => {
    const query = usedSearch.trim().toLowerCase();
    const keys = usedModelKeys.filter((modelKey) => {
      const offers = (data?.usedOffers ?? []).filter((offer) => offer.modelKey === modelKey);
      if (query && !(data?.modelNames[modelKey] ?? modelKey).toLowerCase().includes(query)) return false;
      if (usedAvailability === "live" && offers.length === 0) return false;
      if (usedAvailability === "empty" && offers.length > 0) return false;
      return true;
    });
    if (usedSort === "name-asc") return keys.sort((a, b) => (data?.modelNames[a] ?? a).localeCompare(data?.modelNames[b] ?? b, "en-CA", { sensitivity: "base" }));
    if (usedSort === "listings-desc") return keys.sort((a, b) => (data?.usedOffers ?? []).filter((offer) => offer.modelKey === b).length - (data?.usedOffers ?? []).filter((offer) => offer.modelKey === a).length);
    if (usedSort === "price-asc") return keys.sort((a, b) => {
      const best = (key: string) => Math.min(...(data?.usedOffers ?? []).filter((offer) => offer.modelKey === key && offer.currentPrice !== null).map((offer) => offer.currentPrice as number), Number.POSITIVE_INFINITY);
      return best(a) - best(b);
    });
    return keys;
  }, [data, usedAvailability, usedModelKeys, usedSearch, usedSort]);
  const usedFreshCount = useMemo(() => (data?.usedOffers ?? []).filter((offer) => Date.now() - new Date(offer.lastChecked).getTime() <= 86_400_000).length, [data]);
  const usedTargetHitCount = useMemo(() => new Set((data?.usedOffers ?? []).filter((offer) => offer.currentPrice !== null && offer.currentPrice <= (data?.usedTargets[offer.modelKey] ?? Math.round((data?.targets[offer.modelKey] ?? 250) * .68))).map((offer) => offer.modelKey)).size, [data]);
  const visibleSaleOffers = useMemo(() => activeBrand === "special" || activeBrand === "strings" || activeBrand === "balls" || activeBrand === "accessories" || activeBrand === "guide" || activeBrand === "string-guide"
    ? []
    : activeBrand === "all" || activeBrand === "catalogue"
    ? (data?.saleOffers ?? [])
    : (data?.saleOffers ?? []).filter((offer) => offer.title.toLowerCase().includes(activeBrand.toLowerCase())),
  [activeBrand, data]);
  const filteredSaleOffers = visibleSaleOffers;
  const specialEditionGroups = useMemo<SpecialEditionGroup[]>(() => {
    const matches = (data?.specialOffers ?? data?.offers ?? []).filter((offer) =>
      offer.inStock && offer.currentPrice !== null && specialEditionName(offer.title) && specialGripLabels(offer.gripSizes).length);
    const uniqueOffers = new Map<string, Offer>();
    for (const offer of matches) {
      const existing = uniqueOffers.get(offer.id);
      if (!existing || (offer.currentPrice ?? Infinity) < (existing.currentPrice ?? Infinity)) uniqueOffers.set(offer.id, offer);
    }
    const grouped = new Map<string, { modelKey: string; offers: Offer[] }>();
    for (const offer of uniqueOffers.values()) {
      const modelKey = specialEditionModelKey(offer);
      const key = `${modelKey}:${specialEditionFamily(offer.title)}`;
      const group = grouped.get(key) ?? { modelKey, offers: [] };
      group.offers.push(offer);
      grouped.set(key, group);
    }
    return [...grouped.entries()].map(([key, group]) => {
      const offers = group.offers.sort((a, b) =>
        freshnessRank(a) - freshnessRank(b)
        || (a.currentPrice ?? Infinity) - (b.currentPrice ?? Infinity)
        || a.store.localeCompare(b.store, "en-CA", { sensitivity: "base" }));
      const grips = [...new Set(offers.flatMap((offer) => specialGripLabels(offer.gripSizes)))].sort();
      return {
        key,
        modelKey: group.modelKey,
        edition: specialEditionGroupLabel(offers),
        title: preferredSpecialTitle(offers),
        offers,
        grips,
        bestOffer: offers[0],
      };
    }).sort((a, b) =>
      a.edition.localeCompare(b.edition, "en-CA", { sensitivity: "base" })
      || a.title.localeCompare(b.title, "en-CA", { sensitivity: "base" })
      || (a.bestOffer.currentPrice ?? Infinity) - (b.bestOffer.currentPrice ?? Infinity));
  }, [data]);
  const specialEditionStats = useMemo(() => ({
    racquets: specialEditionGroups.length,
    offers: specialEditionGroups.reduce((total, group) => total + group.offers.length, 0),
    retailers: new Set(specialEditionGroups.flatMap((group) => group.offers.map((offer) => offer.store))).size,
    gripSizes: new Set(specialEditionGroups.flatMap((group) => group.grips)).size,
    selectedGrip: specialEditionGroups.filter((group) => group.grips.includes(data?.gripSize ?? "L3")).length,
  }), [data?.gripSize, specialEditionGroups]);
  const specialBrands = useMemo(() => [...new Set(specialEditionGroups.map(specialOfferBrand))].sort((a, b) => a.localeCompare(b, "en-CA", { sensitivity: "base" })), [specialEditionGroups]);
  const filteredSpecialEditionGroups = useMemo(() => specialEditionGroups.filter((group) => {
    if (specialBrandFilter !== "all" && specialOfferBrand(group) !== specialBrandFilter) return false;
    if (specialGripFilter !== "all" && specialGripFilter !== "multiple" && !group.grips.includes(specialGripFilter)) return false;
    if (specialGripFilter === "multiple" && group.grips.length < 2) return false;
    if (specialAvailabilityFilter === "multi" && group.offers.length < 2) return false;
    return true;
  }).sort((a, b) => {
    if (specialSort === "name-asc") return a.title.localeCompare(b.title, "en-CA", { sensitivity: "base" });
    if (specialSort === "price-asc") return (a.bestOffer.currentPrice ?? Infinity) - (b.bestOffer.currentPrice ?? Infinity);
    if (specialSort === "price-desc") return (b.bestOffer.currentPrice ?? -Infinity) - (a.bestOffer.currentPrice ?? -Infinity);
    if (specialSort === "retailers-desc") return b.offers.length - a.offers.length || a.title.localeCompare(b.title, "en-CA", { sensitivity: "base" });
    return a.edition.localeCompare(b.edition, "en-CA", { sensitivity: "base" }) || a.title.localeCompare(b.title, "en-CA", { sensitivity: "base" });
  }), [specialAvailabilityFilter, specialBrandFilter, specialEditionGroups, specialGripFilter, specialSort]);
  const allStringGroups = useMemo<StringGroup[]>(() => {
    const grouped = new Map<string, StringOffer[]>();
    for (const offer of data?.stringOffers ?? []) {
      if (!offer.inStock || offer.currentPrice === null) continue;
      const key = stringFamilyKey(offer);
      grouped.set(key, [...(grouped.get(key) ?? []), offer]);
    }
    return [...grouped.entries()].map(([key, offers]) => {
      const sorted = offers.sort((a, b) =>
        freshnessRank(a) - freshnessRank(b)
        || (a.currentPrice ?? Infinity) - (b.currentPrice ?? Infinity)
        || a.store.localeCompare(b.store, "en-CA", { sensitivity: "base" }));
      const representative = [...offers].sort((a, b) => a.title.length - b.title.length)[0];
      const collectedGauges = [...new Set(offers.flatMap((offer) => offer.gauges))];
      const gauges = (collectedGauges.some((gauge) => gauge !== "Not listed")
        ? collectedGauges.filter((gauge) => gauge !== "Not listed") : collectedGauges)
        .sort((a, b) => stringGaugeOrder.indexOf(a) - stringGaugeOrder.indexOf(b));
      return {
        key,
        title: representative.title,
        brand: canonicalStringBrand(representative.brand, representative.title),
        type: representative.type,
        format: representative.format,
        gauges,
        offers: sorted,
        bestOffer: sorted[0],
      };
    }).sort((a, b) =>
      stringTypeOrder.indexOf(a.type) - stringTypeOrder.indexOf(b.type)
      || a.brand.localeCompare(b.brand, "en-CA", { sensitivity: "base" })
      || a.title.localeCompare(b.title, "en-CA", { sensitivity: "base" })
      || (a.bestOffer.currentPrice ?? Infinity) - (b.bestOffer.currentPrice ?? Infinity));
  }, [data]);
  const availableStringGauges = useMemo(() =>
    stringGaugeOrder.filter((gauge) => allStringGroups.some((group) => group.gauges.includes(gauge))),
  [allStringGroups]);
  const availableStringBrands = useMemo(() =>
    [...new Set(allStringGroups.map((group) => group.brand))]
      .sort((a, b) => a.localeCompare(b, "en-CA", { sensitivity: "base" })),
  [allStringGroups]);
  const availableStringFormats = useMemo(() =>
    stringFormatOrder.filter((format) => allStringGroups.some((group) => group.format === format)),
  [allStringGroups]);
  const filteredStringGroups = useMemo(() => allStringGroups.filter((group) =>
    (stringTypeFilter === "all" || group.type === stringTypeFilter)
    && (stringBrandFilter === "all" || group.brand === stringBrandFilter)
    && (stringGaugeFilter === "all" || group.gauges.includes(stringGaugeFilter))
    && (stringFormatFilter === "all" || group.format === stringFormatFilter)),
  [allStringGroups, stringBrandFilter, stringFormatFilter, stringGaugeFilter, stringTypeFilter]);
  const visibleStringGroups = stringTypeFilter === "all"
    ? stringTypeOrder.flatMap((type) => filteredStringGroups.filter((group) => group.type === type).slice(0, stringVisibleCount))
    : filteredStringGroups.slice(0, stringVisibleCount * 6);
  const stringGroupsByType = useMemo(() => stringTypeOrder.map((type) => ({
    type,
    groups: visibleStringGroups.filter((group) => group.type === type),
  })).filter((section) => section.groups.length), [visibleStringGroups]);
  const stringStats = useMemo(() => ({
    products: filteredStringGroups.length,
    offers: filteredStringGroups.reduce((total, group) => total + group.offers.length, 0),
    retailers: new Set(filteredStringGroups.flatMap((group) => group.offers.map((offer) => offer.store))).size,
    gauges: new Set(filteredStringGroups.flatMap((group) => group.gauges).filter((gauge) => gauge !== "Not listed")).size,
    formats: new Set(filteredStringGroups.map((group) => group.format)).size,
  }), [filteredStringGroups]);
  const allAccessoryGroups = useMemo<AccessoryGroup[]>(() => {
    const grouped = new Map<string, AccessoryOffer[]>();
    for (const offer of data?.accessoryOffers ?? []) {
      if (!offer.inStock || offer.currentPrice === null) continue;
      const key = accessoryFamilyKey(offer);
      grouped.set(key, [...(grouped.get(key) ?? []), offer]);
    }
    return [...grouped.entries()].map(([key, offers]) => {
      const sorted = offers.sort((a, b) =>
        freshnessRank(a) - freshnessRank(b)
        || (a.currentPrice ?? Infinity) - (b.currentPrice ?? Infinity)
        || a.store.localeCompare(b.store, "en-CA", { sensitivity: "base" }));
      const representative = [...offers].sort((a, b) => a.title.length - b.title.length)[0];
      return {
        key,
        title: representative.title,
        brand: representative.brand,
        category: representative.category,
        detail: representative.detail,
        offers: sorted,
        bestOffer: sorted[0],
      };
    }).sort((a, b) =>
      accessoryCategoryOrder.indexOf(a.category) - accessoryCategoryOrder.indexOf(b.category)
      || a.brand.localeCompare(b.brand, "en-CA", { sensitivity: "base" })
      || a.title.localeCompare(b.title, "en-CA", { sensitivity: "base" })
      || (a.bestOffer.currentPrice ?? Infinity) - (b.bestOffer.currentPrice ?? Infinity));
  }, [data]);
  const availableAccessoryBrands = useMemo(() =>
    [...new Set(allAccessoryGroups.map((group) => group.brand))]
      .sort((a, b) => a.localeCompare(b, "en-CA", { sensitivity: "base" })),
  [allAccessoryGroups]);
  const filteredAccessoryGroups = useMemo(() => {
    const search = accessorySearch.trim().toLocaleLowerCase("en-CA");
    const matches = allAccessoryGroups.filter((group) =>
      (accessoryCategoryFilter === "all" || group.category === accessoryCategoryFilter)
      && (accessoryBrandFilter === "all" || group.brand === accessoryBrandFilter)
      && (!search || `${group.brand} ${group.title} ${group.category} ${group.detail}`.toLocaleLowerCase("en-CA").includes(search)));
    return [...matches].sort((a, b) => {
      if (accessorySort === "price-asc") return (a.bestOffer.currentPrice ?? Infinity) - (b.bestOffer.currentPrice ?? Infinity);
      if (accessorySort === "price-desc") return (b.bestOffer.currentPrice ?? 0) - (a.bestOffer.currentPrice ?? 0);
      if (accessorySort === "discount") {
        const saving = (offer: AccessoryOffer) => offer.compareAtPrice && offer.currentPrice !== null && offer.compareAtPrice > offer.currentPrice
          ? (offer.compareAtPrice - offer.currentPrice) / offer.compareAtPrice : 0;
        return saving(b.bestOffer) - saving(a.bestOffer) || (a.bestOffer.currentPrice ?? Infinity) - (b.bestOffer.currentPrice ?? Infinity);
      }
      return accessoryCategoryOrder.indexOf(a.category) - accessoryCategoryOrder.indexOf(b.category)
        || a.brand.localeCompare(b.brand, "en-CA", { sensitivity: "base" })
        || a.title.localeCompare(b.title, "en-CA", { sensitivity: "base" });
    });
  }, [accessoryBrandFilter, accessoryCategoryFilter, accessorySearch, accessorySort, allAccessoryGroups]);
  const visibleAccessoryGroups = accessoryCategoryFilter === "all"
    ? accessoryCategoryOrder.flatMap((category) => filteredAccessoryGroups.filter((group) => group.category === category).slice(0, accessoryVisibleCount))
    : filteredAccessoryGroups.slice(0, accessoryVisibleCount);
  const accessoryGroupsByCategory = useMemo(() => accessoryCategoryOrder.map((category) => ({
    category,
    groups: visibleAccessoryGroups.filter((group) => group.category === category),
  })).filter((section) => section.groups.length), [visibleAccessoryGroups]);
  const accessoryStats = useMemo(() => ({
    products: filteredAccessoryGroups.length,
    offers: filteredAccessoryGroups.reduce((total, group) => total + group.offers.length, 0),
    retailers: new Set(filteredAccessoryGroups.flatMap((group) => group.offers.map((offer) => offer.store))).size,
    categories: new Set(filteredAccessoryGroups.map((group) => group.category)).size,
  }), [filteredAccessoryGroups]);
  const allBallGroups = useMemo<BallGroup[]>(() => {
    const grouped = new Map<string, BallOffer[]>();
    for (const offer of data?.ballOffers ?? []) {
      if (!offer.inStock || offer.currentPrice === null) continue;
      const key = ballFamilyKey(offer);
      grouped.set(key, [...(grouped.get(key) ?? []), offer]);
    }
    return [...grouped.entries()].map(([key, offers]) => {
      const sorted = offers.sort((a, b) => freshnessRank(a) - freshnessRank(b)
        || (a.currentPrice ?? Infinity) - (b.currentPrice ?? Infinity)
        || a.store.localeCompare(b.store, "en-CA", { sensitivity: "base" }));
      const representative = [...offers].sort((a, b) => a.title.length - b.title.length)[0];
      return { key, title: representative.title, brand: representative.brand, type: representative.type, package: representative.package, offers: sorted, bestOffer: sorted[0] };
    }).sort((a, b) => ballTypeOrder.indexOf(a.type) - ballTypeOrder.indexOf(b.type)
      || a.brand.localeCompare(b.brand, "en-CA", { sensitivity: "base" })
      || a.title.localeCompare(b.title, "en-CA", { sensitivity: "base" }));
  }, [data]);
  const stringGuideExamples = useMemo(() => stringTypeOrder.flatMap((type) => {
    const example = allStringGroups.find((group) => group.type === type);
    return example ? [example] : [];
  }), [allStringGroups]);
  const availableBallBrands = useMemo(() => [...new Set(allBallGroups.map((group) => group.brand))]
    .sort((a, b) => a.localeCompare(b, "en-CA", { sensitivity: "base" })), [allBallGroups]);
  const availableBallPackages = useMemo(() => [...new Set(allBallGroups.map((group) => group.package))]
    .sort((a, b) => a.localeCompare(b, "en-CA", { numeric: true, sensitivity: "base" })), [allBallGroups]);
  const filteredBallGroups = useMemo(() => {
    const matches = allBallGroups.filter((group) => (ballTypeFilter === "all" || group.type === ballTypeFilter)
      && (ballBrandFilter === "all" || group.brand === ballBrandFilter)
      && (ballPackageFilter === "all" || group.package === ballPackageFilter));
    return [...matches].sort((a, b) => {
      if (ballSort === "price-asc") return (a.bestOffer.currentPrice ?? Infinity) - (b.bestOffer.currentPrice ?? Infinity);
      if (ballSort === "price-desc") return (b.bestOffer.currentPrice ?? 0) - (a.bestOffer.currentPrice ?? 0);
      if (ballSort === "discount") {
        const saving = (offer: BallOffer) => offer.compareAtPrice && offer.currentPrice !== null && offer.compareAtPrice > offer.currentPrice
          ? (offer.compareAtPrice - offer.currentPrice) / offer.compareAtPrice : 0;
        return saving(b.bestOffer) - saving(a.bestOffer) || (a.bestOffer.currentPrice ?? Infinity) - (b.bestOffer.currentPrice ?? Infinity);
      }
      return ballTypeOrder.indexOf(a.type) - ballTypeOrder.indexOf(b.type)
        || a.brand.localeCompare(b.brand, "en-CA", { sensitivity: "base" })
        || a.title.localeCompare(b.title, "en-CA", { sensitivity: "base" });
    });
  }, [allBallGroups, ballBrandFilter, ballPackageFilter, ballSort, ballTypeFilter]);
  const visibleBallGroups = filteredBallGroups.slice(0, ballVisibleCount);
  const ballStats = useMemo(() => ({
    products: filteredBallGroups.length,
    offers: filteredBallGroups.reduce((total, group) => total + group.offers.length, 0),
    retailers: new Set(filteredBallGroups.flatMap((group) => group.offers.map((offer) => offer.store))).size,
    types: new Set(filteredBallGroups.map((group) => group.type)).size,
  }), [filteredBallGroups]);
  const coachModels = useMemo<CoachModel[]>(() => (data?.modelOptions ?? []).flatMap((model) => {
    const currentGrip = data?.gripSize ?? "L3";
    const offers = (data?.offers ?? []).filter((offer) => offer.modelKey === model.key && offer.inStock && offer.currentPrice !== null);
    const verifiedGripOffers = offers.filter((offer) => offer.gripSizes.includes(currentGrip));
    const best = [...(verifiedGripOffers.length ? verifiedGripOffers : offers)]
      .sort((a, b) => freshnessRank(a) - freshnessRank(b) || (a.currentPrice ?? Infinity) - (b.currentPrice ?? Infinity))[0];
    if (!best?.currentPrice || !best.url) return [];
    const specs = resolvedRacquetSpecs[model.key] ?? {};
    return [{
      key: model.key,
      name: model.name,
      brand: modelBrand(model.key) ?? model.name.split(/\s+/)[0] ?? "Racquet",
      head: specs.head,
      weight: specs.weight,
      pattern: specs.pattern,
      profile: specs.profile,
      color: specs.color,
      price: best.currentPrice,
      store: best.store,
      url: best.url,
    }];
  }), [data, resolvedRacquetSpecs]);
  const coachStrings = useMemo<CoachString[]>(() => allStringGroups.map((group) => ({
    key: group.key,
    title: group.title,
    brand: group.brand,
    type: group.type,
    gauges: group.gauges,
    format: group.format,
    price: group.bestOffer.currentPrice ?? 0,
    store: group.bestOffer.store,
    url: group.bestOffer.url,
  })).filter((item) => item.price > 0), [allStringGroups]);

  const clearCatalogueFilters = () => {
    setHeadSizeFilter("all");
    setWeightFilter("all");
    setPatternFilter("all");
    setCatalogueSort("featured");
    setCatalogueVisibleCount(cataloguePageSize);
  };


  const fetchNewModels = async () => {
    if (data?.publicPreview) {
      setModelFetchMessage("The public beta refreshes its catalogue automatically. New model scans are managed by Baseline.");
      return;
    }
    setModelFetching(true);
    setModelFetchMessage("Starting an official catalogue scan...");
    setError("");
    try {
      let response = await fetch("/api/tracker?action=models", { method: "POST" });
      if (!response.ok) throw new Error("The model catalogue refresh could not start.");
      let next = await response.json() as Dashboard;
      setData(next);
      for (let attempt = 0; attempt < 100 && next.modelRefresh?.status === "running"; attempt += 1) {
        setModelFetchMessage("Checking official manufacturer catalogues... You can keep browsing.");
        await new Promise((resolve) => window.setTimeout(resolve, 3000));
        response = await fetch("/api/tracker", { cache: "no-store" });
        if (!response.ok) continue;
        next = await response.json() as Dashboard;
        setData(next);
      }
      const result = next.modelRefresh;
      if (result?.status === "failed") throw new Error("The official catalogue scan did not finish. Please try again.");
      if (result?.status === "running") {
        setModelFetchMessage("The scan is continuing in the background. Results will appear automatically.");
      } else if (result) {
        setModelFetchMessage(`Catalogue refreshed: ${result.scanned} models checked, ${result.verified} officially verified, ${result.images} official images updated.`);
      } else {
        setModelFetchMessage("Catalogue and retailer listings refreshed.");
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The model catalogue refresh failed.";
      setError(message);
      setModelFetchMessage(message);
    } finally {
      setModelFetching(false);
    }
  };
  const renderCatalogueControls = (resultCount: number) => (
    <div className="catalogue-controls" aria-label="Filter and sort racquets">
      <div className="catalogue-control-copy">
        <span className="settings-label">FIND YOUR SPEC</span>
        <strong>{resultCount} {resultCount === 1 ? "racquet" : "racquets"}</strong>
      </div>
      <label><span>Head size</span><select value={headSizeFilter} onChange={(event) => { setHeadSizeFilter(event.target.value as HeadSizeFilter); setCatalogueVisibleCount(cataloguePageSize); }}>
        <option value="all">Any head size</option>{availableHeadSizes.map((size) => <option value={String(size)} key={`head-${size}`}>{size} in²</option>)}
      </select></label>
      <label><span>Grip size</span><select value={data?.gripSize ?? "L3"} onChange={(event) => changeGripSize(event.target.value as GripSize)}>
        {gripOptions.map((option) => <option value={option.key} key={`filter-${option.key}`}>{option.key} — {option.inches}</option>)}
      </select></label>
      <label><span>Unstrung weight</span><select value={weightFilter} onChange={(event) => { setWeightFilter(event.target.value as WeightFilter); setCatalogueVisibleCount(cataloguePageSize); }}>
        <option value="all">Any weight</option><option value="light">Up to 295 g</option><option value="medium">296–300 g</option><option value="standard">301–305 g</option><option value="heavy">306 g and up</option>
      </select></label>
      <label><span>String pattern</span><select value={patternFilter} onChange={(event) => { setPatternFilter(event.target.value as PatternFilter); setCatalogueVisibleCount(cataloguePageSize); }}>
        <option value="all">Any pattern</option><option value="16x19">16 × 19 · open</option><option value="16x20">16 × 20 · tighter</option><option value="18x20">18 × 20 · dense</option><option value="other">Other patterns</option>
      </select></label>
      <label><span>Sort by</span><select value={catalogueSort} onChange={(event) => { setCatalogueSort(event.target.value as CatalogueSort); setCatalogueVisibleCount(cataloguePageSize); }}>
        <optgroup label="Recommended"><option value="featured">Featured order</option><option value="availability">Most widely stocked</option><option value="tour-presence">Tour presence: most represented</option><option value="discount">Biggest current discount</option></optgroup>
        <optgroup label="Style cues"><option value="style-distinctive">Style: bold & distinctive</option><option value="style-understated">Style: clean & understated</option></optgroup>
        <optgroup label="Name & price"><option value="name-asc">Name: A to Z</option><option value="name-desc">Name: Z to A</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></optgroup>
        <optgroup label="Specifications"><option value="stiffness-asc">Stiffness: softest to firmest</option><option value="stiffness-desc">Stiffness: firmest to softest</option><option value="head-asc">Head size: small to large</option><option value="head-desc">Head size: large to small</option><option value="weight-asc">Weight: light to heavy</option><option value="weight-desc">Weight: heavy to light</option></optgroup>
      </select></label>
      {!data?.publicPreview && <button className="model-fetch-button" onClick={fetchNewModels} disabled={modelFetching || checking}>
        <span className={modelFetching ? "spin" : ""} aria-hidden="true">+</span>
        {modelFetching ? "Fetching models..." : "Fetch new models"}
      </button>}
      {(headSizeFilter !== "all" || weightFilter !== "all" || patternFilter !== "all" || catalogueSort !== "featured") && <button className="clear-catalogue" onClick={clearCatalogueFilters}>Clear</button>}
      {modelFetchMessage && <p className="model-fetch-status" aria-live="polite">{modelFetchMessage}</p>}
      {catalogueSort === "availability" && <p className="catalogue-sort-note">Ranks distinct Canadian retailers with an in-stock listing. Comparable unit-sales totals are not publicly reported.</p>}
      {catalogueSort === "tour-presence" && <p className="catalogue-sort-note">Ranks manufacturer-reported professional representation for each endorsed racquet line.</p>}
      {(catalogueSort === "style-distinctive" || catalogueSort === "style-understated") && <p className="catalogue-sort-note">Style cues use the verified colour, model name and edition language where available. They are not a claim that one racquet looks better than another.</p>}
    </div>
  );

  const checkNow = async () => {
    if (data?.publicPreview) return;
    setChecking(true);
    setError("");
    try {
      const response = await fetch("/api/tracker?action=check", { method: "POST" });
      if (!response.ok) throw new Error("Price check failed. Please try again.");
      const next = await response.json() as Dashboard;
      setData(next);
      const newDrops = next.offers.filter((offer) =>
        offer.currentPrice !== null && offer.previousPrice !== null && offer.currentPrice < offer.previousPrice,
      );
      if (notifications && newDrops.length) {
        new Notification("Baseline found a price drop", {
          body: `${newDrops[0].title} is now ${money.format(newDrops[0].currentPrice ?? 0)} at ${newDrops[0].store}.`,
        });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Price check failed");
    } finally {
      setChecking(false);
    }
  };

  const toggleNotifications = async () => {
    if (!notifications) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
      localStorage.setItem("baseline-notifications", "on");
      setNotifications(true);
      new Notification("Baseline alerts are on", { body: "You’ll be notified when a fresh check finds a lower price." });
    } else {
      localStorage.setItem("baseline-notifications", "off");
      setNotifications(false);
    }
  };

  const saveTarget = async (modelKey: string, market: "new" | "used" = "new") => {
    const value = Number(targetDraft);
    if (!Number.isFinite(value) || value <= 0) return;
    if (data?.publicPreview) {
      setData((current) => {
        if (!current) return current;
        const next = market === "used"
          ? { ...current, usedTargets: { ...current.usedTargets, [modelKey]: value } }
          : { ...current, targets: { ...current.targets, [modelKey]: value } };
        writePublicPreferences(publicPreferencesFromDashboard(next));
        return next;
      });
      setEditing(null);
      return;
    }
    const response = await fetch("/api/tracker", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ modelKey, targetPrice: value, market }),
    });
    if (response.ok) setData(await response.json());
    setEditing(null);
  };

  const toggleRetailer = async (retailerKey: string, enabled: boolean) => {
    const response = await fetch("/api/tracker", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ retailerKey, enabled }),
    });
    if (response.ok) setData(await response.json());
  };

  const changeGripSize = async (gripSize: GripSize) => {
    setCatalogueVisibleCount(cataloguePageSize);
    if (data?.publicPreview) {
      setData((current) => {
        if (!current) return current;
        const next = { ...current, gripSize };
        writePublicPreferences(publicPreferencesFromDashboard(next));
        return next;
      });
      return;
    }
    const response = await fetch("/api/tracker", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ gripSize }),
    });
    if (response.ok) setData(await response.json());
  };

  const refreshSelectedModel = useCallback(async (modelKey: string) => {
    if (data?.publicPreview) return;
    const lastRefresh = modelRefreshTimes.current.get(modelKey) ?? 0;
    if (Date.now() - lastRefresh < 10 * 60 * 1000) return;
    modelRefreshTimes.current.set(modelKey, Date.now());
    setRefreshingModels((current) => new Set(current).add(modelKey));
    try {
      const response = await fetch(`/api/tracker?action=model&modelKey=${encodeURIComponent(modelKey)}`, { method: "POST" });
      if (response.ok) setData(await response.json());
      else modelRefreshTimes.current.delete(modelKey);
    } catch {
      modelRefreshTimes.current.delete(modelKey);
    } finally {
      setRefreshingModels((current) => {
        const next = new Set(current);
        next.delete(modelKey);
        return next;
      });
    }
  }, [data?.publicPreview]);

  const replaceFrame = async (slot: number, selectedModelKey: string) => {
    if (data?.publicPreview) {
      setData((current) => {
        if (!current) return current;
        const modelOrder = [...current.modelOrder];
        if (modelOrder.some((modelKey, index) => index !== slot && modelKey === selectedModelKey)) return current;
        modelOrder[slot] = selectedModelKey;
        const next = { ...current, modelOrder };
        writePublicPreferences(publicPreferencesFromDashboard(next));
        return next;
      });
      return;
    }
    const response = await fetch("/api/tracker", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slot, selectedModelKey }),
    });
    if (response.ok) setData(await response.json());
    void refreshSelectedModel(selectedModelKey);
  };

  const replaceFeaturedFrame = async (featuredBrand: Exclude<BrandKey, "all">, featuredSlot: number, selectedModelKey: string) => {
    const response = await fetch("/api/tracker", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ featuredBrand, featuredSlot, selectedModelKey }),
    });
    if (response.ok) setData(await response.json());
    void refreshSelectedModel(selectedModelKey);
  };

  const changeMarket = (market: MarketTab) => {
    setActiveMarket(market);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const toggleCompare = (modelKey: string) => {
    const isAdding = !compareKeys.includes(modelKey) && compareKeys.length < maxCompareFrames;
    if (isAdding) void refreshSelectedModel(modelKey);
    setCompareKeys((current) => current.includes(modelKey)
      ? current.filter((key) => key !== modelKey)
      : current.length < maxCompareFrames ? [...current, modelKey] : current);
  };

  const compareCoachPicks = (modelKeys: string[]) => {
    const uniqueKeys = [...new Set(modelKeys)].slice(0, maxCompareFrames);
    setActiveMarket("retail");
    setCompareKeys(uniqueKeys);
    setComparisonOpen(uniqueKeys.length >= 2);
    uniqueKeys.forEach((modelKey) => { void refreshSelectedModel(modelKey); });
  };

  const renderPatternBadge = (modelKey: string, compact = false) => {
    const pattern = patternPresentation(resolvedRacquetSpecs[modelKey]?.pattern);
    if (!pattern) return null;
    return <span className={`pattern-badge pattern-${pattern.tone} ${compact ? "compact" : ""}`} title={`String pattern: ${pattern.label}`}>
      <strong>{pattern.label}</strong><small>{pattern.detail}</small>
    </span>;
  };

  const renderSourceHealth = () => data?.sourceHealth ? <div className={`source-health ${data.sourceHealth.failures ? "partial" : "healthy"}`} aria-label="Price data health">
    <span className="source-health-state"><i />{data.sourceHealth.failures ? "PARTIAL SCAN" : "ALL SYSTEMS LIVE"}</span>
    <span><strong>{data.sourceHealth.freshOffers}</strong> fresh offers</span>
    {!data.publicPreview && <details>
      <summary>Data details</summary>
      <div className="source-health-details">
        <span><strong>{data.sourceHealth.liveSources}/{data.sourceHealth.totalSources}</strong> sources responded</span>
        {data.sourceHealth.staleOffers > 0 && <span className="source-health-stale"><strong>{data.sourceHealth.staleOffers}</strong> last verified</span>}
        <span>Updated <strong>{relativeTime(data.lastCheck?.checkedAt)}</strong></span>
      </div>
    </details>}
  </div> : null;

  const renderModelCard = (modelKey: string, index: number, featured = false) => {
    const offers = (data?.offers ?? []).filter((offer) => offer.modelKey === modelKey);
    const inStock = offers.filter((offer) => offer.inStock && offer.currentPrice !== null)
      .sort((a, b) => (a.currentPrice ?? Infinity) - (b.currentPrice ?? Infinity));
    const release = data?.modelOptions.find((option) => option.key === modelKey);
    const preorderOffers = offers.filter((offer) => offer.currentPrice !== null && /pre[- ]?order|preorder|reserve now|coming soon/i.test(offer.title));
    const available = uniqueRetailerOffers([...inStock, ...preorderOffers]);
    const best = available[0];
    const target = data?.targets[modelKey] ?? 0;
    const belowTarget = Boolean(best && best.currentPrice !== null && best.currentPrice <= target);
    const history = (data?.history ?? []).filter((row) => row.modelKey === modelKey).slice(0, 8).reverse();
    const max = Math.max(...history.map((row) => row.price), 1);
    const min = Math.min(...history.map((row) => row.price), max);
    const selected = compareKeys.includes(modelKey);
    const compareFull = compareKeys.length >= maxCompareFrames && !selected;
    return (
      <article className={`model-card ${accents[modelKey] ?? "blue"}`} key={`${modelKey}-${index}`} style={{ "--delay": `${index * 70}ms` } as React.CSSProperties}>
        <div className="card-top">
          <span className="model-number">{featured && activeBrand !== "all" ? "FEATURED" : String(index + 1).padStart(2, "0")}</span>
          <div className="card-controls">
            <button className={`compare-toggle ${selected ? "selected" : ""}`} disabled={compareFull} onClick={() => toggleCompare(modelKey)}>{selected ? "✓ Compare" : "+ Compare"}</button>
            <span className={`deal-pill ${belowTarget ? "hit" : release?.releaseStatus === "preorder" ? "preorder" : release?.releaseStatus === "new" ? "new-release" : ""}`}>{belowTarget ? "Target hit" : release?.releaseLabel ?? "Watching"}</span>
          </div>
        </div>
        <div className="model-identity">
          <div><span className="brand-kicker">{modelBrand(modelKey)}</span><h3>{data?.modelNames[modelKey] ?? modelKey}</h3>{resolvedRacquetSpecs[modelKey] && <span className="card-specs">{[standardizedSpecDisplay("head", resolvedRacquetSpecs[modelKey].head, false), standardizedSpecDisplay("weight", resolvedRacquetSpecs[modelKey].weight, false), resolvedRacquetSpecs[modelKey].stiffness].filter(Boolean).join(" · ")}</span>}{renderPatternBadge(modelKey)}{refreshingModels.has(modelKey) && <span className="model-refresh-state" role="status"><i />Refreshing specs &amp; photo…</span>}{activeBrand === "catalogue" && <span className="card-spec-source"><span>Specs: {resolvedRacquetSpecs[modelKey]?.source ?? "Catalogue fallback"}</span><i className={`spec-validation ${validationPresentation(data?.specValidation?.[modelKey]).tone}`}>{validationPresentation(data?.specValidation?.[modelKey]).label}</i></span>}</div>
          {racquetImage(modelKey, "model-thumbnail", 122, 158, `${data?.modelNames[modelKey] ?? modelKey} racquet`, "122px")}
        </div>
        <div className="price-row">
          <div><span className="price-label">{best?.sourceState === "stale" ? "LAST VERIFIED PRICE" : release?.releaseStatus === "preorder" ? "BEST PRE-ORDER PRICE" : "BEST IN-STOCK PRICE"}</span><strong className="price">{best?.currentPrice != null ? money.format(best.currentPrice) : "—"}</strong></div>
          <div className="sparkbars" aria-label="Recent lowest price trend">
            {history.length ? history.map((row, i) => <i key={`${row.checkedAt}-${i}`} style={{ height: `${28 + ((max - row.price) / Math.max(max - min, 1)) * 42}%` }} />) : <span>No history yet</span>}
          </div>
        </div>
        <div className="target-row">
          <span>Alert me under</span>
          {editing === modelKey ? (
            <form onSubmit={(event) => { event.preventDefault(); saveTarget(modelKey); }}>
              <label><span>$</span><input autoFocus inputMode="decimal" value={targetDraft} onChange={(event) => setTargetDraft(event.target.value)} aria-label="Target price in Canadian dollars" /></label>
              <button type="submit">Save</button>
            </form>
          ) : <button className="target-button" onClick={() => { setEditing(modelKey); setTargetDraft(String(target)); }}>{money.format(target)} <span>edit</span></button>}
        </div>
        <div className="offers">
          {loading ? <div className="loading-line" /> : available.length ? available.slice(0, 3).map((offer, offerIndex) => {
            const dropped = offer.previousPrice !== null && offer.currentPrice !== null && offer.currentPrice < offer.previousPrice;
            return <a href={offer.url} target="_blank" rel="noreferrer" className="offer" key={offer.id} onClick={() => trackAnalytics("deal_open")}>
              <span className="rank">{offerIndex + 1}</span><span className="store"><strong>{offer.store}</strong><small>{offer.sourceState === "stale" ? `Last verified ${relativeTime(offer.lastChecked)}` : offer.gripSizes.length ? `${offer.gripSizes.length} grip sizes` : "Check grip sizes"}</small></span>
              <span className="offer-price"><strong>{money.format(offer.currentPrice ?? 0)}</strong>{dropped && <small>↓ {money.format((offer.previousPrice ?? 0) - (offer.currentPrice ?? 0))}</small>}</span><span className="arrow" aria-hidden="true">↗</span>
            </a>;
          }) : <p className="empty">{release?.releaseStatus === "preorder" ? "No Canadian pre-order match found yet. Baseline will keep checking." : "No in-stock match found today."}</p>}
        </div>
        {available.length > 0 && <button className="all-retailers-button" onClick={() => setRetailerModelKey(modelKey)}>
          <span>Browse every retailer</span><strong>{available.length} {available.length === 1 ? "store" : "stores"}</strong><i aria-hidden="true">→</i>
        </button>}
      </article>
    );
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href={activeMarket === "retail" ? "#top" : "#used-top"} aria-label="Baseline home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          BASELINE
        </a>
        <nav className="market-tabs" aria-label="Marketplace view">
          <button className={activeMarket === "retail" ? "active" : ""} aria-pressed={activeMarket === "retail"} onClick={() => changeMarket("retail")}>New retail</button>
          <button className={activeMarket === "used" ? "active" : ""} aria-pressed={activeMarket === "used"} onClick={() => changeMarket("used")}>Used market</button>
        </nav>
        <div className="top-actions">
          <span className="status-dot"><i /> {activeMarket === "retail" ? `Watching ${data?.stores.length ?? 5} stores` : `${data?.usedOffers.length ?? 0} verified used listings`}</span>
          {data?.publicPreview && <span className="beta-badge">Public beta</span>}
          {!data?.publicPreview && <button className="analytics-button" onClick={openAnalytics}>Analytics</button>}
          <label className="top-grip-select">
            <span>Grip</span>
            <select value={data?.gripSize ?? "L3"} onChange={(event) => changeGripSize(event.target.value as GripSize)} aria-label="Preferred grip size">
              {gripOptions.map((option) => <option value={option.key} key={`top-${option.key}`}>{option.key} — {option.inches}</option>)}
            </select>
          </label>
          <button className="settings-button" onClick={() => setSettingsOpen(true)} aria-label={data?.publicPreview ? "Open my Baseline preferences" : "Open tracker settings"}><span className="settings-desktop-label">{data?.publicPreview ? "My picks" : "Settings"}</span><span className="settings-mobile-label" aria-hidden="true">☰</span></button>
          {activeMarket === "retail" ? (
            !data?.publicPreview && <button className={`alert-toggle ${notifications ? "on" : ""}`} onClick={toggleNotifications}>
              <span aria-hidden="true">{notifications ? "●" : "○"}</span>
              {notifications ? "Alerts on" : "Turn on alerts"}
            </button>
          ) : <a className="alert-toggle buyer-link" href="#buyer-checklist">Buyer checklist</a>}
        </div>
      </header>

      {analyticsOpen && !data?.publicPreview && (
        <div className="analytics-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAnalyticsOpen(false); }}>
          <section className="analytics-panel" role="dialog" aria-modal="true" aria-labelledby="analytics-title">
            <div className="analytics-head"><div><p className="eyebrow">PRIVATE BETA SIGNALS</p><h2 id="analytics-title">Baseline analytics</h2><p>Aggregate counts only. No accounts, names, IP addresses, or individual browsing histories are stored.</p></div><button onClick={() => setAnalyticsOpen(false)} aria-label="Close analytics">×</button></div>
            {analyticsLoading ? <p className="analytics-loading">Loading analytics…</p> : analytics ? <>
              <div className="analytics-kpis">
                <div><span>Page views</span><strong>{analytics.totals.pageViews}</strong><small>last {analytics.windowDays || 1} days</small></div>
                <div><span>Retailer clicks</span><strong>{analytics.totals.dealOpens}</strong><small>outbound deal visits</small></div>
                <div><span>Store comparisons</span><strong>{analytics.totals.retailerOpens}</strong><small>all-retailer views</small></div>
                <div><span>Comparisons</span><strong>{analytics.totals.comparisons}</strong><small>side-by-side opens</small></div>
              </div>
              <section className="analytics-section"><div><span className="settings-label">DAILY MOMENTUM</span><strong>Visits and retailer clicks</strong></div><div className="analytics-days">{analytics.daily.length ? analytics.daily.map((day) => <div key={day.date}><span style={{ height: `${Math.max(7, Math.min(100, day.pageViews * 12))}%` }} title={`${day.pageViews} page views`} /><i style={{ height: `${Math.max(4, Math.min(100, day.dealOpens * 18))}%` }} title={`${day.dealOpens} retailer clicks`} /><small>{day.date.slice(5)}</small></div>) : <p>Collection starts with this release. Check back after beta visitors have used the app.</p>}</div></section>
              <section className="analytics-section analytics-split"><div><span className="settings-label">WHAT PEOPLE BROWSE</span>{analytics.sections.length ? <ol>{analytics.sections.slice(0, 6).map((item) => <li key={item.section}><span>{item.section.replaceAll("-", " ")}</span><b>{item.count}</b></li>)}</ol> : <p>No section changes recorded yet.</p>}</div><div><span className="settings-label">TRACKER HEALTH</span><ol><li><span>Fresh listings</span><b>{analytics.operations.freshOffers}</b></li><li><span>Retailer sources live</span><b>{analytics.operations.liveSources}/{analytics.operations.totalSources}</b></li><li><span>Price drops, 24h</span><b>{analytics.operations.dropsLast24Hours}</b></li><li><span>Baseline Coach opens</span><b>{analytics.totals.coachOpens}</b></li></ol></div></section>
              <p className="analytics-note">Analytics began {new Date(analytics.startedAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}. Counts are event totals, not a claim of unique people.</p>
            </> : <p className="analytics-loading">No analytics snapshot is available yet.</p>}
          </section>
        </div>
      )}

      {settingsOpen && (
        <div className="settings-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
          <aside className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="settings-panel-head">
              <div><p className="eyebrow">{data?.publicPreview ? "YOUR BASELINE" : "BASELINE CONTROL ROOM"}</p><h2 id="settings-title">{data?.publicPreview ? "My picks" : "Settings"}</h2></div>
              <button className="close-settings" onClick={() => setSettingsOpen(false)} aria-label="Close settings">×</button>
            </div>
            <div className="settings-block">
              <span className="settings-label">YOUR TOP FRAMES</span>
              <p className="settings-help">These six frames appear on My watchlist. {data?.publicPreview ? "They are saved only in this browser." : "Choose any six unique tracked models."}</p>
              <div className="retailer-list">
                {(data?.modelOrder ?? []).map((modelKey, slot) => (
                  <label className="retailer-toggle" key={`slot-${slot}`}>
                    <span><strong>Slot {slot + 1}</strong><small>{data?.modelNames[modelKey] ?? modelKey}</small></span>
                    <select value={modelKey} onChange={(event) => replaceFrame(slot, event.target.value)} aria-label={`Replace frame slot ${slot + 1}`}>
                      <optgroup label="Top-rated & available">
                        {sortedModelOptions.filter((option) => option.topRated).map((option) => (
                          <option value={option.key} key={option.key} disabled={data?.modelOrder.some((selected, selectedSlot) => selectedSlot !== slot && selected === option.key)}>{option.name}</option>
                        ))}
                      </optgroup>
                      <optgroup label="More tracked frames">
                        {sortedModelOptions.filter((option) => !option.topRated).map((option) => (
                          <option value={option.key} key={option.key} disabled={data?.modelOrder.some((selected, selectedSlot) => selectedSlot !== slot && selected === option.key)}>{option.name}</option>
                        ))}
                      </optgroup>
                    </select>
                  </label>
                ))}
              </div>
            </div>
            {!data?.publicPreview && <div className="settings-block">
              <span className="settings-label">FEATURED BY BRAND</span>
              <p className="settings-help">Choose the six main racquets shown at the top of each brand page. The remaining models automatically stay under Other suggestions.</p>
              <div className="brand-settings">
                {alphabeticalBrandList.map((brand) => (
                  <section className="brand-setting-group" key={brand}>
                    <div className="brand-setting-head"><strong>{brand}</strong><span>6 featured frames</span></div>
                    {(data?.brandPicks?.[brand] ?? featuredByBrand[brand]).map((modelKey, slot) => (
                      <label className="brand-frame-select" key={`${brand}-${slot}`}>
                        <span>{slot + 1}</span>
                        <select value={modelKey} onChange={(event) => replaceFeaturedFrame(brand, slot, event.target.value)} aria-label={`${brand} featured frame ${slot + 1}`}>
                          {sortedModelOptions.filter((option) => modelBrand(option.key) === brand).map((option) => (
                            <option value={option.key} key={option.key} disabled={(data?.brandPicks?.[brand] ?? featuredByBrand[brand]).some((selected, selectedSlot) => selectedSlot !== slot && selected === option.key)}>{option.name.replace(`${brand} `, "")}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </section>
                ))}
              </div>
            </div>}
            <div className="settings-block">
              <span className="settings-label">GRIP SIZE</span>
              <p className="settings-help">{data?.publicPreview ? "Use your preferred grip while browsing. It is saved only in this browser." : "Choose the grip Baseline should require across new stock, used listings, marketplace searches and alerts. The next scheduled or manual check refreshes all results."}</p>
              <label className="grip-setting">
                <span><strong>Required grip</strong><small>{gripLabel(data?.gripSize ?? "L3")}</small></span>
                <select value={data?.gripSize ?? "L3"} onChange={(event) => changeGripSize(event.target.value as GripSize)} aria-label="Required racquet grip size">
                  {gripOptions.map((option) => <option value={option.key} key={option.key}>{option.key} — {option.inches}</option>)}
                </select>
              </label>
            </div>
            {!data?.publicPreview && <div className="settings-block">
              <span className="settings-label">CHECK FREQUENCY</span>
              <div className="frequency-card"><strong>Every 3 hours</strong><span>Automatic checks run every 3 hours. You can still check manually anytime.</span></div>
            </div>}
            <div className="settings-block">
              <span className="settings-label">APP ON THIS DEVICE</span>
              <div className={`install-card ${installContext}`}>
                <span className="install-card-icon" aria-hidden="true">B</span>
                <span className="install-card-copy">
                  <strong>{installContext === "native" || installContext === "installed" ? "Baseline is installed" : "Install Baseline"}</strong>
                  <small>{installContext === "native" ? "Running in the native mobile app." : installContext === "installed" ? "It opens from your home screen like an app." : installContext === "ios" ? "In Safari, tap Share, then Add to Home Screen." : installPrompt ? "Add it to your home screen for a full-screen app experience." : "Open your browser menu and choose Install app or Add to Home screen."}</small>
                </span>
                {installPrompt && installContext === "browser" && <button onClick={installBaseline}>Install</button>}
                {(installContext === "native" || installContext === "installed") && <i aria-label="Installed">✓</i>}
              </div>
              <a className="settings-privacy-link" href="/privacy">Read the Baseline privacy policy →</a>
            </div>
            {!data?.publicPreview && <div className="settings-block">
              <span className="settings-label">USED MARKETPLACES</span>
              <p className="settings-help">Public listing collectors run every three hours. Facebook uses an isolated browser with no saved account password; exact grip evidence is still required before an ad appears.</p>
              <div className="marketplace-health">
                {marketplaceHealth.map((source) => (
                  <div className="marketplace-health-row" key={source.name}>
                    <span><strong>{source.name}</strong><small>{!source.configured ? "Automated connector needs API credentials" : source.checked ? `${source.offers} matching listings this check` : "Waiting for first check"}</small></span>
                    <i className={source.online ? "online" : "offline"}>{!source.configured ? "Setup" : source.online ? "Live" : "Unavailable"}</i>
                  </div>
                ))}
              </div>
            </div>}
            {!data?.publicPreview && <div className="settings-block">
              <span className="settings-label">RETAILERS</span>
              <p className="settings-help">Canadian retailers and outlets are listed below. Stores with dependable public price, stock, and grip data are checked automatically; catalogue-only stores open directly.</p>
              <div className="retailer-list">
                {sortedRetailers.map((retailer) => retailer.kind === "manual" ? (
                  <div className="retailer-toggle manual-retailer" key={retailer.key}>
                    <span>
                      <strong>{retailer.name}</strong>
                      <small>Store directory · no reliable public grip feed</small>
                    </span>
                    <a className="manual-store-link" href={retailer.url} target="_blank" rel="noreferrer">Open store ↗</a>
                  </div>
                ) : (
                  <label className="retailer-toggle" key={retailer.key}>
                    <span>
                      <strong>{retailer.name}</strong>
                      {retailer.kind === "amazon" && <small>Best-effort marketplace search</small>}
                      {retailer.kind === "woocommerce" && <small>Automated catalog feed</small>}
                      {retailer.kind === "lightspeed" && <small>Automated variant catalog</small>}
                      {retailer.kind === "wix" && <small>Automated grip-level catalog scan</small>}
                      {retailer.kind === "structured" && <small>Best-effort public catalog scan</small>}
                    </span>
                    <input type="checkbox" checked={retailer.enabled} onChange={(event) => toggleRetailer(retailer.key, event.target.checked)} />
                    <i aria-hidden="true" />
                  </label>
                ))}
              </div>
            </div>}
            {!data?.publicPreview && <p className="settings-footnote">Racquet matches are filtered to the selected {gripLabel(data?.gripSize ?? "L3")} grip across new, used, special-edition and alert views. String, ball and accessory catalogues are not grip-specific. Amazon can throttle automated searches, so those feeds may occasionally report no results.</p>}
          </aside>
        </div>
      )}

      {activeMarket === "retail" ? <>
      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">CANADIAN RACQUET PRICE TRACKER</p>
          <h1>Wait for the<br /><em>right bounce.</em></h1>
          <p className="lede">Baseline watches the frames on your shortlist, checks enabled Canadian retailers every 3 hours, and calls the shot when the price drops.</p>
          <div className="hero-actions">
            {data?.publicPreview ? <span className="public-refresh-note">Prices refresh automatically<br /><strong>Every 3 hours</strong></span> : <button className="check-button" onClick={checkNow} disabled={checking}>
              <span className={checking ? "spin" : ""} aria-hidden="true">↻</span>
              {checking ? "Checking stores…" : "Check prices now"}
            </button>}
            <span className="last-check">Last checked<br /><strong>{relativeTime(data?.lastCheck?.checkedAt)}</strong></span>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
        </div>
        <div className="court-card opportunity-court" aria-label="Best opportunity right now">
          <div className="court-lines"><span /><span /><span /></div>
          <div className="opportunity-panel">
            <span className="opportunity-kicker">BEST PRICE FINDER</span>
            <div className="opportunity-modes" aria-label="Choose best-price ranking">
              {opportunityChoices.map((choice) => <button key={choice.mode} className={selectedOpportunity?.mode === choice.mode ? "active" : ""} onClick={() => setOpportunityMode(choice.mode)}>{choice.label}</button>)}
            </div>
            {selectedOpportunity ? <>
              <strong className="opportunity-model">{data?.modelNames[selectedOpportunity.offer.modelKey] ?? selectedOpportunity.offer.title}</strong>
              <div className="opportunity-price">
                <strong>{money.format(selectedOpportunity.offer.currentPrice ?? 0)}</strong>
                <span>at {selectedOpportunity.offer.store}</span>
              </div>
              <div className="opportunity-badges">
                {renderPatternBadge(selectedOpportunity.offer.modelKey, true)}
                {selectedOpportunity.watchlist && <span className={selectedOpportunity.delta <= 0 ? "target-hit" : ""}>
                  {money.format(Math.abs(selectedOpportunity.delta))} {selectedOpportunity.delta <= 0 ? "below target" : "above target"}
                </span>}
                <span>{selectedOpportunity.stores} {selectedOpportunity.stores === 1 ? "retailer" : "retailers"}</span>
                {selectedOpportunity.mode === "tour" && (selectedOpportunity.tourPresence ?? 0) > 0 && <span>{selectedOpportunity.tourPresence} reported tour players</span>}
                {Number.isFinite(selectedOpportunity.offer.compareAtPrice) && selectedOpportunity.offer.currentPrice !== null
                  && (selectedOpportunity.offer.compareAtPrice ?? 0) > 0
                  && selectedOpportunity.offer.compareAtPrice > selectedOpportunity.offer.currentPrice
                  && <span>{Math.round((1 - selectedOpportunity.offer.currentPrice / selectedOpportunity.offer.compareAtPrice) * 100)}% off retail</span>}
              </div>
              <div className="opportunity-actions">
                <a className="opportunity-link" href={selectedOpportunity.offer.url} target="_blank" rel="noreferrer">View deal <span aria-hidden="true">↗</span></a>
                <button className="opportunity-compare" onClick={() => setRetailerModelKey(selectedOpportunity.offer.modelKey)}>All retailers</button>
              </div>
            </> : <p className="opportunity-empty">{loading ? "Finding today’s best opportunity…" : "No verified in-stock opportunity yet."}</p>}
          </div>
          <div className="summary-copy opportunity-stats">
            <span><strong>{data?.dropsLast24Hours ?? 0}</strong> drops in 24h</span>
            <span><strong>{data?.lastCheck?.offersFound ?? 0}</strong> verified listings</span>
            <span><strong>{data?.lastCheck?.storesChecked ?? 0}</strong> retailers checked</span>
          </div>
        </div>
      </section>

      <section className="watchlist" id="browse-market">
        <div className="browse-navigation">
          <nav className="brand-nav" aria-label="Browse equipment categories">
            <button className={activeBrand === "all" ? "active" : ""} aria-pressed={activeBrand === "all"} onClick={() => setActiveBrand("all")}>My watchlist</button>
            <button className={activeBrand === "catalogue" || brandList.includes(activeBrand as Exclude<BrandKey, "all">) ? "active" : ""} aria-pressed={activeBrand === "catalogue" || brandList.includes(activeBrand as Exclude<BrandKey, "all">)} onClick={() => { setActiveBrand("catalogue"); setCatalogueVisibleCount(cataloguePageSize); }}>Racquets</button>
            <button className={activeBrand === "special" ? "active" : ""} aria-pressed={activeBrand === "special"} onClick={() => setActiveBrand("special")}>Special editions</button>
            <button className={activeBrand === "strings" ? "active" : ""} aria-pressed={activeBrand === "strings"} onClick={() => { setActiveBrand("strings"); setStringVisibleCount(stringPageSize); }}>Strings</button>
            <button className={activeBrand === "balls" ? "active" : ""} aria-pressed={activeBrand === "balls"} onClick={() => { setActiveBrand("balls"); setBallVisibleCount(ballPageSize); }}>Balls</button>
            <button className={activeBrand === "accessories" ? "active" : ""} aria-pressed={activeBrand === "accessories"} onClick={() => { setActiveBrand("accessories"); setAccessoryVisibleCount(accessoryPageSize); }}>Accessories</button>
            <button className={activeBrand === "guide" ? "active" : ""} aria-pressed={activeBrand === "guide"} onClick={() => setActiveBrand("guide")}>Racquet guide</button>
            <button className={activeBrand === "string-guide" ? "active" : ""} aria-pressed={activeBrand === "string-guide"} onClick={() => setActiveBrand("string-guide")}>String guide</button>
          </nav>
          {(activeBrand === "catalogue" || brandList.includes(activeBrand as Exclude<BrandKey, "all">)) && <label className="racquet-brand-picker">
            <span>Brand</span>
            <select value={activeBrand} onChange={(event) => { setActiveBrand(event.target.value as BrandViewKey); setCatalogueVisibleCount(cataloguePageSize); }} aria-label="Choose a racquet brand">
              <option value="catalogue">All brands</option>
              {alphabeticalBrandList.map((brand) => <option value={brand} key={brand}>{brand}</option>)}
            </select>
          </label>}
        </div>
        {renderSourceHealth()}
        <div className="section-heading">
          <div>
            <p className="eyebrow">{activeBrand === "all" ? "YOUR WATCHLIST" : activeBrand === "catalogue" ? "THE COMPLETE MARKET" : activeBrand === "special" ? "LIMITED COLOURWAYS & COLLABORATIONS" : activeBrand === "strings" ? "CANADIAN TENNIS STRING MARKET" : activeBrand === "balls" ? "CANADIAN TENNIS BALL MARKET" : activeBrand === "accessories" ? "RACQUET ACCESSORIES ACROSS CANADA" : activeBrand === "guide" ? "THE RACQUET TRANSLATOR" : activeBrand === "string-guide" ? "THE STRING TRANSLATOR" : `${activeBrand.toUpperCase()} RACQUETS`}</p>
            <h2>{activeBrand === "all" ? "Six frames. Best price wins." : activeBrand === "catalogue" ? "All racquets. One searchable market." : activeBrand === "special" ? "Special editions in every available grip." : activeBrand === "strings" ? "Find the right feel, type, and gauge." : activeBrand === "balls" ? "The right ball for every court." : activeBrand === "accessories" ? "Everything around the frame, in one place." : activeBrand === "guide" ? "What racquet numbers feel like on court." : activeBrand === "string-guide" ? "What to put in the frame." : `The best of ${activeBrand}, in one place.`}</h2>
          </div>
          <div className="legend">{activeBrand === "special" ? <><span className="special-dot" /> Verified grip-level stock <span className="stock-dot" /> In stock</> : activeBrand === "strings" ? <><span className="string-dot" /> Canadian prices <span className="stock-dot" /> In stock</> : activeBrand === "balls" ? <><span className="string-dot" /> Package-matched prices <span className="stock-dot" /> In stock</> : activeBrand === "accessories" ? <><span className="accessory-dot" /> Canadian prices <span className="stock-dot" /> In stock</> : activeBrand === "guide" || activeBrand === "string-guide" ? <><span className="string-dot" /> Plain language <span className="stock-dot" /> Published specs vary by setup</> : <><span className="deal-dot" /> Below target <span className="stock-dot" /> In stock</>}</div>
        </div>

        {activeBrand === "guide" ? (
          <section className="racquet-guide" aria-label="Racquet specification guide">
            <p className="guide-intro">Use this as a translation layer for the comparison tool. Specifications describe tendencies—not guarantees—and the right combination matters more than any one number.</p>
            <div className="guide-grid">
              {[
                ["Head size", "The size of the hitting area.", "97–98 in² rewards clean contact and precision; 100 in² is the versatile middle; 102+ in² gives a larger margin for error and easier depth."],
                ["Unstrung weight", "How heavy the frame is before strings and an overgrip.", "Lighter frames are easier to accelerate; 300–305 g suits many intermediate players; 310 g+ adds stability but asks more of your timing and strength."],
                ["Balance", "Where the mass sits along the frame.", "Head-light feels faster at net and on quick changes; head-heavy can add plow-through and easy depth. Compare it with weight, not alone."],
                ["Swingweight", "How heavy the racquet feels while swinging.", "A higher swingweight is steadier against pace and can add ball weight; a lower number is easier to whip and recover. This often matters more than static weight."],
                ["Stiffness / RA", "How much the frame resists bending on impact.", "Lower RA generally feels softer with more flex; higher RA tends to feel crisper and more direct. String choice, tension and sample variation also change comfort."],
                ["String pattern", "The number of main and cross strings.", "16 × 19 is a familiar open, all-court pattern; 16 × 20 is slightly tighter; 18 × 20 is denser for a more controlled, connected response."],
                ["Beam width", "The thickness of the frame.", "A thinner beam often emphasizes feel and control; a wider beam usually brings more inherent power. The layup and stiffness still matter."],
                ["Length", "Most adult racquets are 27 in.", "Extended lengths can offer reach and leverage, but may feel less maneuverable. Standard length is the easiest baseline for comparison."],
                ["Grip size", "The circumference of the handle.", "Choose the grip you can hold relaxed without the handle shifting. Baseline filters each listing by the grip size shown by the retailer—availability is separate from frame fit."],
                ["Colour & style", "An honest part of choosing a racquet.", "Use the bold, understated and iconic style cues to narrow a big catalogue. They use verified colours, model names and editions where available; they never override a safety or fit concern."],
              ].map(([title, definition, translation]) => <article className="guide-card" key={title}><span>SPEC</span><h3>{title}</h3><strong>{definition}</strong><p>{translation}</p></article>)}
            </div>
            <p className="guide-note">Manufacturer specifications are Baseline’s primary record and matching Canadian retailer listings provide a secondary check. Strung weight, balance, swingweight and RA can vary by setup, sample and generation.</p>
          </section>
        ) : activeBrand === "string-guide" ? (
          <section className="racquet-guide string-guide" aria-label="Tennis string selection guide">
            <div className="guide-section-heading"><span>STRING TRANSLATOR</span><h3>What to put in the frame.</h3><p>Start with comfort and playing frequency, then refine feel, durability and spin. The same string can play very differently at another tension or in another racquet.</p></div>
            <div className="guide-grid">
              {[
                ["Polyester / monofilament", "Durable, controlled and spin-friendly.", "Usually best for players who swing fast and break strings. It can feel firmer, so it is rarely the first choice for a tender arm or a newer player."],
                ["Multifilament", "Soft, elastic and power-friendly.", "A strong default for comfort and easy depth. It loses durability sooner than polyester but is often kinder to the arm."],
                ["Natural gut", "Premium comfort, feel and tension stability.", "Exceptionally elastic and lively, but expensive and more sensitive to moisture. Often used alone or in a hybrid."],
                ["Synthetic gut", "Simple, balanced and usually affordable.", "A practical starting point when you want a neutral response without committing to a very soft multi or firm poly."],
                ["Hybrid", "Two strings working together.", "Commonly polyester in the mains for control and a softer string in the crosses for feel. The mains influence the overall feel the most."],
                ["Gauge", "The thickness of the string.", "A lower gauge number is thicker: generally more durable and firmer. A higher number is thinner: generally more feel, bite and comfort, with less durability."],
                ["Tension", "How tightly the string is installed.", "Lower tension generally adds pocketing, comfort and easy depth; higher tension generally feels firmer and more controlled. Stay within the racquet’s printed range."],
                ["When to restring", "Broken strings are not the only signal.", "Strings lose resilience before they break. Regular players often restring about as many times per year as they play per week; treat that as a starting point, not a rule."],
              ].map(([title, definition, translation]) => <article className="guide-card string-guide-card" key={title}><span>STRING</span><h3>{title}</h3><strong>{definition}</strong><p>{translation}</p></article>)}
            </div>
            <section className="string-guide-examples" aria-labelledby="string-guide-examples-title"><div className="guide-section-heading"><span>LIVE CANADIAN EXAMPLES</span><h3 id="string-guide-examples-title">Examples from the current market.</h3><p>These examples refresh with the catalogue. Package format matters: a set, half set and reel are not interchangeable prices.</p></div><div className="string-guide-example-grid">{stringGuideExamples.map((group) => <a href={group.bestOffer.url} target="_blank" rel="noreferrer" key={group.key}><span>{group.type} · {group.format}</span><strong>{group.title}</strong><small>{group.gauges.join(", ") || "Gauge not listed"} · {group.bestOffer.store}</small><b>{money.format(group.bestOffer.currentPrice ?? 0)} ↗</b></a>)}</div></section>
            <details className="string-guide-advanced"><summary><span><b>Advanced string lab</b><small>Construction, gauge, tension, hybrids and maintenance</small></span><i aria-hidden="true">+</i></summary><div className="string-guide-advanced-body"><section><h3>Construction & shape</h3><p>Round polyester tends to slide and snap back consistently; shaped or textured polyester can increase friction on the ball, but it may also notch sooner. Multis and gut use many filaments for elasticity; their comfort comes with less resistance to frequent string breakers.</p></section><section><h3>Gauge & durability</h3><p>Lower gauge numbers are thicker. For example, 16 gauge generally lasts longer than 17 gauge, while 17 gauge can offer more bite and feel. A thicker string is not automatically better if it makes the response too firm for your arm.</p></section><section><h3>Tension & response</h3><p>Lower tension usually increases pocketing, launch and comfort; higher tension usually tightens the response and reduces launch. Change only a small amount at once—about 1–2 lb—so you can feel the difference. Always stay within the racquet&apos;s recommended range.</p></section><section><h3>Hybrid logic</h3><p>Mains usually dominate the feel because they move most. Poly mains plus multi or gut crosses is a common control/comfort hybrid. Softer mains with poly crosses can preserve more feel while adding directional control.</p></section><section><h3>Weather & maintenance</h3><p>Heat, cold and long periods in a car can accelerate tension loss. Cut a broken string bed out promptly to reduce uneven stress on the frame. If strings feel dead or harsh before breaking, it is reasonable to restring rather than wait for failure.</p></section></div></details>
            <p className="guide-note">For a sore arm, avoid escalating to a full polyester setup simply for durability. If pain persists, stop playing and speak with a qualified professional.</p>
            <aside className="stringer-recommendation"><span>LOCAL STRINGER RECOMMENDATION</span><h3>Your Local ATP/WTA Tour Stringer</h3><p>Get your racquets strung by an ATP/WTA Tour Stringer who just strung at this year&apos;s National Bank Open, right here in Mississauga/Oakville.</p><p>Plus, an unbeatable 30-minute turnaround. Located at Erin Mills and Dundas.</p><a href="https://www.gaostringinglab.com/" target="_blank" rel="noreferrer">Learn about Richard Gao&apos;s stringing services ↗</a></aside>
          </section>
        ) : activeBrand === "strings" ? (
          <section className="string-market" aria-label="Tennis strings categorized by construction type and gauge">
            <div className="string-market-summary">
              <div><span>STRING PRODUCTS</span><strong>{stringStats.products}</strong><small>Consolidated across retailers</small></div>
              <div><span>RETAILER OFFERS</span><strong>{stringStats.offers}</strong><small>Current in-stock packages</small></div>
              <div><span>RETAILERS</span><strong>{stringStats.retailers}</strong><small>Canadian public catalogues</small></div>
              <div><span>GAUGES</span><strong>{stringStats.gauges}</strong><small>Available in this view</small></div>
              <div><span>FORMATS</span><strong>{stringStats.formats}</strong><small>Sets, half sets, reels &amp; packages</small></div>
            </div>
            <div className="string-controls" aria-label="Filter tennis strings">
              <div className="catalogue-control-copy">
                <span className="settings-label">FILTER STRINGS</span>
                <strong>{filteredStringGroups.length} results</strong>
              </div>
              <label><span>Construction type</span><select value={stringTypeFilter} onChange={(event) => { setStringTypeFilter(event.target.value as StringTypeFilter); setStringVisibleCount(stringPageSize); }}>
                <option value="all">All string types</option>
                {stringTypeOrder.map((type) => <option value={type} key={type}>{type}</option>)}
              </select></label>
              <label><span>Brand</span><select value={stringBrandFilter} onChange={(event) => { setStringBrandFilter(event.target.value); setStringVisibleCount(stringPageSize); }}>
                <option value="all">All brands</option>
                {availableStringBrands.map((brand) => <option value={brand} key={brand}>{brand}</option>)}
              </select></label>
              <label><span>Gauge</span><select value={stringGaugeFilter} onChange={(event) => { setStringGaugeFilter(event.target.value); setStringVisibleCount(stringPageSize); }}>
                <option value="all">All gauges</option>
                {availableStringGauges.map((gauge) => <option value={gauge} key={gauge}>{gauge === "Not listed" ? "Gauge not listed" : `${gauge} gauge`}</option>)}
              </select></label>
              <label><span>Package format</span><select value={stringFormatFilter} onChange={(event) => { setStringFormatFilter(event.target.value as StringFormatFilter); setStringVisibleCount(stringPageSize); }}>
                <option value="all">All formats</option>
                {availableStringFormats.map((format) => <option value={format} key={format}>{format}</option>)}
              </select></label>
              {(stringTypeFilter !== "all" || stringBrandFilter !== "all" || stringGaugeFilter !== "all" || stringFormatFilter !== "all") && <button className="clear-catalogue" onClick={() => { setStringTypeFilter("all"); setStringBrandFilter("all"); setStringGaugeFilter("all"); setStringFormatFilter("all"); setStringVisibleCount(stringPageSize); }}>Clear</button>}
            </div>
            <div className="string-type-sections">
              {stringGroupsByType.map((section) => (
                <section className="string-type-section" key={section.type}>
                  <div className="string-type-heading">
                    <div><span>STRING TYPE</span><h3>{section.type}</h3></div>
                    <b>{section.groups.length} {section.groups.length === 1 ? "product" : "products"}</b>
                  </div>
                  <div className="string-grid">
                    {section.groups.map((group) => {
                      const offer = group.bestOffer;
                      return (
                        <article className={`string-card ${offer.sourceState === "stale" ? "stale-offer-card" : ""}`} key={group.key}>
                          <div className="string-card-top">
                            <span className="string-brand">{group.brand}</span>
                            <span className="string-format">{group.format}</span>
                          </div>
                          <div className="string-card-identity">
                            <div className="string-coil" aria-hidden="true"><i /><i /><i /></div>
                            <h4>{group.title}</h4>
                          </div>
                          <div className="string-gauges" aria-label={`Available gauges: ${group.gauges.join(", ")}`}>
                            {group.gauges.map((gauge) => <b key={`${group.key}-${gauge}`}>{gauge === "Not listed" ? "Gauge n/a" : gauge}</b>)}
                          </div>
                          <div className="string-card-price">
                            <span><small>{offer.sourceState === "stale" ? "LAST VERIFIED" : "BEST PRICE"}</small><strong>{money.format(offer.currentPrice ?? 0)}</strong></span>
                            <span><small>AT</small><b>{offer.store}</b></span>
                          </div>
                          {offer.compareAtPrice != null && offer.compareAtPrice > (offer.currentPrice ?? 0) && <div className="string-saving"><del>{money.format(offer.compareAtPrice)}</del><strong>Save {Math.round((1 - (offer.currentPrice ?? 0) / offer.compareAtPrice) * 100)}%</strong></div>}
                          <details className="string-retailers">
                            <summary>Compare {group.offers.length} {group.offers.length === 1 ? "offer" : "offers"}</summary>
                            <div>
                              {group.offers.map((retailerOffer) => (
                                <a href={retailerOffer.url} target="_blank" rel="noreferrer" key={retailerOffer.id}>
                                  <span><strong>{retailerOffer.store}</strong><small>{retailerOffer.gauges.join(" · ")} · {retailerOffer.format}{retailerOffer.sourceState === "stale" ? ` · last verified ${relativeTime(retailerOffer.lastChecked)}` : ""}</small></span>
                                  <b>{money.format(retailerOffer.currentPrice ?? 0)}</b>
                                  <i aria-hidden="true">↗</i>
                                </a>
                              ))}
                            </div>
                          </details>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
            {visibleStringGroups.length < filteredStringGroups.length && (
              <button className="catalogue-more" onClick={() => setStringVisibleCount((count) => count + stringPageSize)}>
                Show more strings <span>{visibleStringGroups.length} of {filteredStringGroups.length} shown</span>
              </button>
            )}
            {!loading && !filteredStringGroups.length && <div className="special-market-empty"><strong>No in-stock strings match those filters.</strong><span>Try another type or gauge; Baseline refreshes string catalogues every three hours.</span></div>}
          </section>
        ) : activeBrand === "balls" ? (
          <section className="accessory-market ball-market" aria-label="Tennis balls categorized by court type and package size">
            <div className="accessory-market-summary">
              <div><span>BALL PRODUCTS</span><strong>{ballStats.products}</strong><small>Package-matched products</small></div>
              <div><span>RETAILER OFFERS</span><strong>{ballStats.offers}</strong><small>Current in-stock listings</small></div>
              <div><span>RETAILERS</span><strong>{ballStats.retailers}</strong><small>Canadian public catalogues</small></div>
              <div><span>BALL TYPES</span><strong>{ballStats.types}</strong><small>Court and training categories</small></div>
            </div>
            <div className="accessory-controls" aria-label="Filter tennis balls">
              <div className="catalogue-control-copy"><span className="settings-label">FILTER TENNIS BALLS</span><strong>{filteredBallGroups.length} results</strong></div>
              <label><span>Type</span><select value={ballTypeFilter} onChange={(event) => { setBallTypeFilter(event.target.value as BallTypeFilter); setBallVisibleCount(ballPageSize); }}>
                <option value="all">All ball types</option>{ballTypeOrder.map((type) => <option value={type} key={type}>{type}</option>)}
              </select></label>
              <label><span>Brand</span><select value={ballBrandFilter} onChange={(event) => { setBallBrandFilter(event.target.value); setBallVisibleCount(ballPageSize); }}>
                <option value="all">All brands</option>{availableBallBrands.map((brand) => <option value={brand} key={brand}>{brand}</option>)}
              </select></label>
              <label><span>Package</span><select value={ballPackageFilter} onChange={(event) => { setBallPackageFilter(event.target.value); setBallVisibleCount(ballPageSize); }}>
                <option value="all">All package sizes</option>{availableBallPackages.map((pack) => <option value={pack} key={pack}>{pack}</option>)}
              </select></label>
              <label><span>Sort</span><select value={ballSort} onChange={(event) => setBallSort(event.target.value as BallSort)}>
                <option value="featured">Type &amp; brand</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="discount">Biggest savings</option>
              </select></label>
              {(ballTypeFilter !== "all" || ballBrandFilter !== "all" || ballPackageFilter !== "all" || ballSort !== "featured") && <button className="clear-catalogue" onClick={() => { setBallTypeFilter("all"); setBallBrandFilter("all"); setBallPackageFilter("all"); setBallSort("featured"); setBallVisibleCount(ballPageSize); }}>Clear</button>}
            </div>
            <div className="accessory-grid ball-grid">
              {visibleBallGroups.map((group) => {
                const offer = group.bestOffer;
                const discounted = offer.compareAtPrice != null && offer.compareAtPrice > (offer.currentPrice ?? 0);
                return (
                  <article className={`accessory-card ball-card ${offer.sourceState === "stale" ? "stale-offer-card" : ""}`} key={group.key}>
                    <div className="accessory-card-top"><span className="accessory-brand">{group.brand}</span><span className="accessory-category-pill">{group.type}</span></div>
                    <div className="accessory-card-identity"><div className="accessory-mark ball-mark" aria-hidden="true"><span>●</span><i /></div><div><h4>{group.title}</h4><span className="accessory-detail">{group.package}</span></div></div>
                    <div className="accessory-card-price"><span><small>{offer.sourceState === "stale" ? "LAST VERIFIED" : "BEST PRICE"}</small><strong>{money.format(offer.currentPrice ?? 0)}</strong></span><span><small>AT</small><b>{offer.store}</b></span></div>
                    {discounted && <div className="accessory-saving"><del>{money.format(offer.compareAtPrice ?? 0)}</del><strong>Save {Math.round((1 - (offer.currentPrice ?? 0) / (offer.compareAtPrice ?? 1)) * 100)}%</strong></div>}
                    <details className="accessory-retailers"><summary>Compare {group.offers.length} {group.offers.length === 1 ? "offer" : "offers"}</summary><div>
                      {group.offers.map((retailerOffer) => <a href={retailerOffer.url} target="_blank" rel="noreferrer" key={retailerOffer.id}><span><strong>{retailerOffer.store}</strong><small>{retailerOffer.package}{retailerOffer.sourceState === "stale" ? ` · last verified ${relativeTime(retailerOffer.lastChecked)}` : ""}</small></span><b>{money.format(retailerOffer.currentPrice ?? 0)}</b><i aria-hidden="true">↗</i></a>)}
                    </div></details>
                  </article>
                );
              })}
            </div>
            {visibleBallGroups.length < filteredBallGroups.length && <button className="catalogue-more" onClick={() => setBallVisibleCount((count) => count + ballPageSize)}>Show more tennis balls <span>{visibleBallGroups.length} of {filteredBallGroups.length} shown</span></button>}
            {!loading && !filteredBallGroups.length && <div className="special-market-empty"><strong>No in-stock tennis balls match those filters.</strong><span>Try another type or package; Baseline refreshes ball catalogues every three hours.</span></div>}
          </section>
        ) : activeBrand === "accessories" ? (
          <section className="accessory-market" aria-label="Tennis racquet accessories categorized by product type">
            <div className="accessory-market-summary">
              <div><span>ACCESSORY PRODUCTS</span><strong>{accessoryStats.products}</strong><small>Consolidated across retailers</small></div>
              <div><span>RETAILER OFFERS</span><strong>{accessoryStats.offers}</strong><small>Current in-stock items</small></div>
              <div><span>RETAILERS</span><strong>{accessoryStats.retailers}</strong><small>Canadian public catalogues</small></div>
              <div><span>CATEGORIES</span><strong>{accessoryStats.categories}</strong><small>Available in this view</small></div>
            </div>
            <div className="accessory-controls" aria-label="Filter tennis accessories">
              <div className="catalogue-control-copy">
                <span className="settings-label">FILTER ACCESSORIES</span>
                <strong>{filteredAccessoryGroups.length} results</strong>
              </div>
              <label className="accessory-search"><span>Search</span><input type="search" value={accessorySearch} placeholder="Bags, grips, grommets…" onChange={(event) => { setAccessorySearch(event.target.value); setAccessoryVisibleCount(accessoryPageSize); }} /></label>
              <label><span>Category</span><select value={accessoryCategoryFilter} onChange={(event) => { setAccessoryCategoryFilter(event.target.value as AccessoryCategoryFilter); setAccessoryVisibleCount(accessoryPageSize); }}>
                <option value="all">All accessory types</option>
                {accessoryCategoryOrder.map((category) => <option value={category} key={category}>{category}</option>)}
              </select></label>
              <label><span>Brand</span><select value={accessoryBrandFilter} onChange={(event) => { setAccessoryBrandFilter(event.target.value); setAccessoryVisibleCount(accessoryPageSize); }}>
                <option value="all">All brands</option>
                {availableAccessoryBrands.map((brand) => <option value={brand} key={brand}>{brand}</option>)}
              </select></label>
              <label><span>Sort</span><select value={accessorySort} onChange={(event) => setAccessorySort(event.target.value as AccessorySort)}>
                <option value="featured">Category &amp; brand</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="discount">Biggest savings</option>
              </select></label>
              {(accessoryCategoryFilter !== "all" || accessoryBrandFilter !== "all" || accessorySearch || accessorySort !== "featured") && <button className="clear-catalogue" onClick={() => { setAccessoryCategoryFilter("all"); setAccessoryBrandFilter("all"); setAccessorySearch(""); setAccessorySort("featured"); setAccessoryVisibleCount(accessoryPageSize); }}>Clear</button>}
            </div>
            <div className="accessory-category-sections">
              {accessoryGroupsByCategory.map((section) => (
                <section className="accessory-category-section" key={section.category}>
                  <div className="accessory-category-heading">
                    <div><span>ACCESSORY TYPE</span><h3>{section.category}</h3></div>
                    <b>{section.groups.length} {section.groups.length === 1 ? "product" : "products"}</b>
                  </div>
                  <div className="accessory-grid">
                    {section.groups.map((group) => {
                      const offer = group.bestOffer;
                      const discounted = offer.compareAtPrice != null && offer.compareAtPrice > (offer.currentPrice ?? 0);
                      return (
                        <article className={`accessory-card ${offer.sourceState === "stale" ? "stale-offer-card" : ""}`} key={group.key}>
                          <div className="accessory-card-top">
                            <span className="accessory-brand">{group.brand}</span>
                            <span className="accessory-category-pill">{group.category}</span>
                          </div>
                          <div className="accessory-card-identity">
                            <div className="accessory-mark" aria-hidden="true"><span>{accessoryCategoryMarks[group.category]}</span><i /></div>
                            <div><h4>{group.title}</h4><span className="accessory-detail">{group.detail}</span></div>
                          </div>
                          <div className="accessory-card-price">
                            <span><small>{offer.sourceState === "stale" ? "LAST VERIFIED" : "BEST PRICE"}</small><strong>{money.format(offer.currentPrice ?? 0)}</strong></span>
                            <span><small>AT</small><b>{offer.store}</b></span>
                          </div>
                          {discounted && <div className="accessory-saving"><del>{money.format(offer.compareAtPrice ?? 0)}</del><strong>Save {Math.round((1 - (offer.currentPrice ?? 0) / (offer.compareAtPrice ?? 1)) * 100)}%</strong></div>}
                          <details className="accessory-retailers">
                            <summary>Compare {group.offers.length} {group.offers.length === 1 ? "offer" : "offers"}</summary>
                            <div>
                              {group.offers.map((retailerOffer) => (
                                <a href={retailerOffer.url} target="_blank" rel="noreferrer" key={retailerOffer.id}>
                                  <span><strong>{retailerOffer.store}</strong><small>{retailerOffer.detail}{retailerOffer.sourceState === "stale" ? ` · last verified ${relativeTime(retailerOffer.lastChecked)}` : ""}</small></span>
                                  <b>{money.format(retailerOffer.currentPrice ?? 0)}</b>
                                  <i aria-hidden="true">↗</i>
                                </a>
                              ))}
                            </div>
                          </details>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
            {visibleAccessoryGroups.length < filteredAccessoryGroups.length && (
              <button className="catalogue-more" onClick={() => setAccessoryVisibleCount((count) => count + accessoryPageSize)}>
                Show more accessories <span>{visibleAccessoryGroups.length} of {filteredAccessoryGroups.length} shown</span>
              </button>
            )}
            {!loading && !filteredAccessoryGroups.length && <div className="special-market-empty"><strong>No in-stock accessories match those filters.</strong><span>Try another category or brand; Baseline refreshes accessory catalogues every three hours.</span></div>}
          </section>
        ) : activeBrand === "special" ? (
          <section className="special-market" aria-label="Special-edition racquets available across all verified grip sizes">
            <div className="special-market-summary">
              <div><span>UNIQUE RACQUETS</span><strong>{specialEditionStats.racquets}</strong><small>One card per special release</small></div>
              <div><span>RETAILER OFFERS</span><strong>{specialEditionStats.offers}</strong><small>Consolidated under each racquet</small></div>
              <div><span>GRIP SIZES</span><strong>{specialEditionStats.gripSizes}</strong><small>Verified sizes from L0 through L5</small></div>
              <div><span>{data?.gripSize ?? "L3"} AVAILABLE</span><strong>{specialEditionStats.selectedGrip}</strong><small>Matches your required grip</small></div>
              <div><span>RETAILERS</span><strong>{specialEditionStats.retailers}</strong><small>With verified stock right now</small></div>
            </div>
            <div className="special-controls" aria-label="Filter special-edition racquets">
              <div className="catalogue-control-copy"><span className="settings-label">BROWSE RELEASES</span><strong>{filteredSpecialEditionGroups.length} of {specialEditionGroups.length}</strong></div>
              <label><span>Brand</span><select value={specialBrandFilter} onChange={(event) => setSpecialBrandFilter(event.target.value)}><option value="all">All brands</option>{specialBrands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}</select></label>
              <label><span>Grip</span><select value={specialGripFilter} onChange={(event) => setSpecialGripFilter(event.target.value as SpecialGripFilter)}><option value="all">Any verified grip</option>{gripOptions.map((option) => <option value={option.key} key={`special-${option.key}`}>{option.key} — {option.inches}</option>)}<option value="multiple">Multiple grip sizes</option></select></label>
              <label><span>Retailer coverage</span><select value={specialAvailabilityFilter} onChange={(event) => setSpecialAvailabilityFilter(event.target.value as SpecialAvailabilityFilter)}><option value="all">Any verified stock</option><option value="multi">2+ retailers</option></select></label>
              <label><span>Sort by</span><select value={specialSort} onChange={(event) => setSpecialSort(event.target.value as SpecialSort)}><option value="edition">Edition, then name</option><option value="name-asc">Name: A to Z</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="retailers-desc">Most retailer choices</option></select></label>
              {(specialBrandFilter !== "all" || specialGripFilter !== "all" || specialAvailabilityFilter !== "all" || specialSort !== "edition") && <button className="clear-catalogue" onClick={() => { setSpecialBrandFilter("all"); setSpecialGripFilter("all"); setSpecialAvailabilityFilter("all"); setSpecialSort("edition"); }}>Clear</button>}
            </div>
            <div className="special-market-grid">
              {filteredSpecialEditionGroups.map((group) => {
                const offer = group.bestOffer;
                return (
                  <article className={`special-market-card ${offer.sourceState === "stale" ? "stale-offer-card" : ""}`} key={`special-market-${group.key}`}>
                    <div className="special-card-top">
                      <span className="special-badge">{group.edition}</span>
                      <span className="sale-store">{group.offers.length} {group.offers.length === 1 ? "retailer" : "retailers"}</span>
                    </div>
                    <div className="special-card-body">
                      <div>
                        <span className="special-brand">{specialOfferBrand(group)}</span>
                        <h3>{group.title}</h3>
                        {renderPatternBadge(group.modelKey, true)}
                      </div>
                      {racquetImage(group.modelKey, "special-frame-thumb", 82, 112, `${group.title} racquet`)}
                    </div>
                    <div className="special-card-footer">
                      <span><small className="special-price-label">{offer.sourceState === "stale" ? "LAST VERIFIED" : "BEST PRICE"}</small><span className="special-price">{money.format(offer.currentPrice ?? 0)}{offer.compareAtPrice != null && offer.compareAtPrice > (offer.currentPrice ?? 0) && <del>{money.format(offer.compareAtPrice)}</del>}</span></span>
                      <span className="special-grips">{group.grips.map((grip) => <b key={`${group.key}-${grip}`}>{grip}<small>{gripOptions.find((option) => option.key === grip)?.inches.replace(" in", "") ?? "Check size"}</small></b>)}</span>
                    </div>
                    <details className="special-retailers">
                      <summary>Compare {group.offers.length} retailer {group.offers.length === 1 ? "offer" : "offers"}</summary>
                      <div className="special-retailer-list">
                        {group.offers.map((retailerOffer) => (
                          <a href={retailerOffer.url} target="_blank" rel="noreferrer" key={`${group.key}-${retailerOffer.id}`}>
                            <span><strong>{retailerOffer.store}</strong><small>{specialGripLabels(retailerOffer.gripSizes).join(" · ")}{retailerOffer.sourceState === "stale" ? ` · last verified ${relativeTime(retailerOffer.lastChecked)}` : ""}</small></span>
                            <b>{money.format(retailerOffer.currentPrice ?? 0)}</b>
                            <span className="arrow" aria-hidden="true">↗</span>
                          </a>
                        ))}
                      </div>
                    </details>
                  </article>
                );
              })}
            </div>
            {!loading && !filteredSpecialEditionGroups.length && <div className="special-market-empty"><strong>No special editions match those filters.</strong><span>Clear the filters or try another grip; Baseline keeps checking all enabled retailers every 3 hours.</span></div>}
          </section>
        ) : <>
        {activeBrand === "catalogue" && renderCatalogueControls(featuredModelKeys.length)}

        <div className="model-grid">
          {visibleFeaturedModelKeys.map((modelKey, index) => renderModelCard(modelKey, index, activeBrand !== "all" && activeBrand !== "catalogue"))}
        </div>
        {activeBrand === "catalogue" && visibleFeaturedModelKeys.length < featuredModelKeys.length && (
          <button className="catalogue-more" onClick={() => setCatalogueVisibleCount((count) => count + cataloguePageSize)}>
            Show 24 more <span>{visibleFeaturedModelKeys.length} of {featuredModelKeys.length} shown</span>
          </button>
        )}
        {!loading && featuredModelKeys.length === 0 && suggestedModelKeys.length === 0 && <p className="catalogue-empty">{activeBrand === "catalogue" ? "No market racquets match those specs. Try clearing a filter." : "No racquets are available in this section right now."}</p>}

        {activeBrand !== "all" && activeBrand !== "catalogue" && suggestedModelKeys.length > 0 && (
          <section className="brand-suggestions">
            <div className="sale-heading">
              <div><p className="eyebrow">MORE FROM {activeBrand.toUpperCase()}</p><h2>Other suggestions.</h2></div>
              <span className="sale-note">Tracked across enabled retailers</span>
            </div>
            <div className="suggestion-grid">
              {suggestedModelKeys.map((modelKey) => {
                const best = (data?.offers ?? [])
                  .filter((offer) => offer.modelKey === modelKey && offer.inStock && offer.currentPrice !== null)
                  .sort((a, b) => (a.currentPrice ?? Infinity) - (b.currentPrice ?? Infinity))[0];
                const selected = compareKeys.includes(modelKey);
                return (
                  <article className="suggestion-card" key={modelKey}>
                    {racquetImage(modelKey, "suggestion-image", 66, 88, `${data?.modelNames[modelKey] ?? modelKey} racquet`)}
                    <div><span>{modelBrand(modelKey)}</span><strong>{data?.modelNames[modelKey] ?? modelKey}</strong><small>{best?.currentPrice != null ? `From ${money.format(best.currentPrice)}` : "Watching for stock"}</small>{renderPatternBadge(modelKey, true)}</div>
                    <button className={`compare-toggle ${selected ? "selected" : ""}`} disabled={compareKeys.length >= maxCompareFrames && !selected} onClick={() => toggleCompare(modelKey)}>{selected ? "✓ Added" : "+ Compare"}</button>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {!(["catalogue", "special", "strings", "balls", "accessories", "guide", "string-guide"] as BrandViewKey[]).includes(activeBrand) && <div className="sale-section">
          <div className="sale-heading">
            <div>
              <p className="eyebrow">{activeBrand === "all" ? "THE REST OF THE SALE RACK" : `${activeBrand.toUpperCase()} DEALS`}</p>
              <h2>{activeBrand === "all" ? "Other frames worth a look." : `More ${activeBrand} prices worth a look.`}</h2>
            </div>
            <span className="sale-note">{data?.gripSize ?? "L3"} only · new · in stock</span>
          </div>
          <div className="sale-grid">
            {filteredSaleOffers.map((offer) => (
              <a className="sale-offer" href={offer.url} target="_blank" rel="noreferrer" key={offer.id}>
                <span className="sale-store">{offer.store}</span>
                <strong>{offer.title}</strong>
                <span className="sale-prices"><b>{money.format(offer.currentPrice ?? 0)}</b><del>{offer.compareAtPrice != null ? money.format(offer.compareAtPrice) : ""}</del><i>↓ {offer.compareAtPrice && offer.currentPrice ? Math.round((1 - offer.currentPrice / offer.compareAtPrice) * 100) : 0}%</i></span>
                <span className="arrow" aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
          {!loading && !filteredSaleOffers.length && <p className="empty sale-empty">No additional {data?.gripSize ?? "L3"} sale frames match the selected specs.</p>}
        </div>}
        </>}
      </section>

      <section className="how-it-works">
        <p className="eyebrow">HOW IT WORKS</p>
        <div className="steps">
          <div><span>01</span><strong>We check</strong><p>Enabled Canadian retailers, every 3 hours.</p></div>
          <div><span>02</span><strong>We compare</strong><p>{activeBrand === "accessories" ? "Only in-stock racquet accessories in CAD, grouped across retailers." : activeBrand === "balls" ? "Only matching tennis-ball packages in CAD—never a single can against a case." : activeBrand === "strings" ? "Only in-stock tennis strings in CAD, grouped by family and gauge." : "Only new, in-stock frames in CAD—no demo noise."}</p></div>
          <div><span>03</span><strong>You save</strong><p>Set your price and jump directly to the retailer.</p></div>
        </div>
      </section>
      </> : <>
      <section className="hero used-hero" id="used-top">
        <div className="hero-copy">
          <p className="eyebrow">CANADIAN PRE-OWNED RACQUET SEARCH</p>
          <h1>Find the<br /><em>second bounce.</em></h1>
          <p className="lede">Baseline checks public used listings every 3 hours and only shows results with a real price, exact model and verified {gripLabel(data?.gripSize ?? "L3")} evidence.</p>
          <div className="hero-actions">
            {data?.publicPreview ? <span className="public-refresh-note">Listings refresh automatically<br /><strong>Every 3 hours</strong></span> : <button className="check-button used-browse-button" onClick={checkNow} disabled={checking}><span className={checking ? "spin" : ""} aria-hidden="true">↻</span>{checking ? "Checking listings…" : "Check used listings now"}</button>}
            <span className="last-check">Last checked<br /><strong>{relativeTime(data?.lastCheck?.checkedAt)}</strong></span>
          </div>
        </div>
        <div className="court-card used-court-card" aria-label="Used-market search summary">
          <div className="court-lines"><span /><span /><span /></div>
          <div className="summary-ball">
            <strong>{data?.usedOffers.length ?? 0}</strong>
            <span>live used<br />listings</span>
          </div>
          <div className="summary-copy">
            <span>{data?.gripSize ?? "L3"} verified</span>
            <strong>{usedSourceCount} sources contributing</strong>
          </div>
        </div>
      </section>

      <section className="watchlist used-watchlist" id="used-watchlist">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR USED-MARKET BOARD</p>
            <h2>Six frames. Live listings in one place.</h2>
          </div>
          <div className="legend"><span className="used-dot" /> Public used listings <span className="stock-dot" /> {data?.gripSize ?? "L3"} verified</div>
        </div>

        <div className="used-summary-strip" aria-label="Used market summary">
          <div><span>Live listings</span><strong>{data?.usedOffers.length ?? 0}</strong><small>exact model + grip</small></div>
          <div><span>Fresh today</span><strong>{usedFreshCount}</strong><small>checked in the past 24h</small></div>
          <div><span>At your target</span><strong>{usedTargetHitCount}</strong><small>watched frames</small></div>
          <div><span>Last refresh</span><strong>{relativeTime(data?.lastCheck?.checkedAt)}</strong><small>automatic every 3 hours</small></div>
        </div>

        {renderSourceHealth()}

        <div className="used-marketplace-overview" aria-label="Marketplace collector status">
          <div className="used-marketplace-intro">
            <span className="settings-label">MARKETPLACE CONNECTIONS</span>
            <strong>What Baseline checked</strong>
            <small>Direct search stays available even when an automated connector needs attention.</small>
          </div>
          <div className="used-marketplace-statuses">
            {marketplaceHealth.map((source) => {
              const marketplace = usedMarketplaces.find((item) => item.key === source.key);
              const state = !source.configured ? "setup" : source.online ? "live" : source.checked ? "issue" : "waiting";
              const label = !source.configured ? "Open a live search" : source.online
                ? source.offers > 0 ? `${source.offers} live ${source.offers === 1 ? "listing" : "listings"}` : "Checked · no exact matches"
                : source.checked ? "Live search still available" : "Ready to search";
              return (
                <a
                  className={`used-marketplace-status ${state}`}
                  href={marketplace?.buildUrl(`tennis racquet ${gripLabel(data?.gripSize ?? "L3")}`)}
                  target="_blank"
                  rel="noreferrer"
                  key={source.key}
                  title={source.error ?? undefined}
                >
                  <span className="marketplace-monogram">{source.name.slice(0, 2).toUpperCase()}</span>
                  <span><strong>{source.name}</strong><small>{label}</small></span>
                  <i aria-hidden="true">↗</i>
                </a>
              );
            })}
          </div>
        </div>

        <div className="used-controls" aria-label="Filter used racquets">
          <div className="catalogue-control-copy">
            <span className="settings-label">NARROW THE BOARD</span>
            <strong>{visibleUsedModelKeys.length} of {usedModelKeys.length} frames</strong>
          </div>
          <label>Find a frame
            <input type="search" value={usedSearch} onChange={(event) => setUsedSearch(event.target.value)} placeholder="Blade, EZONE…" />
          </label>
          <label>Grip size
            <select value={data?.gripSize ?? "L3"} onChange={(event) => changeGripSize(event.target.value as GripSize)}>
              {gripOptions.map((option) => <option value={option.key} key={`used-${option.key}`}>{option.key} — {option.inches}</option>)}
            </select>
          </label>
          <label>Availability
            <select value={usedAvailability} onChange={(event) => setUsedAvailability(event.target.value as UsedAvailability)}>
              <option value="all">All watched frames</option>
              <option value="live">Live matches only</option>
              <option value="empty">Needs a match</option>
            </select>
          </label>
          <label>Sort by
            <select value={usedSort} onChange={(event) => setUsedSort(event.target.value as UsedSort)}>
              <option value="watchlist">Watchlist order</option>
              <option value="price-asc">Lowest live price</option>
              <option value="listings-desc">Most listings</option>
              <option value="name-asc">Name A–Z</option>
            </select>
          </label>
          {(usedSearch || usedAvailability !== "all" || usedSort !== "watchlist") && <button className="used-reset" onClick={() => { setUsedSearch(""); setUsedAvailability("all"); setUsedSort("watchlist"); }}>Clear filters</button>}
        </div>

        <div className="model-grid used-model-grid">
          {visibleUsedModelKeys.map((modelKey, index) => {
            const modelName = data?.modelNames[modelKey] ?? modelKey;
            const target = data?.usedTargets[modelKey] ?? Math.round((data?.targets[modelKey] ?? 250) * 0.68);
            const query = `${modelName} tennis racquet ${gripLabel(data?.gripSize ?? "L3")}`;
            const modelUsedOffers = (data?.usedOffers ?? []).filter((offer) => offer.modelKey === modelKey);
            const bestUsedOffer = modelUsedOffers[0];
            const editingKey = `used:${modelKey}`;
            return (
              <article className={`model-card used-model-card ${accents[modelKey] ?? "blue"}`} key={`used-${modelKey}-${index}`} style={{ "--delay": `${index * 70}ms` } as React.CSSProperties}>
                <div className="card-top">
                  <span className="model-number">0{index + 1}</span>
                  <span className={`deal-pill used-pill ${modelUsedOffers.length ? "has-live" : ""}`}>{modelUsedOffers.length ? `${modelUsedOffers.length} live` : "Searching"}</span>
                </div>
                <div className="model-identity">
                  <div><h3>{modelName}</h3>{resolvedRacquetSpecs[modelKey] && <span className="card-specs">{[resolvedRacquetSpecs[modelKey].head, resolvedRacquetSpecs[modelKey].weight, resolvedRacquetSpecs[modelKey].stiffness].filter(Boolean).join(" · ")}</span>}{renderPatternBadge(modelKey)}</div>
                  {racquetImage(modelKey, "model-thumbnail", 122, 158, `${modelName} racquet`, "122px")}
                </div>
                <div className="used-card-metrics">
                  <div className="used-target-metric">
                    <span>Aim to pay under</span>
                    {editing === editingKey ? (
                      <form onSubmit={(event) => { event.preventDefault(); saveTarget(modelKey, "used"); }}>
                        <label><span>$</span><input autoFocus inputMode="decimal" value={targetDraft} onChange={(event) => setTargetDraft(event.target.value)} aria-label="Used target price in Canadian dollars" /></label>
                        <button type="submit">Save</button>
                      </form>
                    ) : (
                      <button onClick={() => { setEditing(editingKey); setTargetDraft(String(target)); }}>
                        <strong>{money.format(target)}</strong><small>Edit target</small>
                      </button>
                    )}
                  </div>
                  <div className={`used-best-metric ${bestUsedOffer ? "has-listing" : ""}`}>
                    <span>Best live listing</span>
                    {bestUsedOffer ? <><strong>{offerMoney(bestUsedOffer)}</strong><small>{bestUsedOffer.store}{bestUsedOffer.currentPrice !== null && bestUsedOffer.currentPrice <= target ? " · target hit" : ""}</small></> : <><strong>—</strong><small>No exact match</small></>}
                  </div>
                </div>
                <div className="used-listings-head">
                  <span>Verified live listings</span>
                  <b>{modelUsedOffers.length}</b>
                </div>
                <div className="used-listing-stack">
                  {!modelUsedOffers.length && <p className="empty used-empty">No exact {data?.gripSize ?? "L3"} match in the latest check. Try the live marketplace searches below.</p>}
                  {modelUsedOffers.slice(0, 5).map((offer, offerIndex) => (
                    <a href={offer.url} target="_blank" rel="noreferrer" className="used-listing-row" key={offer.id}>
                      <span className="used-listing-rank">{offerIndex + 1}</span>
                      <span className="used-listing-copy">
                        <strong>{offer.title}</strong>
                        <small>{offer.store} · {offer.condition ?? "Used"} · {offer.gripSizes.join(", ")}{offer.currency === "USD" ? " · USD" : ""} · {relativeTime(offer.lastChecked)}</small>
                      </span>
                      <span className="used-listing-price">{offerMoney(offer)}</span>
                      <span className="arrow" aria-hidden="true">→</span>
                    </a>
                  ))}
                </div>
                <div className="used-search-more">
                  <span>Search this frame everywhere</span>
                  <div className="used-market-links">
                    {usedMarketplaces.map((marketplace) => (
                      <a href={marketplace.buildUrl(query)} target="_blank" rel="noreferrer" key={`${modelKey}-${marketplace.key}`} title={marketplace.note}>
                        <span>{marketplace.name === "Facebook Marketplace" ? "Facebook" : marketplace.name.replace(" Canada", "")}</span>
                        <i aria-hidden="true">↗</i>
                      </a>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {!loading && usedModelKeys.length === 0 && <p className="catalogue-empty">No used-market watchlist frames are configured yet.</p>}
        {!loading && usedModelKeys.length > 0 && visibleUsedModelKeys.length === 0 && <p className="catalogue-empty">No watched frames match these filters. Clear the filters to see the full board.</p>}
        <p className="used-disclaimer">Marketplace searches are live, but seller descriptions are inconsistent. Confirm the exact generation, {gripLabel(data?.gripSize ?? "L3")} grip, cracks, bumper wear and total delivered price before paying.</p>
      </section>

      <section className="sale-section used-other-section">
        <div className="sale-heading">
          <div>
            <p className="eyebrow">THE REST OF THE USED RACK</p>
            <h2>Other used frames worth a look.</h2>
          </div>
          <span className="sale-note">Verified demo/used listings · {data?.gripSize ?? "L3"}</span>
        </div>
        <div className="sale-grid">
          {otherUsedOffers.map((offer) => (
            <a className="sale-offer" href={offer.url} target="_blank" rel="noreferrer" key={offer.id}>
              <span className="sale-store">{offer.store} · {offer.condition}</span>
              <strong>{offer.title}</strong>
              <span className="sale-prices"><b>{offerMoney(offer)}</b><i>{offer.gripSizes.join(", ")}{offer.currency === "USD" ? " · USD" : ""}</i></span>
              <span className="arrow" aria-hidden="true">â†—</span>
            </a>
          ))}
        </div>
        {!otherUsedOffers.length && <p className="empty sale-empty">No additional verified used/demo listings in the latest check.</p>}
      </section>

      <section className="how-it-works" id="buyer-checklist">
        <p className="eyebrow">USED-RACQUET CHECKLIST</p>
        <div className="steps">
          <div><span>01</span><strong>Inspect the hoop</strong><p>Ask for close photos at 10, 12 and 2 o’clock. Paint chips are normal; structural cracks are not.</p></div>
          <div><span>02</span><strong>Confirm the setup</strong><p>Verify {gripLabel(data?.gripSize ?? "L3")}, exact generation, unmodified length and whether the frame needs new grommets or strings.</p></div>
          <div><span>03</span><strong>Protect the payment</strong><p>Use marketplace checkout or meet in public. Include shipping, duties and a restring when comparing the real price.</p></div>
        </div>
      </section>
      </>}

      <nav className="mobile-dock" aria-label="Quick navigation">
        <button onClick={() => { setActiveMarket("retail"); setActiveBrand("all"); document.getElementById("top")?.scrollIntoView({ behavior: "smooth" }); }}><span aria-hidden="true">⌂</span>Home</button>
        <button onClick={() => { setActiveMarket("retail"); setActiveBrand("catalogue"); document.getElementById("browse-market")?.scrollIntoView({ behavior: "smooth" }); }}><span aria-hidden="true">⌕</span>Browse</button>
        <button onClick={() => changeMarket("used")}><span aria-hidden="true">♲</span>Used</button>
        <button disabled={compareKeys.length < 2} onClick={() => setComparisonOpen(true)}><span aria-hidden="true">⇄</span>Compare{compareKeys.length ? ` (${compareKeys.length})` : ""}</button>
      </nav>

      {imagePreviewKey && (() => {
        const spec = resolvedRacquetSpecs[imagePreviewKey];
        const image = modelImage(imagePreviewKey, spec?.imageUrl);
        const pending = image.includes("racquet-photo-pending.svg");
        const modelName = data?.modelNames[imagePreviewKey] ?? imagePreviewKey;
        return <div className="image-preview-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setImagePreviewKey(null); }}>
          <section className="image-preview-modal" role="dialog" aria-modal="true" aria-labelledby="image-preview-title">
            <button className="image-preview-close" onClick={() => setImagePreviewKey(null)} aria-label="Close racquet photo">×</button>
            <div className="image-preview-image"><Image src={image} alt={`${modelName} racquet`} width={420} height={560} sizes="(max-width: 700px) 72vw, 420px" unoptimized /></div>
            <div className="image-preview-copy">
              <span>{modelBrand(imagePreviewKey)}</span>
              <h2 id="image-preview-title">{modelName}</h2>
              <p>{pending ? "A model-specific photo is still being verified. Baseline will not substitute another racquet’s photo." : spec?.imageUrl?.startsWith("https://") ? "Current photo supplied by the verified product source." : "Model-specific catalogue photo."}</p>
              {spec?.sourceUrl && <a href={spec.sourceUrl} target="_blank" rel="noreferrer">Open specification source ↗</a>}
            </div>
          </section>
        </div>;
      })()}

      {retailerModelKey && (
        <div className="retailer-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setRetailerModelKey(null); }}>
          <section className="retailer-modal" role="dialog" aria-modal="true" aria-labelledby="retailer-modal-title">
            <div className="retailer-modal-head">
              <div className="retailer-modal-identity">
                {racquetImage(retailerModelKey, "retailer-modal-thumb", 72, 98, `${data?.modelNames[retailerModelKey] ?? retailerModelKey} racquet`)}
                 <div><span>{modelBrand(retailerModelKey)} · {data?.gripSize ?? "L3"}</span><h2 id="retailer-modal-title">{data?.modelNames[retailerModelKey] ?? retailerModelKey}</h2>{renderPatternBadge(retailerModelKey)}<p>{retailerModelOffers.length} verified {retailerModelOffers.length === 1 ? "retailer" : "retailers"}, ranked by price</p></div>
              </div>
              <button className="retailer-modal-close" onClick={() => setRetailerModelKey(null)} aria-label="Close retailer comparison">×</button>
            </div>
            <div className="retailer-modal-summary">
              <div><span>Best price</span><strong>{retailerModelOffers[0]?.currentPrice != null ? money.format(retailerModelOffers[0].currentPrice) : "—"}</strong></div>
              <div><span>Your target</span><strong>{money.format(data?.targets[retailerModelKey] ?? 0)}</strong></div>
              <div><span>Price spread</span><strong>{retailerModelOffers.length > 1 ? money.format((retailerModelOffers.at(-1)?.currentPrice ?? 0) - (retailerModelOffers[0]?.currentPrice ?? 0)) : "—"}</strong></div>
            </div>
            <div className="retailer-modal-list">
              {retailerModelOffers.map((offer, index) => {
                const target = data?.targets[retailerModelKey] ?? 0;
                const delta = (offer.currentPrice ?? 0) - target;
                return <a href={offer.url} target="_blank" rel="noreferrer" className={`retailer-modal-row ${offer.sourceState === "stale" ? "stale" : ""}`} key={`${retailerModelKey}-${offer.store}`}>
                  <span className="retailer-modal-rank">{index + 1}</span>
                  <span className="retailer-modal-store"><strong>{offer.store}</strong><small>{offer.gripSizes.length ? offer.gripSizes.join(", ") : "Confirm grip"} · {offer.sourceState === "stale" ? "last verified" : "checked"} {relativeTime(offer.lastChecked)}</small></span>
                  <span className="retailer-modal-delta">{delta <= 0 ? `${money.format(Math.abs(delta))} under target` : `${money.format(delta)} over target`}</span>
                  <span className="retailer-modal-price"><strong>{money.format(offer.currentPrice ?? 0)}</strong><small>{offer.currency ?? "CAD"}</small></span>
                  <span aria-hidden="true">↗</span>
                </a>;
              })}
            </div>
            <p className="retailer-modal-note">Prices are ranked before shipping and tax. Open a retailer to confirm final grip stock and checkout total.</p>
          </section>
        </div>
      )}

      {activeMarket === "retail" && compareKeys.length > 0 && (
        <aside className="compare-tray" aria-label="Racquet comparison tray">
          <div>
            <span className="compare-count">{compareKeys.length}/{maxCompareFrames} selected</span>
            <div className="compare-tray-items">
              {compareKeys.map((modelKey) => (
                <button className="compare-chip" key={modelKey} onClick={() => toggleCompare(modelKey)} title="Remove from comparison">
                  {data?.modelNames[modelKey] ?? modelKey}<span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
          </div>
          <div className="compare-tray-actions">
            <button className="compare-clear" onClick={() => setCompareKeys([])}>Clear</button>
            <button className="compare-open" disabled={compareKeys.length < 2} onClick={() => setComparisonOpen(true)}>Compare racquets</button>
          </div>
        </aside>
      )}

      {comparisonOpen && (
        <div className="compare-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setComparisonOpen(false); }}>
          <section className="compare-modal" role="dialog" aria-modal="true" aria-labelledby="compare-title">
            <div className="compare-modal-head">
              <div><p className="eyebrow">SIDE-BY-SIDE</p><h2 id="compare-title">Racquet comparison</h2></div>
              <button onClick={() => setComparisonOpen(false)} aria-label="Close comparison">×</button>
            </div>
            <p className="compare-note">Official manufacturer specifications are the primary record and are independently checked against matching Canadian retailer listings. Measurements use one consistent format; secondary units are shown for convenience. Strung measurements and RA can vary by setup, sample, and generation.</p>
            <div className="comparison-scroll">
              <table className="comparison-table" style={{ minWidth: `${210 + compareKeys.length * 180}px` }}>
                <thead>
                  <tr><th>Specification</th>{compareKeys.map((key) => <th key={key}>{racquetImage(key, "comparison-frame-thumb", 82, 108, `${data?.modelNames[key] ?? key} racquet`)}<strong>{data?.modelNames[key] ?? key}</strong><span>{modelBrand(key)}</span>{refreshingModels.has(key) && <small className="model-refresh-state"><i />Refreshing…</small>}</th>)}</tr>
                </thead>
                <tbody>
                  {([
                    ["Head size", "head"], ["Length", "length"], ["Unstrung weight", "weight"], ["Strung weight", "strungWeight"], ["Unstrung balance", "balance"], ["Strung balance", "strungBalance"], ["Swingweight", "swingweight"], ["Stiffness / flex", "stiffness"], ["Beam width", "beam"], ["Composition", "composition"], ["String pattern", "pattern"], ["Grip sizes", "gripSizes"], ["Recommended strings", "recommendedStrings"], ["Recommended tension", "tension"], ["Colour", "color"], ["Made in", "madeIn"], ["Product code", "productCode"], ["Notable player (endorsed line)", "notablePlayer"], ["Playing profile", "profile"],
                  ] as Array<[string, keyof RacquetSpec]>).map(([label, field]) => (
                    <tr className={field === "pattern" ? "comparison-pattern-row" : ""} key={field}><th>{label}</th>{compareKeys.map((key) => <td key={key}>{field === "pattern" ? (renderPatternBadge(key) ?? "—") : (standardizedSpecDisplay(field, resolvedRacquetSpecs[key]?.[field]) ?? (field === "stiffness" ? "Not published" : "—"))}</td>)}</tr>
                  ))}
                  <tr><th>Independent validation</th>{compareKeys.map((key) => { const validation = validationPresentation(data?.specValidation?.[key]); return <td key={key}><span className={`spec-validation ${validation.tone}`}>{validation.label}</span></td>; })}</tr>
                  <tr><th>Specification source</th>{compareKeys.map((key) => {
                    const spec = resolvedRacquetSpecs[key];
                    return <td key={key}>{spec?.sourceUrl ? <a className="comparison-source" href={spec.sourceUrl} target="_blank" rel="noreferrer">{spec.source ?? "Manufacturer / retailer source"} ↗</a> : (spec?.source ?? "Catalogue fallback")}</td>;
                  })}</tr>
                  <tr><th>Best live price</th>{compareKeys.map((key) => {
                    const best = (data?.offers ?? []).filter((offer) => offer.modelKey === key && offer.inStock && offer.currentPrice !== null).sort((a, b) => (a.currentPrice ?? Infinity) - (b.currentPrice ?? Infinity))[0];
                    return <td key={key}><strong>{best?.currentPrice != null ? money.format(best.currentPrice) : "—"}</strong>{best && <small>{best.store}</small>}</td>;
                  })}</tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      <BaselineCoach
        models={coachModels}
        strings={coachStrings}
        gripLabel={gripLabel(data?.gripSize ?? "L3")}
        raised={activeMarket === "retail" && compareKeys.length > 0}
        onCompare={compareCoachPicks}
        onOpen={() => trackAnalytics("coach_open")}
      />

      <footer>
        <a className="brand footer-brand" href={activeMarket === "retail" ? "#top" : "#used-top"}><span className="brand-mark"><i /><i /><i /></span> BASELINE</a>
        <p>{activeMarket === "retail" ? "Prices can change between checks. Shipping and tax are confirmed at the retailer." : "Used listings can change quickly. Inspect the frame and use buyer-protected payment."}</p>
        <span>CAD · CANADA</span>
      </footer>
    </main>
  );
}
