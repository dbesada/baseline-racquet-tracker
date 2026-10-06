import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { planSettingsRestore } from "../app/lib/settings-restore.js";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const models = ["a1", "a2", "a3", "b1", "b2", "b3", "c1"];
const rules = {
  gripSizes: new Set(["L0", "L1", "L2", "L3", "L4", "L5"]),
  retailerKeys: new Set(["shop-a", "shop-b"]),
  targetKeys: new Set(models),
  modelKeys: new Set(models),
  shortlistSlotCount: 3,
  featuredBrands: ["A", "B"],
  featuredSlotCount: 2,
  belongsToBrand: (modelKey, brand) => modelKey.startsWith(brand.toLowerCase()),
};

test("a valid settings file becomes the rows to store", () => {
  const plan = planSettingsRestore({
    gripSize: "L2",
    retailers: [{ key: "shop-a", name: "A", enabled: false }, { key: "shop-b", name: "B", enabled: true }],
    targets: { a1: 220 },
    usedTargets: { a1: 140.5 },
    modelOrder: ["a1", "b2", "c1"],
    brandPicks: { A: ["a2", "a1"], B: ["b3", "b1"] },
  }, rules);
  assert.deepEqual(plan, {
    gripSize: "L2",
    retailers: [["shop-a", false], ["shop-b", true]],
    targets: [["a1", 220]],
    usedTargets: [["a1", 140.5]],
    modelOrder: ["a1", "b2", "c1"],
    brandPicks: [["A", ["a2", "a1"]], ["B", ["b3", "b1"]]],
  });
});

test("values the API would refuse are left out", () => {
  const plan = planSettingsRestore({
    gripSize: "XL",
    retailers: [{ key: "unknown", enabled: true }, { key: "shop-a", enabled: "yes" }, null],
    targets: { a1: 0, toString: 100, zz: 150, a2: "200", a3: Number.NaN },
    usedTargets: [],
    modelOrder: ["a1", "a1", "b1"],
    brandPicks: { A: ["a1", "b1"], B: ["b1"], Z: ["z1", "z2"] },
  }, rules);
  assert.deepEqual(plan, { gripSize: null, retailers: [], targets: [], usedTargets: [], modelOrder: null, brandPicks: [] });
  for (const value of [null, undefined, [], "settings", 3]) {
    assert.deepEqual(planSettingsRestore(value, rules), { gripSize: null, retailers: [], targets: [], usedTargets: [], modelOrder: null, brandPicks: [] });
  }
  assert.equal(planSettingsRestore({ modelOrder: ["a1", "b1", "nope"] }, rules).modelOrder, null);
  assert.equal(planSettingsRestore({ modelOrder: ["a1", "b1"] }, rules).modelOrder, null);
});

test("the API stores the restored settings, and only the relay can ask for it", () => {
  const route = read("app/api/tracker/route.ts");
  assert.match(route, /if \(body\.restoreSettings !== undefined\) return restoreSettings\(body\.restoreSettings\);/);
  assert.ok(
    route.indexOf("if (body.restoreSettings !== undefined)") < route.indexOf("if (body.gripSize)"),
    "the restore is handled before the single-setting changes",
  );
  assert.match(route, /export async function PATCH\(request: Request\) \{\s+if \(isPublicPreview\(request\)\) return publicPreviewDenied\(\);/);

  const relay = read("scripts/baseline-relay.mjs");
  assert.match(relay, /body: JSON\.stringify\(\{ restoreSettings: settings \}\)/);
  assert.match(relay, /\nvoid restoreDatabaseSettings\(\);/);
  assert.match(relay, /if \(parsedBody\?\.restoreSettings !== undefined\) \{[^}]*writeHead\(400/);
});

test("the API drops the unused price tables and rows that left the catalogue", () => {
  const route = read("app/api/tracker/route.ts");
  for (const table of ["offers", "price_history", "checks", "used_offers"]) {
    assert.doesNotMatch(route, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b|FROM ${table}\\b`), `${table} is no longer created or read`);
  }
  assert.match(route, /\["offers", "price_history", "checks", "used_offers"\]\.map\(\(table\) => database\.prepare\(`DROP TABLE IF EXISTS \$\{table\}`\)\)/);
  assert.match(route, /"drop-unused-price-tables-v1"/);
  for (const table of ["targets", "used_targets"]) {
    assert.match(route, new RegExp(`DELETE FROM ${table} WHERE model_key NOT IN \\(SELECT value FROM json_each\\(\\?\\)\\)`));
  }
  assert.match(route, /DELETE FROM retailer_settings WHERE retailer_key NOT IN \(SELECT value FROM json_each\(\?\)\)/);
});
