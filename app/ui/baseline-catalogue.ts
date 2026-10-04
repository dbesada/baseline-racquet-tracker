// Static catalogue data and pure helpers for the Baseline UI. Moved out of
// BaselineApp.tsx unchanged so the component file holds only the component.

import type { Offer, StringOffer, AccessoryOffer, BallOffer, Dashboard, GripSize, BrandKey, BrandViewKey, HeadSizeFilter, WeightFilter, PatternFilter, CatalogueSort, CatalogueMetric, StringType, StringFormat, AccessoryCategory, BallType, PublicPreferences, RacquetSpec, SpecValidation, UsedMarketplace, SpecialEditionGroup } from "./baseline-types";

export const publicPreferencesKey = "baseline-public-preferences-v1";

export function readPublicPreferences(): PublicPreferences {
  try {
    const parsed = JSON.parse(localStorage.getItem(publicPreferencesKey) ?? "{}") as PublicPreferences;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writePublicPreferences(preferences: PublicPreferences) {
  localStorage.setItem(publicPreferencesKey, JSON.stringify(preferences));
}

export function applyPublicPreferences(dashboard: Dashboard): Dashboard {
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

export function publicPreferencesFromDashboard(dashboard: Dashboard): PublicPreferences {
  return { gripSize: dashboard.gripSize, modelOrder: dashboard.modelOrder, targets: dashboard.targets, usedTargets: dashboard.usedTargets };
}

export const accents: Record<string, string> = {
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

export const brandList: Array<Exclude<BrandKey, "all">> = ["Wilson", "Yonex", "Babolat", "Head", "Tecnifibre", "Dunlop", "Prince", "Volkl"];

export const brandViews: BrandViewKey[] = ["all", ...brandList, "catalogue", "special", "strings", "balls", "accessories", "guide", "string-guide"];

export const alphabeticalBrandList = [...brandList].sort((a, b) => a.localeCompare(b, "en-CA", { sensitivity: "base" }));

export const maxCompareFrames = 6;

export const cataloguePageSize = 24;

export const stringPageSize = 6;

export const stringTypeOrder: StringType[] = ["Polyester", "Multifilament", "Synthetic gut", "Natural gut", "Hybrid", "Monofilament", "Other"];

export const stringGaugeOrder = ["15", "15L", "16", "16L", "17", "17L", "18", "18L", "19", "20", "22", "Not listed"];

export const stringFormatOrder: StringFormat[] = ["Set", "Half set", "Reel", "Single package"];

export const accessoryPageSize = 6;

export const accessoryCategoryOrder: AccessoryCategory[] = ["Replacement grips", "Overgrips", "Grommets & bumpers", "Dampeners", "Racquet bags", "Customization", "Racquet care"];

export const accessoryCategoryMarks: Record<AccessoryCategory, string> = {
  "Replacement grips": "RG",
  Overgrips: "OG",
  "Grommets & bumpers": "GB",
  Dampeners: "DV",
  "Racquet bags": "RB",
  Customization: "CT",
  "Racquet care": "RC",
};

export const ballPageSize = 8;

export const ballTypeOrder: BallType[] = ["Extra duty", "Regular duty", "All court", "Clay court", "Pressureless", "Junior", "Other"];

export const gripOptions: Array<{ key: GripSize; inches: string }> = [
  { key: "L0", inches: "4 in" },
  { key: "L1", inches: "4 1/8 in" }, { key: "L2", inches: "4 1/4 in" },
  { key: "L3", inches: "4 3/8 in" }, { key: "L4", inches: "4 1/2 in" },
  { key: "L5", inches: "4 5/8 in" },
];

export function gripLabel(grip: GripSize = "L3") {
  const option = gripOptions.find((candidate) => candidate.key === grip) ?? gripOptions[3];
  return `${option.key} / ${option.inches}`;
}

export function canonicalStringBrand(value: string, title = "") {
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

export function stringFamilyKey(offer: StringOffer) {
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

export function accessoryFamilyKey(offer: AccessoryOffer) {
  const escapedBrand = offer.brand.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const normalized = offer.title.toLowerCase()
    .replace(new RegExp(`^${escapedBrand}\\s*`), "")
    .replace(/\b(?:tennis|racquet|racket|accessory|accessories)\b/g, " ")
    .replace(/\b(?:black|white|blue|red|green|yellow|pink|purple|grey|gray|orange|navy|silver|gold)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return `${offer.category}:${offer.brand.toLowerCase()}:${normalized || offer.title.toLowerCase()}:${offer.detail}`;
}

export function ballFamilyKey(offer: BallOffer) {
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

export function specialEditionName(title: string) {
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

export function specialGripLabels(gripSizes: string[] = []) {
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

export function specialEditionFamily(title: string) {
  if (/session de soir[eé]e|night session/i.test(title)) return "roland-garros";
  return (specialEditionName(title) ?? "special").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function specialEditionModelKey(offer: Offer) {
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

export function specialEditionGroupLabel(offers: Offer[]) {
  const names = offers.map((offer) => specialEditionName(offer.title)).filter(Boolean);
  if (names.includes("Night Session")) return "Roland Garros Night Session";
  return names[0] ?? "Special edition";
}

export function preferredSpecialTitle(offers: Offer[]) {
  const generic = /\b(?:tennis racquet|tennis racket|racquet|racket|unstrung|strung)\b/i;
  return [...offers].sort((a, b) => {
    const aPenalty = generic.test(a.title) ? 1 : 0;
    const bPenalty = generic.test(b.title) ? 1 : 0;
    return aPenalty - bPenalty || a.title.length - b.title.length || a.title.localeCompare(b.title);
  })[0]?.title ?? "Special-edition racquet";
}

export function specialOfferBrand(group: SpecialEditionGroup): string {
  const known = modelBrand(group.modelKey);
  if (known) return known;
  return brandList.find((brand) => group.title.toLowerCase().includes(brand.toLowerCase())) ?? "Special release";
}

export const featuredByBrand: Record<Exclude<BrandKey, "all">, string[]> = {
  Wilson: ["blade-v10", "defyer-98-pro-v1", "clash-100", "clash-100-pro", "ultra-100-v5", "pro-staff-97-classic"],
  Yonex: ["ezone-98", "ezone-100", "vcore-98", "vcore-100", "percept-97", "percept-100"],
  Babolat: ["pure-aero-98", "pure-aero-100", "pure-drive-98", "pure-drive-100", "pure-strike-98", "pure-strike-100"],
  Head: ["speed-pro-2026", "speed-mp", "gravity-pro-2025", "gravity-mp-2025", "radical-pro-2025", "radical-mp-2025"],
  Tecnifibre: ["tf40-290", "tf40-305", "tfight-300s", "tfight-305s", "fire-305s", "tfx1-300"],
  Dunlop: ["dunlop-cx-200", "dunlop-cx-200-tour-16x19", "dunlop-cx-200-tour-18x20", "dunlop-cx-400", "dunlop-cx-400-tour", "dunlop-fx-500-lite-2026"],
  Prince: ["prince-vortex-100-310", "prince-vortex-100-300", "prince-tour-100p-305", "prince-o3-ripstick-100-280", "prince-legacy-110", "prince-warrior-100-265"],
  Volkl: ["volkl-c10-evo", "volkl-v1-evo", "volkl-v1-classic", "volkl-vcell-v1-mp", "volkl-vcell-10-320", "volkl-vcell-10-300"],
};

export function modelBrand(modelKey: string): Exclude<BrandKey, "all"> | null {
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

export const manufacturerPublishedSpecs: Record<string, RacquetSpec> = {
  "defyer-100-v1": { swingweight: "295 kg·cm² · unstrung", productCode: "WR215411", source: "Wilson official", sourceUrl: "https://ph.wilson.com/products/wilson-defyer-100-v1-tennis-racket" },
  "pure-aero-98": { swingweight: "295 kg·cm² · unstrung", source: "Babolat official", sourceUrl: "https://www.babolat.com/us/pure-aero-98-gen9-unstrung/101568.html" },
  "pure-aero-100": { swingweight: "290 kg·cm² · unstrung", source: "Babolat official", sourceUrl: "https://www.babolat.com/us/pure-aero-gen9-unstrung/101569.html" },
  "pure-aero-team-2026": { swingweight: "280 kg·cm² · unstrung", source: "Babolat official", sourceUrl: "https://www.babolat.com/us/tennis/racquets.html" },
  "pure-aero-lite-2026": { swingweight: "275 kg·cm² · unstrung", source: "Babolat official", sourceUrl: "https://www.babolat.com/us/tennis/racquets.html" },
  "pure-aero-plus": { swingweight: "290 kg·cm² · unstrung", source: "Babolat official", sourceUrl: "https://www.babolat.com/us/tennis/racquets.html" },
  "dunlop-cx-200-tour-16x19": { head: "95 in²", weight: "310 g", balance: "31.0 cm", swingweight: "290 kg·cm² · unstrung", stiffness: "65 RA", pattern: "16 × 19", beam: "20.5 mm", source: "Dunlop official", sourceUrl: "https://dunlopsports.com/en-gb/tennis/rackets/cx200-tour-16x19/2" },
  "prince-vortex-100-310": { head: "100 in²", weight: "310 g", swingweight: "285 kg·cm² · unstrung", pattern: "16 × 19", source: "Prince official", sourceUrl: "https://princetennis-hk.com/en/products/7t53s101ul2" },
};

export const racquetSpecs: Record<string, RacquetSpec> = {
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

export const publishedStiffness: Record<string, string> = {
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

export function notablePlayerFor(modelKey: string) {
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

export function reportedTourPresence(modelKey: string) {
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

export function specNumber(value?: string) {
  return value ? Number.parseFloat(value) : Number.NaN;
}

export function standardizedSpecDisplay(field: keyof RacquetSpec, value?: string, includeConversion = true) {
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

export function validationPresentation(validation?: SpecValidation) {
  if (!validation || validation.status === "insufficient") return { tone: "pending", label: "Retailer check pending" };
  if (validation.status === "conflict") return { tone: "conflict", label: `${validation.conflictFields} spec${validation.conflictFields === 1 ? "" : "s"} retailer-corrected` };
  if (validation.status === "retailer-consensus") return { tone: "consensus", label: `Retailer consensus · ${validation.sources.length} sources` };
  return { tone: "confirmed", label: `Confirmed · ${validation.sources.length} retailers` };
}

export function normalizedPattern(value?: string) {
  return value?.toLowerCase().replaceAll("×", "x").replace(/\s+/g, "") ?? "";
}

export function patternPresentation(value?: string) {
  const normalized = normalizedPattern(value);
  if (normalized === "16x19") return { tone: "open", label: "16 × 19", detail: "OPEN" };
  if (normalized === "16x20") return { tone: "tighter", label: "16 × 20", detail: "TIGHTER" };
  if (normalized === "18x20") return { tone: "dense", label: "18 × 20", detail: "DENSE" };
  if (normalized === "16x18") return { tone: "very-open", label: "16 × 18", detail: "VERY OPEN" };
  return value ? { tone: "alternate", label: value, detail: "ALTERNATE" } : null;
}

export function matchesCatalogueFilters(modelKey: string, headSize: HeadSizeFilter, weight: WeightFilter, pattern: PatternFilter, specs: Record<string, RacquetSpec> = racquetSpecs) {
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

export function styleSignal(modelKey: string, name: string, spec?: RacquetSpec) {
  const value = `${modelKey} ${name} ${spec?.color ?? ""}`.toLowerCase();
  return {
    distinctive: /rafa|aero|vcore|defyer|extreme|boom|shift|concept|wimbledon|neon|yellow|orange|red|pink|purple|lime|volt|electric|blast/.test(value) ? 2 : 0,
    understated: /pro staff|blade|percept|tf40|prestige|classic|noir|black|white|silver|graphite|navy|forest/.test(value) ? 2 : 0,
  };
}

export function sortCatalogueKeys(keys: string[], sort: CatalogueSort, specs: Record<string, RacquetSpec>, names: Record<string, string>, metrics: Record<string, CatalogueMetric>) {
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

export const modelImages: Record<string, string> = {
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

export function modelImage(modelKey: string, officialImage?: string) {
  if (officialImage?.startsWith("https://")) return officialImage;
  if (modelImages[modelKey]) return modelImages[modelKey];
  // A neutral placeholder is more useful than a convincing-but-wrong frame photo.
  return "/racquets/optimized-v1/racquet-photo-pending.svg?v=0.1.67";
}

export function isManufacturerSpec(spec?: RacquetSpec) {
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

export const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 2 });

export const usdMoney = new Intl.NumberFormat("en-CA", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export function offerMoney(offer: Offer) {
  return (offer.currency === "USD" ? usdMoney : money).format(offer.currentPrice ?? 0);
}

export function searchSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export const usedMarketplaces: UsedMarketplace[] = [
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

export function relativeTime(value?: string) {
  if (!value) return "Not checked yet";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function freshnessRank(offer: { sourceState?: "fresh" | "stale" }) {
  return offer.sourceState === "stale" ? 1 : 0;
}

export function uniqueRetailerOffers(offers: Offer[]) {
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
