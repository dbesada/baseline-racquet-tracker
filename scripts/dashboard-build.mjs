// Builds the dashboard the page loads (/api/tracker) from the catalogue, the
// owner's saved settings and the price monitor's state file. Shared by the NAS
// relay and the GitHub price check that publishes to Cloudflare.

import { modelNames, defaultTargets } from "../app/lib/racquet-catalogue.js";
import { pickSaleOffers } from "../app/lib/sale-rack.js";
import { defaultBrandPicks, defaultModelOrder, defaultUsedTargets, feeds, newReleaseModelKeys, preorderModelLabels, topRatedModelKeys } from "../app/lib/tracker-catalogue.js";

// The catalogue part of the dashboard with default settings: what the API
// route returns for a new database (prices are filled in by mergeMonitorState).
export function catalogueDashboard(publicPreview = true) {
  const retailers = feeds.map((feed) => ({ key: feed.key, name: feed.name, enabled: feed.kind !== "manual", kind: feed.kind ?? "shopify", url: feed.url }))
    // Same order as the API route (SQLite ORDER BY retailer_name).
    .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
  return {
    publicPreview,
    offers: [], usedOffers: [], stringOffers: [], stringSourceResults: [], accessoryOffers: [], accessorySourceResults: [], ballOffers: [], ballSourceResults: [], saleOffers: [],
    targets: { ...defaultTargets },
    usedTargets: { ...defaultUsedTargets },
    lastCheck: null,
    dropsLast24Hours: 0,
    history: [],
    modelNames,
    modelOptions: Object.entries(modelNames).map(([key, name]) => ({
      key,
      name,
      topRated: topRatedModelKeys.has(key),
      releaseStatus: preorderModelLabels[key] ? "preorder" : newReleaseModelKeys.has(key) ? "new" : "catalogue",
      releaseLabel: preorderModelLabels[key] ?? (newReleaseModelKeys.has(key) ? "New 2026" : null),
    })),
    modelOrder: [...defaultModelOrder],
    brandPicks: structuredClone(defaultBrandPicks),
    gripSize: "L3",
    retailers,
    stores: retailers.filter((retailer) => retailer.enabled && retailer.kind !== "manual").map((retailer) => retailer.name),
  };
}

// The API only lists targets for models in the catalogue. A saved price for a
// model that has since been removed must not bring that model back.
function savedPricesForKnownModels(current, saved) {
  return Object.fromEntries(Object.entries(saved).filter(([modelKey]) => Object.hasOwn(current ?? {}, modelKey)));
}

export function applyPersistentSettings(dashboard, settings) {
  if (!settings) return dashboard;
  if (/^L[0-5]$/.test(settings.gripSize ?? "")) dashboard.gripSize = settings.gripSize;
  if (settings.targets) dashboard.targets = { ...(dashboard.targets ?? {}), ...savedPricesForKnownModels(dashboard.targets, settings.targets) };
  if (settings.usedTargets) dashboard.usedTargets = { ...(dashboard.usedTargets ?? {}), ...savedPricesForKnownModels(dashboard.usedTargets, settings.usedTargets) };
  if (Array.isArray(settings.modelOrder) && settings.modelOrder.length) dashboard.modelOrder = settings.modelOrder;
  if (settings.brandPicks && typeof settings.brandPicks === "object") {
    dashboard.brandPicks = { ...(dashboard.brandPicks ?? {}), ...settings.brandPicks };
  }
  if (Array.isArray(settings.retailers)) {
    const enabledByKey = new Map(settings.retailers.map((retailer) => [retailer.key, Boolean(retailer.enabled)]));
    dashboard.retailers = (dashboard.retailers ?? []).map((retailer) => enabledByKey.has(retailer.key)
      ? { ...retailer, enabled: enabledByKey.get(retailer.key) }
      : retailer);
    dashboard.stores = dashboard.retailers
      .filter((retailer) => retailer.enabled && retailer.kind !== "manual")
      .map((retailer) => retailer.name);
  }
  return dashboard;
}

