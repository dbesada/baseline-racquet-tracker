// Values derived from the tracker dashboard. Plain functions so the screen can
// memoize them and so they can be reasoned about without rendering anything.

import type { CoachModel } from "./BaselineCoach";
import type { CatalogueMetric, Dashboard, Offer, OpportunityMode, RacquetSpec } from "./baseline-types";
import { freshnessRank, isManufacturerSpec, manufacturerPublishedSpecs, modelBrand, modelImages, notablePlayerFor, outboundHref, publishedStiffness, racquetSpecs, reportedTourPresence } from "./baseline-catalogue";

// Merges the built-in catalogue specs with what the latest check verified:
// manufacturer specs first, then retailer consensus and corrections.
export function resolveRacquetSpecs(data: Dashboard | null) {
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
  // A retailer's listing photo fills in only where there is no manufacturer
  // photo and no catalogue photo, and is credited to the shop.
  for (const [modelKey, photo] of Object.entries(data?.retailerPhotos ?? {})) {
    const existing = resolved[modelKey] ?? {};
    if (existing.imageUrl?.startsWith("https://") || modelImages[modelKey] || !photo?.url?.startsWith("https://")) continue;
    resolved[modelKey] = { ...existing, imageUrl: photo.url, imageSource: photo.store };
  }
  return resolved;
}

// Lowest in-stock price, retailer count and best discount for every model.
export function catalogueMetrics(data: Dashboard | null) {
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
}

export type Opportunity = { mode: OpportunityMode; label: string; offer: Offer; target: number; delta: number; watchlist: boolean; stores: number; tourPresence?: number };

// The best watchlist deal against its target, falling back to the deepest
// sale-rack discount when nothing on the watchlist is in stock.
function bestOpportunity(data: Dashboard) {
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
}

// The three "Best price finder" rankings: best deal, most stocked, most played.
export function opportunityChoices(data: Dashboard | null): Opportunity[] {
  if (!data) return [];
  const best = bestOpportunity(data);
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
    best && { mode: "target" as const, label: "Best deal", ...best, stores: storesByModel.get(best.offer.modelKey)?.size ?? 1 },
    widest && { mode: "availability" as const, label: "Most stocked", offer: widest, target: data.targets[widest.modelKey] ?? 0, delta: (widest.currentPrice ?? 0) - (data.targets[widest.modelKey] ?? 0), watchlist: true, stores: storesByModel.get(widest.modelKey)?.size ?? 1 },
    tourFavourite && { mode: "tour" as const, label: "Most played", offer: tourFavourite, target: data.targets[tourFavourite.modelKey] ?? 0, delta: (tourFavourite.currentPrice ?? 0) - (data.targets[tourFavourite.modelKey] ?? 0), watchlist: true, stores: storesByModel.get(tourFavourite.modelKey)?.size ?? 1, tourPresence: reportedTourPresence(tourFavourite.modelKey) },
  ].filter(Boolean) as Opportunity[];
}

export type MarketplaceHealth = ReturnType<typeof marketplaceHealth>[number];

// Collector status for each used marketplace, from the latest check.
export function marketplaceHealth(data: Dashboard | null) {
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
}

// Racquets the coach may recommend: anything with a live price, preferring an
// offer that is verified in the selected grip.
export function coachModels(data: Dashboard | null, specs: Record<string, RacquetSpec>): CoachModel[] {
  return (data?.modelOptions ?? []).flatMap((model) => {
    const currentGrip = data?.gripSize ?? "L3";
    const offers = (data?.offers ?? []).filter((offer) => offer.modelKey === model.key && offer.inStock && offer.currentPrice !== null);
    const verifiedGripOffers = offers.filter((offer) => offer.gripSizes.includes(currentGrip));
    const best = [...(verifiedGripOffers.length ? verifiedGripOffers : offers)]
      .sort((a, b) => freshnessRank(a) - freshnessRank(b) || (a.currentPrice ?? Infinity) - (b.currentPrice ?? Infinity))[0];
    if (!best?.currentPrice || !best.url) return [];
    const spec = specs[model.key] ?? {};
    return [{
      key: model.key,
      name: model.name,
      brand: modelBrand(model.key) ?? model.name.split(/\s+/)[0] ?? "Racquet",
      head: spec.head,
      weight: spec.weight,
      pattern: spec.pattern,
      profile: spec.profile,
      color: spec.color,
      price: best.currentPrice,
      store: best.store,
      url: outboundHref(best.id),
    }];
  });
}
