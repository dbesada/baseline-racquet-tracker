import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { settingsAfterChange, settingsSnapshot } from "../scripts/persistent-settings.mjs";

const saved = {
  version: 1,
  savedAt: "2026-10-05T02:00:00.000Z",
  gripSize: "L2",
  targets: { "pure-aero-100": 220 },
  usedTargets: { "pure-aero-100": 140 },
  modelOrder: ["pure-aero-100", "defyer-100-v1", "percept-100", "ezone-98", "pure-aero-98", "speed-pro-2026"],
  brandPicks: { babolat: ["pure-aero-100", "pure-drive-98"] },
  retailers: [{ key: "a", name: "A", enabled: false }, { key: "b", name: "B", enabled: true }],
};
// What the API returns right after a release: its database holds defaults
// plus the one change just made.
const defaults = {
  gripSize: "L3",
  targets: { "pure-aero-100": 250 },
  usedTargets: { "pure-aero-100": 150 },
  modelOrder: ["blade-v10", "blade-v9", "blade-v8", "ezone-98", "pure-aero-98", "speed-pro-2026"],
  brandPicks: { babolat: ["pure-aero", "pure-drive"] },
  retailers: [{ key: "a", name: "A", enabled: true }, { key: "b", name: "B", enabled: true }],
};
const unchanged = (next, ...except) => {
  for (const key of ["gripSize", "targets", "usedTargets", "modelOrder", "brandPicks", "retailers"]) {
    if (!except.includes(key)) assert.deepEqual(next[key], saved[key], `${key} must keep the saved value`);
  }
};

test("changing a shortlist slot after a release keeps every other setting", () => {
  // The case from release 0.1.76: slot 0 changed, grip and slots 1-2 reset.
  const next = settingsAfterChange(saved, { slot: 0, selectedModelKey: "blade-100-v9" }, { ...defaults, modelOrder: ["blade-100-v9", ...defaults.modelOrder.slice(1)] });
  assert.deepEqual(next.modelOrder, ["blade-100-v9", ...saved.modelOrder.slice(1)]);
  unchanged(next, "modelOrder");
});

test("each kind of change updates only its own setting", () => {
  unchanged(settingsAfterChange(saved, { gripSize: "L4" }, { ...defaults, gripSize: "L4" }), "gripSize");
  assert.equal(settingsAfterChange(saved, { gripSize: "L4" }, { ...defaults, gripSize: "L4" }).gripSize, "L4");

  const retailer = settingsAfterChange(saved, { retailerKey: "b", enabled: false }, { ...defaults, retailers: [defaults.retailers[0], { key: "b", name: "B", enabled: false }] });
  assert.deepEqual(retailer.retailers, [{ key: "a", name: "A", enabled: false }, { key: "b", name: "B", enabled: false }]);
  unchanged(retailer, "retailers");

  const pick = settingsAfterChange(saved, { featuredBrand: "babolat", featuredSlot: 1, selectedModelKey: "pure-strike-98" }, defaults);
  assert.deepEqual(pick.brandPicks.babolat, ["pure-aero-100", "pure-strike-98"]);
  unchanged(pick, "brandPicks");

  const target = settingsAfterChange(saved, { modelKey: "percept-100", targetPrice: 199 }, defaults);
  assert.deepEqual(target.targets, { "pure-aero-100": 220, "percept-100": 199 });
  unchanged(target, "targets");

  const used = settingsAfterChange(saved, { modelKey: "pure-aero-100", targetPrice: 120, market: "used" }, defaults);
  assert.deepEqual(used.usedTargets, { "pure-aero-100": 120 });
  unchanged(used, "usedTargets");
});

test("the saved settings are not modified in place, and a first save copies the dashboard", () => {
  const before = structuredClone(saved);
  settingsAfterChange(saved, { slot: 2, selectedModelKey: "blade-v9" }, defaults);
  assert.deepEqual(saved, before);
  const first = settingsAfterChange(null, { gripSize: "L4" }, { ...defaults, gripSize: "L4" });
  assert.deepEqual({ ...first, savedAt: null }, { ...settingsSnapshot({ ...defaults, gripSize: "L4" }), savedAt: null });
});

test("the relay saves only the changed setting after a PATCH", () => {
  const relay = fs.readFileSync(new URL("../scripts/baseline-relay.mjs", import.meta.url), "utf8");
  assert.match(relay, /writePersistentSettings\(settingsAfterChange\(await readPersistentSettings\(\), parsedBody, updatedDashboard\)\)/);
  assert.doesNotMatch(relay, /writePersistentSettings\(settingsSnapshot\(updatedDashboard\)\)/);
});
