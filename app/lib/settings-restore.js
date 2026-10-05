// Turns the relay's saved settings file into the rows the API should store.
//
// The relay sends .data/baseline-settings.json to the API when it starts, so
// the database matches the settings the owner saved even if it was created
// fresh. The file is only trusted as far as the API's own rules allow: unknown
// keys, bad prices, and shortlists with duplicates or the wrong length are left
// out, and the database keeps its current value for those.

/**
 * @typedef {{
 *   gripSize: string | null,
 *   retailers: [string, boolean][],
 *   targets: [string, number][],
 *   usedTargets: [string, number][],
 *   modelOrder: string[] | null,
 *   brandPicks: [string, string[]][],
 * }} SettingsRestorePlan
 */

/**
 * @param {any} settings
 * @param {{
 *   gripSizes: Set<string>, retailerKeys: Set<string>, targetKeys: Set<string>, modelKeys: Set<string>,
 *   shortlistSlotCount: number, featuredBrands: string[], featuredSlotCount: number,
 *   belongsToBrand: (modelKey: string, brand: string) => boolean,
 * }} rules
 * @returns {SettingsRestorePlan}
 */
export function planSettingsRestore(settings, rules) {
  /** @type {SettingsRestorePlan} */
  const plan = { gripSize: null, retailers: [], targets: [], usedTargets: [], modelOrder: null, brandPicks: [] };
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return plan;

  if (rules.gripSizes.has(settings.gripSize)) plan.gripSize = settings.gripSize;

  for (const retailer of Array.isArray(settings.retailers) ? settings.retailers : []) {
    if (rules.retailerKeys.has(retailer?.key) && typeof retailer.enabled === "boolean") {
      plan.retailers.push([retailer.key, retailer.enabled]);
    }
  }

  for (const [field, rows] of [["targets", plan.targets], ["usedTargets", plan.usedTargets]]) {
    const prices = settings[field];
    if (!prices || typeof prices !== "object" || Array.isArray(prices)) continue;
    for (const [modelKey, price] of Object.entries(prices)) {
      if (rules.targetKeys.has(modelKey) && Number.isFinite(price) && price >= 1) rows.push([modelKey, price]);
    }
  }

  const validPicks = (picks, count, allowed) => Array.isArray(picks)
    && picks.length === count
    && new Set(picks).size === count
    && picks.every(allowed);
  if (validPicks(settings.modelOrder, rules.shortlistSlotCount, (modelKey) => rules.modelKeys.has(modelKey))) {
    plan.modelOrder = [...settings.modelOrder];
  }

  const brandPicks = settings.brandPicks && typeof settings.brandPicks === "object" ? settings.brandPicks : {};
  for (const brand of rules.featuredBrands) {
    const picks = brandPicks[brand];
    if (validPicks(picks, rules.featuredSlotCount, (modelKey) => rules.belongsToBrand(modelKey, brand))) {
      plan.brandPicks.push([brand, [...picks]]);
    }
  }
  return plan;
}
