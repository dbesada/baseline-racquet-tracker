import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("classifies tennis balls by court type and package without mixing cases and cans", async () => {
  const monitor = await readFile(new URL("../scripts/check-prices.mjs", import.meta.url), "utf8");
  const start = monitor.indexOf("const ballTypeOrder =");
  const end = monitor.indexOf("\nasync function fetchBallStore", start);
  assert.ok(start >= 0 && end > start);
  const helpers = Function(`${monitor.slice(start, end)}; return { tennisBallType, tennisBallPackage, isTennisBallProduct };`)();

  assert.equal(helpers.tennisBallType("Wilson US Open Extra Duty"), "Extra duty");
  assert.equal(helpers.tennisBallType("Penn Championship Regular Duty"), "Regular duty");
  assert.equal(helpers.tennisBallType("Babolat Gold All Court"), "All court");
  assert.equal(helpers.tennisBallType("Roland Garros Clay Court"), "Clay court");
  assert.equal(helpers.tennisBallType("Gamma Pressureless Ball"), "Pressureless");
  assert.equal(helpers.tennisBallType("Stage 2 Orange Dot"), "Junior");

  assert.equal(helpers.tennisBallPackage("Case of 24 cans, 3 balls per can"), "Case · 24 cans × 3 balls");
  assert.equal(helpers.tennisBallPackage("3 Ball Can"), "Can · 3 balls");
  assert.equal(helpers.tennisBallPackage("Bag of 60 Tennis Balls"), "60-ball package");
  assert.equal(helpers.isTennisBallProduct({ title: "Wilson US Open Extra Duty 3 Ball Can" }), true);
  assert.equal(helpers.isTennisBallProduct({ title: "Wilson Pickleball Balls 3 Pack" }), false);
  assert.equal(helpers.isTennisBallProduct({ title: "Tennis Ball Hopper" }), false);
});

test("uses multiple Canadian tennis-ball catalogues", async () => {
  const monitor = await readFile(new URL("../scripts/check-prices.mjs", import.meta.url), "utf8");
  const start = monitor.indexOf("const ballFeeds =");
  const end = monitor.indexOf("\n];", start);
  const feeds = monitor.slice(start, end);
  const stores = [...feeds.matchAll(/\["([^"]+)",\s*"https:/g)].map((match) => match[1]);
  assert.ok(new Set(stores).size >= 12);
  for (const store of ["ATR Sports", "Merchant of Tennis", "Racquet Science", "Tennis Giant", "Tenniszon"]) assert.ok(stores.includes(store), store);
});
