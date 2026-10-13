import assert from "node:assert/strict";
import test from "node:test";
import { searchRacquets } from "../app/ui/racquet-search.js";

const models = [
  { key: "pure-aero-98-2026", name: "Babolat Pure Aero 98 Gen9 (2026)", brand: "Babolat", price: 349 },
  { key: "pure-aero-100-2026", name: "Babolat Pure Aero 100 Gen9 (2026)", brand: "Babolat", price: 299 },
  { key: "pure-drive-2025", name: "Babolat Pure Drive (2025)", brand: "Babolat", price: null },
  { key: "blade-v9", name: "Wilson Blade 98 16x19 v9", brand: "Wilson", price: 279.95 },
  { key: "ezone-98-2025", name: "Yonex EZONE 98 (2025)", brand: "Yonex", price: 349 },
  { key: "ezone-98l-2025", name: "Yonex EZONE 98L (2025)", brand: "Yonex", price: 319 },
];
const keys = (query) => searchRacquets(query, models).map((model) => model.key);

test("every word must match the start of a word in the name or brand", () => {
  assert.deepEqual(keys("pure aero"), ["pure-aero-100-2026", "pure-aero-98-2026"]);
  assert.deepEqual(keys("aero 98"), ["pure-aero-98-2026"]);
  assert.deepEqual(keys("blade v9"), ["blade-v9"]);
  assert.deepEqual(keys("WILSON"), ["blade-v9"]);
  assert.deepEqual(keys("ezone 98l"), ["ezone-98l-2025"]);
  assert.deepEqual(keys("ero"), []);
  assert.deepEqual(keys("   "), []);
});

test("names that start with the search come first, then in-stock racquets", () => {
  assert.deepEqual(keys("babolat pure"), ["pure-aero-100-2026", "pure-aero-98-2026", "pure-drive-2025"]);
  assert.deepEqual(keys("pure"), ["pure-aero-100-2026", "pure-aero-98-2026", "pure-drive-2025"]);
  assert.equal(searchRacquets("a", models, 2).length, 2);
});