// Fills `dashboard` (mutated) with prices, offers and check results from the
// price monitor's state file.
export function mergeMonitorState(dashboard, state, now = Date.now()) {
  const cached = Object.values(state.offers ?? {});
  const offers = cached.map((offer) => ({
    id: offer.id,
    modelKey: offer.modelKey,
    store: offer.store,
    title: offer.title,
    url: offer.url,
    currentPrice: offer.price,
    previousPrice: null,
    compareAtPrice: Number.isFinite(offer.compareAtPrice) ? offer.compareAtPrice : null,
    inStock: true,
    gripSizes: offer.gripSizes ?? [state.gripSize ?? "L3"],
    specs: offer.specs ?? null,
    sourceState: offer.sourceState ?? "fresh",
    lastChecked: offer.lastChecked ?? state.checkedAt,
  }));
  const retailerResults = Array.isArray(state.retailerResults) ? state.retailerResults : [];
  const stores = new Set(offers.map((offer) => offer.store));
  const bestByModel = new Map();
  for (const offer of offers) {
    if (offer.modelKey === "other-sale") continue;
    const current = bestByModel.get(offer.modelKey);
    if (!current || offer.currentPrice < current.currentPrice) bestByModel.set(offer.modelKey, offer);
  }
  dashboard.offers = offers;
  // Sale cards also show the listing photo (https only), when the shop has one.
  const salePhotos = new Map(cached.filter((offer) => /^https:\/\//.test(offer.imageUrl ?? "")).map((offer) => [offer.id, offer.imageUrl]));
  dashboard.saleOffers = pickSaleOffers(offers)
    .map((offer) => salePhotos.has(offer.id) ? { ...offer, imageUrl: salePhotos.get(offer.id) } : offer);
  dashboard.specialOffers = (state.specialOffers ?? []).map((offer) => ({
    id: offer.id,
    modelKey: offer.modelKey,
    store: offer.store,
    title: offer.title,
    url: offer.url,
    currentPrice: offer.price,
    previousPrice: null,
    compareAtPrice: Number.isFinite(offer.compareAtPrice) ? offer.compareAtPrice : null,
    inStock: true,
    gripSizes: offer.gripSizes ?? [],
    specs: offer.specs ?? null,
    sourceState: offer.sourceState ?? "fresh",
    lastChecked: offer.lastChecked ?? state.checkedAt,
  }));
  dashboard.stringOffers = (state.stringOffers ?? []).map((offer) => ({
    id: offer.id,
    store: offer.store,
    title: offer.title,
    url: offer.url,
    currentPrice: offer.price,
    compareAtPrice: Number.isFinite(offer.compareAtPrice) ? offer.compareAtPrice : null,
    inStock: offer.inStock !== false,
    brand: offer.brand ?? "Unknown",
    type: offer.type ?? "Other",
    gauges: offer.gauges ?? ["Not listed"],
    format: offer.format ?? "Single package",
    sourceState: offer.sourceState ?? "fresh",
    lastChecked: offer.lastChecked ?? state.checkedAt,
  }));
  dashboard.stringSourceResults = state.stringSourceResults ?? [];
  dashboard.accessoryOffers = (state.accessoryOffers ?? []).map((offer) => ({
    id: offer.id,
    store: offer.store,
    title: offer.title,
    url: offer.url,
    currentPrice: offer.price,
    compareAtPrice: Number.isFinite(offer.compareAtPrice) ? offer.compareAtPrice : null,
    inStock: offer.inStock !== false,
    brand: offer.brand ?? "Other",
    category: offer.category ?? "Racquet care",
    detail: offer.detail ?? "Single item",
    sourceState: offer.sourceState ?? "fresh",
    lastChecked: offer.lastChecked ?? state.checkedAt,
  }));
  dashboard.accessorySourceResults = state.accessorySourceResults ?? [];
  dashboard.ballOffers = (state.ballOffers ?? []).map((offer) => ({
    id: offer.id,
    store: offer.store,
    title: offer.title,
    url: offer.url,
    currentPrice: offer.price,
    compareAtPrice: Number.isFinite(offer.compareAtPrice) ? offer.compareAtPrice : null,
    inStock: offer.inStock !== false,
    brand: offer.brand ?? "Other",
    type: offer.type ?? "Other",
    package: offer.package ?? "Package size not listed",
    sourceState: offer.sourceState ?? "fresh",
    lastChecked: offer.lastChecked ?? state.checkedAt,
  }));
  dashboard.ballSourceResults = state.ballSourceResults ?? [];
  dashboard.lastCheck = {
    checkedAt: state.checkedAt,
    storesChecked: retailerResults.length ? retailerResults.filter((result) => result.ok).length : stores.size,
    offersFound: offers.length,
    failures: retailerResults.filter((result) => !result.ok).length,
  };
  dashboard.retailerResults = retailerResults;
  dashboard.sourceHealth = state.sourceHealth ?? {
    liveSources: retailerResults.filter((result) => result.ok).length,
    totalSources: retailerResults.length,
    failures: retailerResults.filter((result) => !result.ok).length,
    freshOffers: offers.filter((offer) => offer.sourceState !== "stale").length,
    staleOffers: offers.filter((offer) => offer.sourceState === "stale").length,
    averageDurationMs: 0,
  };
  dashboard.usedOffers = (state.usedOffers ?? []).map((offer) => ({
    id: offer.id,
    modelKey: offer.modelKey,
    store: offer.store,
    title: offer.title,
    url: offer.url,
    currentPrice: offer.price,
    previousPrice: null,
    compareAtPrice: Number.isFinite(offer.compareAtPrice) ? offer.compareAtPrice : null,
    inStock: true,
    gripSizes: offer.gripSizes ?? [state.gripSize ?? "L3"],
    condition: offer.condition ?? "Used",
    currency: offer.currency ?? "CAD",
    sourceState: "fresh",
    lastChecked: offer.lastChecked ?? state.checkedAt,
  }));
  dashboard.usedSourceResults = state.usedSourceResults ?? [];
  dashboard.racquetSpecs = state.racquetSpecs ?? dashboard.racquetSpecs ?? {};
  dashboard.retailerPhotos = state.retailerPhotos ?? {};
  dashboard.specValidation = state.specValidation ?? {};
  dashboard.manufacturerSpecResults = state.manufacturerSpecResults ?? [];
  dashboard.modelSelectionRefreshes = state.modelSelectionRefreshes ?? {};
  dashboard.gripSize = state.selectedGripSize ?? dashboard.gripSize ?? state.gripSize ?? "L3";
  const cutoff = now - 24 * 60 * 60 * 1000;
  dashboard.dropsLast24Hours = new Set((state.dropHistory ?? [])
    .filter((drop) => Date.parse(drop.detectedAt) >= cutoff)
    .map((drop) => drop.id)).size;
  dashboard.history = [...bestByModel.values()].map((offer) => ({
    modelKey: offer.modelKey,
    price: offer.currentPrice,
    checkedAt: state.checkedAt,
  }));
  return dashboard;
}
