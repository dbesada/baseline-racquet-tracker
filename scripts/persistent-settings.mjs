// The settings the relay keeps in .data/baseline-settings.json.
//
// The API's database lives inside the container and starts from defaults after
// every release; the relay lays this file over it. A saved change must
// therefore update only what it changed. Copying the whole database into the
// file after a release would replace the owner's settings with the defaults.

export function settingsSnapshot(dashboard) {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    gripSize: dashboard.gripSize ?? "L3",
    targets: dashboard.targets ?? {},
    usedTargets: dashboard.usedTargets ?? {},
    modelOrder: dashboard.modelOrder ?? [],
    brandPicks: dashboard.brandPicks ?? {},
    retailers: (dashboard.retailers ?? []).map(({ key, name, enabled }) => ({ key, name, enabled: Boolean(enabled) })),
  };
}

// `change` is the PATCH body the API accepted and `updated` the dashboard it
// returned. The checks follow the API's order: one PATCH changes one thing.
export function settingsAfterChange(previous, change, updated) {
  if (!previous) return settingsSnapshot(updated);
  const next = structuredClone(previous);
  next.savedAt = new Date().toISOString();
  if (change.gripSize) {
    next.gripSize = updated.gripSize ?? change.gripSize;
  } else if (change.retailerKey) {
    const retailer = (updated.retailers ?? []).find(({ key }) => key === change.retailerKey);
    const enabled = Boolean(retailer?.enabled ?? change.enabled);
    const retailers = next.retailers ?? [];
    const saved = retailers.find(({ key }) => key === change.retailerKey);
    if (saved) saved.enabled = enabled;
    else retailers.push({ key: change.retailerKey, name: retailer?.name ?? change.retailerKey, enabled });
    next.retailers = retailers;
  } else if (Number.isInteger(change.slot) && change.selectedModelKey) {
    const modelOrder = Array.isArray(next.modelOrder) && next.modelOrder.length ? next.modelOrder : [...(updated.modelOrder ?? [])];
    modelOrder[change.slot] = change.selectedModelKey;
    next.modelOrder = modelOrder;
  } else if (change.featuredBrand && Number.isInteger(change.featuredSlot) && change.selectedModelKey) {
    const brandPicks = next.brandPicks ?? {};
    const picks = Array.isArray(brandPicks[change.featuredBrand]) ? brandPicks[change.featuredBrand] : [...(updated.brandPicks?.[change.featuredBrand] ?? [])];
    picks[change.featuredSlot] = change.selectedModelKey;
    brandPicks[change.featuredBrand] = picks;
    next.brandPicks = brandPicks;
  } else if (change.modelKey && Number.isFinite(change.targetPrice)) {
    const table = change.market === "used" ? "usedTargets" : "targets";
    next[table] = { ...(next[table] ?? {}), [change.modelKey]: Number(change.targetPrice) };
  }
  return next;
}
