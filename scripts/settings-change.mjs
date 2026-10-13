import { modelNames } from "../app/lib/racquet-catalogue.js";
import { featuredBrands, feeds, shortlistSlotCount, featuredSlotCount } from "../app/lib/tracker-catalogue.js";

// Applies one admin change (the PATCH body the page sends to /api/tracker) to
// the saved settings (same format as direct-data/baseline-settings.json).
// Returns { settings } or { error }. The input is not modified.
//
// Used by the Cloudflare Worker for the admin site; the NAS API route applies
// the same changes to its D1 database.

const grips = new Set(["L0", "L1", "L2", "L3", "L4", "L5"]);
const known = (modelKey) => typeof modelKey === "string" && Object.hasOwn(modelNames, modelKey);

export function applySettingsChange(saved, change) {
  const settings = structuredClone(saved ?? {});
  settings.version = 1;
  settings.savedAt = new Date().toISOString();
  if (!change || typeof change !== "object") return { error: "Nothing to change." };

  if (change.gripSize !== undefined) {
    if (!grips.has(change.gripSize)) return { error: "Choose a grip size from L0 to L5." };
    settings.gripSize = change.gripSize;
    return { settings };
  }

  if (change.retailerKey !== undefined) {
    const feed = feeds.find((candidate) => candidate.key === change.retailerKey);
    if (!feed) return { error: "That retailer is not tracked." };
    const retailers = Array.isArray(settings.retailers) ? settings.retailers : [];
    const saved = retailers.find((retailer) => retailer.key === feed.key);
    if (saved) saved.enabled = Boolean(change.enabled);
    else retailers.push({ key: feed.key, name: feed.name, enabled: Boolean(change.enabled) });
    settings.retailers = retailers;
    return { settings };
  }

  if (change.featuredBrand !== undefined) {
    const slot = Number(change.featuredSlot);
    if (!featuredBrands.includes(change.featuredBrand) || !Number.isInteger(slot) || slot < 0 || slot >= featuredSlotCount) return { error: "That featured slot does not exist." };
    if (!known(change.selectedModelKey) || !modelNames[change.selectedModelKey].startsWith(`${change.featuredBrand} `)) return { error: "Choose a racquet from that brand." };
    settings.brandPicks ??= {};
    const picks = [...(settings.brandPicks[change.featuredBrand] ?? [])];
    if (picks.some((modelKey, index) => index !== slot && modelKey === change.selectedModelKey)) return { error: "That racquet is already featured." };
    picks[slot] = change.selectedModelKey;
    settings.brandPicks[change.featuredBrand] = picks;
    return { settings };
  }

  if (change.slot !== undefined) {
    const slot = Number(change.slot);
    if (!Number.isInteger(slot) || slot < 0 || slot >= shortlistSlotCount) return { error: "That watchlist slot does not exist." };
    if (!known(change.selectedModelKey)) return { error: "That racquet is not tracked." };
    const order = [...(settings.modelOrder ?? [])];
    if (order.some((modelKey, index) => index !== slot && modelKey === change.selectedModelKey)) return { error: "That racquet is already on the watchlist." };
    order[slot] = change.selectedModelKey;
    settings.modelOrder = order;
    return { settings };
  }

  if (change.modelKey !== undefined) {
    const price = Number(change.targetPrice);
    if (!known(change.modelKey) || !(Number.isFinite(price) && price > 0 && price < 10000)) return { error: "Enter a target price for a tracked racquet." };
    const field = change.market === "used" ? "usedTargets" : "targets";
    settings[field] = { ...(settings[field] ?? {}), [change.modelKey]: price };
    return { settings };
  }

  return { error: "That change is not supported." };
}
